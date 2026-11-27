"""
LABORATORIO DE MEJORAS DEL MODELO
Cada idea se prueba partido a partido (solo con lo ocurrido antes) y se compara con el
mercado en los MISMOS partidos. Ajuste de parametros: temporada 2024/25.
Prueba final, sin tocar nada mas: temporada 2025/26.
"""
import numpy as np, pandas as pd, math, json, sys, warnings
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
warnings.filterwarnings('ignore')
rng = np.random.default_rng(11)

DIRS = ['/home/claude/fd/a', '/home/claude/fd/b', '/home/claude/fd/c']
LEAGUES = ['E0', 'E1', 'SP1', 'I1', 'D1', 'F1', 'N1', 'P1']
MIN_HIST = 8
MAXG = 9

# ───────────────────────── datos ─────────────────────────
frames = []
for s, d in enumerate(DIRS):
    for lg in LEAGUES:
        df = pd.read_csv(f'{d}/{lg}.csv', encoding='utf-8-sig', on_bad_lines='skip')
        df = df.dropna(subset=['FTHG', 'FTAG', 'HomeTeam', 'AwayTeam'])
        df['lg'] = lg; df['season'] = s
        frames.append(df)
D = pd.concat(frames, ignore_index=True)
D['dt'] = pd.to_datetime(D['Date'], dayfirst=True, errors='coerce')
D = D.dropna(subset=['dt']).sort_values(['dt', 'lg', 'HomeTeam']).reset_index(drop=True)
D['day'] = (D['dt'] - D['dt'].min()).dt.days
for c in ['HS', 'AS', 'HST', 'AST', 'HC', 'AC']:
    D[c] = pd.to_numeric(D[c], errors='coerce')

# xG-proxy a partir de tiros: goles ~ a*tiros a puerta + b*tiros fuera. Se ajusta SOLO con la temporada 2023/24
s0 = D[D.season == 0].dropna(subset=['HS', 'HST', 'AS', 'AST'])
Xs = np.vstack([np.column_stack([s0.HST, s0.HS - s0.HST]), np.column_stack([s0.AST, s0.AS - s0.AST])])
ys = np.concatenate([s0.FTHG.values, s0.FTAG.values])
coef, *_ = np.linalg.lstsq(Xs, ys, rcond=None)
print(f'xG-proxy (solo con 2023/24): goles ≈ {coef[0]:.3f}*tiros a puerta + {coef[1]:.3f}*tiros fuera')
D['xH'] = np.where(D.HS.notna(), coef[0] * D.HST + coef[1] * (D.HS - D.HST), D.FTHG)
D['xA'] = np.where(D.AS.notna(), coef[0] * D.AST + coef[1] * (D.AS - D.AST), D.FTAG)

def devig(cols):
    o = D[cols].apply(pd.to_numeric, errors='coerce').values
    ok = np.all(o > 1, axis=1)
    inv = 1.0 / np.where(o > 1, o, np.nan)
    p = inv / inv.sum(axis=1, keepdims=True)
    p[~ok] = np.nan
    return p
MK_CLOSE = devig(['AvgCH', 'AvgCD', 'AvgCA'])
MK_OPEN = devig(['AvgH', 'AvgD', 'AvgA'])
MK_CLOSE_OU = devig(['AvgC>2.5', 'AvgC<2.5'])
Y = np.where(D.FTHG > D.FTAG, 0, np.where(D.FTHG == D.FTAG, 1, 2)).astype(int)
Y_OVER = ((D.FTHG + D.FTAG) > 2.5).astype(int).values  # 1 = over
HG, AG = D.FTHG.values.astype(int), D.FTAG.values.astype(int)

# ───────────────────────── modelo de goles Dixon-Coles ─────────────────────────
_fact = np.array([math.factorial(i) for i in range(MAXG + 1)], dtype=float)
def score_matrix(lh, la, rho):
    i = np.arange(MAXG + 1)
    ph = np.exp(-lh) * lh ** i / _fact
    pa = np.exp(-la) * la ** i / _fact
    M = np.outer(ph, pa)
    M[0, 0] *= 1 - lh * la * rho
    M[0, 1] *= 1 + lh * rho
    M[1, 0] *= 1 + la * rho
    M[1, 1] *= 1 - rho
    M /= M.sum()
    return M
