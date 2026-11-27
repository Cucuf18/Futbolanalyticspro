import json, numpy as np
from lab import *   # noqa

def table(title):
    print('\n' + '=' * 6 + ' ' + title + ' ' + '=' * 6)

# ───── 1. Busqueda ampliada (solo temporada 2024/25) ─────
table('1. Busqueda ampliada en 2024/25')
cands = []
for HL in (240, 360, 540):
    for K in (2, 3, 4):
        out = run(HL=HL, K=K, w=0.4, gamma=1.2, target={1})
        idxs, l = ll_rows(out, 1, MK_CLOSE)
        cands.append((l.mean(), dict(HL=HL, K=K, w=0.4, gamma=1.2)))
        print(f'  HL={HL:>3} K={K}  logloss {l.mean():.4f}')
cands.sort(key=lambda x: x[0])
P = cands[0][1]
print(f'  -> elegido (solo con 2024/25): {P}  logloss {cands[0][0]:.4f}')
json.dump(P, open('/home/claude/ml/best_params2.json', 'w'))

# ───── 2. Prueba final, temporada 2025/26 (no vista al ajustar) ─────
table('2. PRUEBA FINAL: temporada 2025/26 (1X2, error logloss; menor = mejor)')
out_all, feats = run(target=None, want_feats=True, **P)
rep = {}
rep['dc_tuned'] = report('Modelo nuevo (goles + tiros, ajustado)', out_all, 2)
report('   (ajuste 2024/25, para referencia)', out_all, 1)
base = run(target={2}, HL=120, K=8, w=0.0, gamma=1.0)
rep['dc_base'] = report('Mismo modelo SIN tiros y sin ajustar', base, 2)
print('  motor actual de la pagina                                   1.0149  mercado 0.9852 dif +0.0297   (prueba anterior)')

# ───── 3. Mas/Menos 2.5 goles ─────
table('3. Mas/Menos 2.5 goles, 2025/26')
idxs = [i for i in out_all if D.season[i] == 2 and not np.isnan(MK_CLOSE_OU[i]).any()]
po = np.array([out_all[i][3] for i in idxs]); yo = Y_OVER[idxs]
lm = -np.log(np.clip(np.where(yo == 1, po, 1 - po), 1e-6, 1))
mo = np.array([MK_CLOSE_OU[i][0] for i in idxs])
lk = -np.log(np.clip(np.where(yo == 1, mo, 1 - mo), 1e-6, 1))
d = lm - lk; lo, hi = np.percentile([rng.choice(d, len(d)).mean() for _ in range(800)], [2.5, 97.5])
print(f'  modelo nuevo {lm.mean():.4f} | mercado {lk.mean():.4f} | dif {d.mean():+.4f} [{lo:+.4f},{hi:+.4f}]  n={len(idxs)}   (motor actual: 0.6895 vs mercado ~0.67)')

# ───── 4. Calibracion que aprende sola (temperatura, ventana creciente) ─────
table('4. Calibracion automatica que se reajusta partido a partido')
tid = [i for i in out_all if D.season[i] >= 1 and not np.isnan(MK_CLOSE[i]).any()]
tid.sort()
Praw = np.array([[out_all[i][0], out_all[i][1], out_all[i][2]] for i in tid]); yy = Y[tid]; ss = D.season.values[tid]
Ts = np.array([0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.5])
def tscale(p, T):
    q = p ** T; return q / q.sum(axis=1, keepdims=True)
L = np.array([-np.log(np.clip(tscale(Praw, T)[np.arange(len(yy)), yy], 1e-6, 1)) for T in Ts]).T  # n x G
cum = np.cumsum(L, axis=0)
chosen = np.ones(len(tid), dtype=int) * 2
for i in range(len(tid)):
    if i >= 300:
        chosen[i] = int(np.argmin(cum[i - 1]))
adap = L[np.arange(len(tid)), chosen]
m2 = ss == 2
print(f'  sin calibrar: {L[m2, 2].mean():.4f} | calibracion que aprende sola: {adap[m2].mean():.4f} | temperaturas usadas al final: {np.unique(Ts[chosen[m2]], return_counts=True)}')

