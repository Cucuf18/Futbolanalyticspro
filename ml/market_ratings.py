"""
¿Se puede parecer al mercado aprendiendo DE LAS CUOTAS pasadas?
Cada equipo recibe un rating que se ajusta para reproducir las probabilidades que el mercado dio en
sus partidos anteriores (no usa resultados). Luego se predice el siguiente partido con esos ratings.
Medida de parecido: diferencia media en puntos porcentuales con el mercado de cierre, en los mismos partidos.
"""
import numpy as np, json, math
from lab import D, Y, MK_CLOSE, MK_OPEN, rng

def run(eta, season_decay=0.85, hfa_eta=0.02, use='close'):
    MK = MK_CLOSE if use == 'close' else MK_OPEN
    r = {}; hfa = {}
    pred = {}
    prev_season = {}
    last_idx = {}
    for i in range(len(D)):
        row = D.iloc[i]; lg = row.lg; h = (lg, row.HomeTeam); a = (lg, row.AwayTeam)
        s = row.season
        for t in (h, a):
            if prev_season.get(t, s) != s:
                r[t] = r.get(t, 0.0) * season_decay
            prev_season[t] = s
        rh, ra = r.get(h, 0.0), r.get(a, 0.0)
        hf = hfa.get(lg, 0.3)
        nh, na = D.groupby if False else 0, 0
        dhat = rh - ra + hf
        pred[i] = dhat
        pm = MK[i]
        if not np.isnan(pm).any():
            d = math.log(pm[0] / pm[2])
            err = d - dhat
            r[h] = rh + eta * err / 2; r[a] = ra - eta * err / 2
            hfa[lg] = hf + hfa_eta * err * 0.3
    return pred

def probs(dhat, c):
    ph = math.exp(dhat / 2); pa = math.exp(-dhat / 2); pd_ = c
    z = ph + pa + pd_
    return ph / z, pd_ / z, pa / z

def fit_c(pred, seasons):
    # constante de empate: se ajusta con la temporada de ajuste, minimizando error con el mercado
    best = None
    for c in np.arange(0.6, 1.6, 0.05):
        e = 0; n = 0
        for i, d in pred.items():
            if D.season[i] in seasons and not np.isnan(MK_CLOSE[i]).any():
                p = probs(d, c); e += sum(abs(p[k] - MK_CLOSE[i][k]) for k in range(3)); n += 1
        if best is None or e / n < best[0]: best = (e / n, c)
    return best[1]

def evaluate(pred, c, season):
    idx = [i for i in pred if D.season[i] == season and not np.isnan(MK_CLOSE[i]).any()]
    P = np.array([probs(pred[i], c) for i in idx]); M = MK_CLOSE[idx]; y = Y[idx]
    ll = -np.log(np.clip(P[np.arange(len(y)), y], 1e-6, 1)); mk = -np.log(np.clip(M[np.arange(len(y)), y], 1e-6, 1))
    d = ll - mk; lo, hi = np.percentile([rng.choice(d, len(d)).mean() for _ in range(800)], [2.5, 97.5])
    mae = np.abs(P - M).mean() * 100 * 3 / 3
    return ll.mean(), mk.mean(), d.mean(), lo, hi, mae, len(idx), P, idx

if __name__ == '__main__':
    print("Ajuste del ritmo de aprendizaje (temporada 2024/25):")
    best = None
    for eta in (0.05, 0.1, 0.2, 0.3, 0.45):
        pred = run(eta); c = fit_c(pred, {1})
        ll, mk, d, lo, hi, mae, n, _, _ = evaluate(pred, c, 1)
        print(f"  eta={eta}: error vs mercado {d:+.4f}  dif media {mae:.2f} pts  (c={c:.2f})")
        if best is None or d < best[0]: best = (d, eta, c)
    _, eta, c = best
    print(f"-> elegido con 2024/25: eta={eta}, c={c:.2f}\n")
    pred = run(eta)
    ll, mk, d, lo, hi, mae, n, P, idx = evaluate(pred, c, 2)
    print(f"PRUEBA FINAL 2025/26 (n={n}):")
    print(f"  Ratings aprendidos del mercado: error {ll:.4f} | mercado {mk:.4f} | dif {d:+.4f} [{lo:+.4f},{hi:+.4f}] | se aleja {mae:.2f} puntos del mercado en promedio")
    json.dump({'eta': eta, 'c': c}, open('/home/claude/ml/mr_params.json', 'w'))
    # comparacion de parecido con el motor v1 y v2 (mismos partidos de la prueba)
    for v in ('v1', 'v2'):
        R = [r for r in json.load(open(f'/tmp/eng_{v}.json')) if r['season'] == 2 and r['closeAvg']]
        m = np.array([[r['model']['h'], r['model']['d'], r['model']['a']] for r in R]); k = np.array([r['closeAvg'] for r in R])
        o = np.array([0 if r['hg'] > r['ag'] else 1 if r['hg'] == r['ag'] else 2 for r in R])
        l = -np.log(np.clip(m[np.arange(len(o)), o], 1e-6, 1)); lk = -np.log(np.clip(k[np.arange(len(o)), o], 1e-6, 1))
        print(f"  Motor {v}: error {l.mean():.4f} | dif vs mercado {(l-lk).mean():+.4f} | se aleja {np.abs(m-k).mean()*100:.2f} puntos del mercado en promedio (n={len(R)})")