def probs_from(M):
    h = np.tril(M, -1).sum(); d = np.trace(M); a = np.triu(M, 1).sum()
    tot = np.add.outer(np.arange(MAXG + 1), np.arange(MAXG + 1))
    over = M[tot > 2.5].sum()
    return h, d, a, over

def run(HL=120, K=6, w=0.0, gamma=1.0, rho=-0.08, target=None, want_feats=False, elo_k=20):
    """Recorre todos los partidos en orden. Devuelve probabilidades para los partidos de las temporadas 'target'."""
    hist = {}
    lg_sum = {}  # liga -> [n, goles local, goles visita, xG local, xG visita]
    elo = {}
    last_day = {}
    out = {}
    feats = {}
    for idx in range(len(D)):
        r = D.iloc[idx]
        lg, h, a, day = r.lg, r.HomeTeam, r.AwayTeam, r.day
        kh, ka = (lg, h), (lg, a)
        L = lg_sum.setdefault(lg, [0, 0.0, 0.0, 0.0, 0.0])
        Hh, Ha = hist.get(kh), hist.get(ka)
        if (target is None or r.season in target) and Hh and Ha and len(Hh['d']) >= MIN_HIST and len(Ha['d']) >= MIN_HIST and L[0] > 50:
            n = L[0]
            mu_g = (L[1] + L[2]) / (2 * n); mu_x = (L[3] + L[4]) / (2 * n)
            mu = (1 - w) * mu_g + w * mu_x
            def side(Hx, metric_w):
                d = np.array(Hx['d'][-110:]); wt = 0.5 ** ((day - d) / HL)
                gf = np.array(Hx['gf'][-110:]); ga = np.array(Hx['ga'][-110:])
                xf = np.array(Hx['xf'][-110:]); xa = np.array(Hx['xa'][-110:])
                mf = (1 - metric_w) * gf + metric_w * xf; ma = (1 - metric_w) * ga + metric_w * xa
                mu_ = (1 - metric_w) * mu_g + metric_w * mu_x
                att = ((wt * mf).sum() + K * mu_) / (wt.sum() + K)
                dfn = ((wt * ma).sum() + K * mu_) / (wt.sum() + K)
                return att / mu_, dfn / mu_, wt.sum()
            ah, dh, _ = side(Hh, w); aa, da, _ = side(Ha, w)
            lh = (L[1] / n) * (ah * da) ** gamma
            la = (L[2] / n) * (aa * dh) ** gamma
            lh = min(max(lh, 0.2), 4.5); la = min(max(la, 0.2), 4.5)
            M = score_matrix(lh, la, rho)
            ph, pd_, pa, po = probs_from(M)
            out[idx] = (ph, pd_, pa, po, lh, la)
            if want_feats:
                gah, gdh, _ = side(Hh, 0.0); gaa, gda, _ = side(Ha, 0.0)
                xah, xdh, _ = side(Hh, 1.0); xaa, xda, _ = side(Ha, 1.0)
                feats[idx] = [lh, la, ph, pd_, pa, po, elo.get(kh, 1500) - elo.get(ka, 1500),
                              gah, gdh, gaa, gda, xah, xdh, xaa, xda,
                              min(day - last_day.get(kh, day - 7), 14), min(day - last_day.get(ka, day - 7), 14),
                              len(Hh['d']), len(Ha['d'])]
        # actualizar estado con el resultado real
        for key, gf, ga, xf, xa in ((kh, r.FTHG, r.FTAG, r.xH, r.xA), (ka, r.FTAG, r.FTHG, r.xA, r.xH)):
            Hx = hist.setdefault(key, {'d': [], 'gf': [], 'ga': [], 'xf': [], 'xa': []})
            Hx['d'].append(day); Hx['gf'].append(gf); Hx['ga'].append(ga); Hx['xf'].append(xf); Hx['xa'].append(xa)
        L[0] += 1; L[1] += r.FTHG; L[2] += r.FTAG; L[3] += r.xH; L[4] += r.xA
        eh, ea = elo.get(kh, 1500), elo.get(ka, 1500)
        exp_h = 1 / (1 + 10 ** ((ea - (eh + 60)) / 400)); act = 1 if r.FTHG > r.FTAG else .5 if r.FTHG == r.FTAG else 0
        gd = abs(r.FTHG - r.FTAG); mult = 1 if gd <= 1 else 1.5 if gd == 2 else (11 + gd) / 8
        dl = elo_k * mult * (act - exp_h); elo[kh] = eh + dl; elo[ka] = ea - dl
        last_day[kh] = day; last_day[ka] = day
    return (out, feats) if want_feats else out