# ───── 5. Machine learning (gradient boosting) ─────
table('5. Machine learning sobre las mismas estadisticas (sin cuotas)')
fi = sorted(feats.keys())
X = np.array([feats[i] for i in fi]); yf = Y[fi]; sf = D.season.values[fi]
okm = ~np.isnan(MK_CLOSE[fi]).any(axis=1)
tr = (sf <= 1); tst = (sf == 2) & okm
def ev(name, Pm):
    l = -np.log(np.clip(Pm[np.arange(len(Pm)), yf[tst]], 1e-6, 1))
    mk = -np.log(MK_CLOSE[np.array(fi)[tst]][np.arange(tst.sum()), yf[tst]])
    d = l - mk; lo, hi = np.percentile([rng.choice(d, len(d)).mean() for _ in range(800)], [2.5, 97.5])
    print(f'  {name:<50} {l.mean():.4f}  dif vs mercado {d.mean():+.4f} [{lo:+.4f},{hi:+.4f}]  n={tst.sum()}')
    return l.mean()
ev('Modelo de goles (referencia, sin ML)', X[tst][:, 2:5])
gb = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.03, max_iter=200, l2_regularization=10.0, min_samples_leaf=60, random_state=0).fit(X[tr], yf[tr])
ev('Gradient boosting (estadisticas)', gb.predict_proba(X[tst]))
lr = LogisticRegression(C=0.5, max_iter=2000).fit(np.nan_to_num((X[tr] - X[tr].mean(0)) / (X[tr].std(0) + 1e-9)), yf[tr])
ev('Regresion logistica (estadisticas)', lr.predict_proba(np.nan_to_num((X[tst] - X[tr].mean(0)) / (X[tr].std(0) + 1e-9))))

# ───── 6. ¿Aporta algo que el mercado no sepa? ─────
table('6. Mezcla modelo nuevo + mercado de APERTURA (se compara con el cierre)')
ti = np.array(fi)[tst]
Pm = np.array([[out_all[i][0], out_all[i][1], out_all[i][2]] for i in ti])
mo_ = MK_OPEN[ti]; mc = MK_CLOSE[ti]; yt = Y[ti]
okk = ~np.isnan(mo_).any(axis=1)
for wgt in (0.0, 0.1, 0.2, 0.3, 0.5, 1.0):
    q = wgt * Pm[okk] + (1 - wgt) * mo_[okk]
    print(f'  peso del modelo {wgt:.1f}: error vs resultado {(-np.log(np.clip(q[np.arange(okk.sum()), yt[okk]], 1e-6, 1))).mean():.4f}   (cierre del mercado: {(-np.log(mc[okk][np.arange(okk.sum()), yt[okk]])).mean():.4f})')

# ───── 7. Simulacion de apuestas, 2025/26, cuota de apertura Bet365 ─────
table('7. Apostar 1 unidad cuando el modelo ve >5% de ventaja (2025/26, apertura Bet365)')
def roi(Pmodel, idxs, thr=0.05):
    prof = []; clv = []
    for p, i in zip(Pmodel, idxs):
        r = D.iloc[i]
        odds = [pd.to_numeric(r.get('B365H'), errors='coerce'), pd.to_numeric(r.get('B365D'), errors='coerce'), pd.to_numeric(r.get('B365A'), errors='coerce')]
        if any(np.isnan(o) or o <= 1 for o in odds) or np.isnan(MK_CLOSE[i]).any(): continue
        edges = [p[k] * odds[k] - 1 for k in range(3)]; k = int(np.argmax(edges))
        if edges[k] > thr:
            prof.append(odds[k] - 1 if Y[i] == k else -1); clv.append(odds[k] * MK_CLOSE[i][k] - 1)
    return len(prof), np.mean(prof), np.percentile([rng.choice(prof, len(prof)).mean() for _ in range(800)], [2.5, 97.5]), np.mean(clv)
ctrl = []
for i in ti:
    r = D.iloc[i]
    for k, c in enumerate(['B365H', 'B365D', 'B365A']):
        o = pd.to_numeric(r.get(c), errors='coerce')
        if not np.isnan(o) and o > 1: ctrl.append(o - 1 if Y[i] == k else -1)
print(f'  control (apostar a todo): ROI {np.mean(ctrl)*100:+.1f}%')
for name, Pp in (('modelo nuevo', Pm), ('gradient boosting', gb.predict_proba(X[tst]))):
    n, m, ci, clv = roi(Pp, ti)
    print(f'  {name:<18} {n:5d} apuestas  ROI {m*100:+.1f}%  IC95 [{ci[0]*100:+.1f}%,{ci[1]*100:+.1f}%]  CLV medio {clv*100:+.1f}%')
for thr in (0.08, 0.12):
    n, m, ci, clv = roi(Pm, ti, thr)
    print(f'  modelo nuevo, ventaja>{int(thr*100)}%: {n:5d} apuestas  ROI {m*100:+.1f}%  CLV {clv*100:+.1f}%')