def ll_rows(out, season, market=None):
    idxs = [i for i in out if D.season[i] == season and (market is None or not np.isnan(market[i]).any())]
    p = np.array([[out[i][0], out[i][1], out[i][2]] for i in idxs])
    y = Y[idxs]
    return idxs, -np.log(np.clip(p[np.arange(len(y)), y], 1e-6, 1))

def report(name, out, season, ref_idx=None):
    idxs, l = ll_rows(out, season, MK_CLOSE)
    mk = -np.log(np.clip(MK_CLOSE[idxs][np.arange(len(idxs)), Y[idxs]], 1e-6, 1))
    d = l - mk
    bs = [rng.choice(d, len(d)).mean() for _ in range(800)]
    lo, hi = np.percentile(bs, [2.5, 97.5])
    print(f'  {name:<52} {l.mean():.4f}  mercado {mk.mean():.4f}  dif {d.mean():+.4f} [{lo:+.4f},{hi:+.4f}]  n={len(idxs)}')
    return l.mean(), d.mean()

if __name__ == '__main__':
    print('=== 0. Referencias ===')
    fr = np.bincount(Y[D.season <= 1], minlength=3) / (D.season <= 1).sum()
    te = (D.season == 2).values & ~np.isnan(MK_CLOSE).any(axis=1)
    print(f'  ingenuo (frecuencias 1X2)                                 {(-np.log(fr[Y[te]])).mean():.4f}')
    print(f'  mercado de apertura (prom.)                               {(-np.log(np.clip(MK_OPEN[te][np.arange(te.sum()), Y[te]], 1e-6, 1))).mean():.4f}')
    print(f'  mercado de cierre (prom.)                                 {(-np.log(MK_CLOSE[te][np.arange(te.sum()), Y[te]])).mean():.4f}   (n={te.sum()})')
    print('  motor ACTUAL de la pagina (de la prueba anterior)         1.0149  (dif +0.029 en esa misma temporada)')

    print('\n=== 1. Ajuste en 2024/25 (probando combinaciones) ===')
    best = None
    grid = []
    for HL in (60, 120, 240):
        for K in (4, 8, 14):
            out = run(HL=HL, K=K, w=0.0, gamma=1.0, target={1})
            idxs, l = ll_rows(out, 1, MK_CLOSE)
            grid.append((l.mean(), dict(HL=HL, K=K, w=0.0, gamma=1.0)))
            print(f'  goles solos   HL={HL:>3} K={K:>2}  logloss {l.mean():.4f}')
    grid.sort(key=lambda x: x[0]); bestg = grid[0][1]
    print(f'  -> mejor con goles: {bestg}  ({grid[0][0]:.4f})')
    res = []
    for w in (0.0, 0.4, 0.7, 1.0):
        p = dict(bestg); p['w'] = w
        out = run(target={1}, **p)
        idxs, l = ll_rows(out, 1, MK_CLOSE); res.append((l.mean(), w)); print(f'  mezcla goles/tiros w={w}: logloss {l.mean():.4f}')
    bw = sorted(res)[0][1]
    res = []
    for g in (0.8, 1.0, 1.2, 1.4):
        p = dict(bestg); p['w'] = bw; p['gamma'] = g
        out = run(target={1}, **p)
        idxs, l = ll_rows(out, 1, MK_CLOSE); res.append((l.mean(), g)); print(f'  intensidad de diferencias gamma={g}: logloss {l.mean():.4f}')
    bgam = sorted(res)[0][1]
    final = dict(bestg); final['w'] = bw; final['gamma'] = bgam
    print(f'\n  PARAMETROS ELEGIDOS (solo con 2024/25): {final}')
    json.dump(final, open('/home/claude/ml/best_params.json', 'w'))
