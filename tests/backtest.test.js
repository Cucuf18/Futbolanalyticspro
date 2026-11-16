import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import path from 'path';
import fs from 'fs';

// El almacenamiento va a una carpeta temporal, nunca a server/data.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fap-'));
delete process.env.DATABASE_URL;

const { gradePick, findMatchForPrediction, buildReport, settlePending, _resetStoreForTests } =
  await import('../server/services/backtest.js');
const { writeBlob, readBlob, _resetForTests } = await import('../server/services/persistence.js');

test('gradePick: 1X2 y doble oportunidad', () => {
  assert.equal(gradePick({ kind: 'RESULT', side: 'HOME' }, 2, 1), true);
  assert.equal(gradePick({ kind: 'RESULT', side: 'HOME' }, 1, 1), false);
  assert.equal(gradePick({ kind: 'RESULT', side: 'AWAY' }, 0, 3), true);
  assert.equal(gradePick({ kind: 'DOUBLE_CHANCE', side: '1X' }, 1, 1), true);
  assert.equal(gradePick({ kind: 'DOUBLE_CHANCE', side: 'X2' }, 2, 1), false);
  assert.equal(gradePick({ kind: 'DOUBLE_CHANCE', side: '12' }, 1, 1), false);
});

test('gradePick: goles totales respeta la linea', () => {
  assert.equal(gradePick({ kind: 'GOALS_TOTAL', side: 'OVER', line: 2.5 }, 2, 1), true);
  assert.equal(gradePick({ kind: 'GOALS_TOTAL', side: 'OVER', line: 2.5 }, 1, 1), false);
  assert.equal(gradePick({ kind: 'GOALS_TOTAL', side: 'UNDER', line: 2.5 }, 1, 1), true);
  assert.equal(gradePick({ kind: 'GOALS_TOTAL', side: 'UNDER', line: 3.5 }, 2, 1), true);
  assert.equal(gradePick({ kind: 'GOALS_TOTAL', side: 'UNDER', line: 3.5 }, 2, 2), false);
});

test('gradePick: BTTS, goles por equipo y equipo marca', () => {
  assert.equal(gradePick({ kind: 'BTTS', side: 'YES' }, 1, 1), true);
  assert.equal(gradePick({ kind: 'BTTS', side: 'NO' }, 2, 0), true);
  assert.equal(gradePick({ kind: 'TEAM_GOALS', side: 'HOME', over: true, line: 1.5 }, 2, 0), true);
  assert.equal(gradePick({ kind: 'TEAM_GOALS', side: 'AWAY', over: false, line: 1.5 }, 0, 2), false);
  assert.equal(gradePick({ kind: 'TEAM_SCORES', side: 'AWAY' }, 3, 0), false);
});

test('gradePick: handicap, con push = null (se devuelve la apuesta)', () => {
  assert.equal(gradePick({ kind: 'HANDICAP', side: 'HOME', line: -1 }, 3, 1), true);
  assert.equal(gradePick({ kind: 'HANDICAP', side: 'HOME', line: -1 }, 2, 1), null);
  assert.equal(gradePick({ kind: 'HANDICAP', side: 'HOME', line: -1 }, 1, 1), false);
  assert.equal(gradePick({ kind: 'HANDICAP', side: 'AWAY', line: 1.5 }, 2, 1), true);
});

test('gradePick: mercados no verificables o sin datos devuelven null', () => {
  assert.equal(gradePick(null, 1, 0), null);
  assert.equal(gradePick({ kind: 'CORNERS' }, 1, 0), null);
});

const rec = { homeTeamId: 1, awayTeamId: 2, createdAt: '2026-11-10T12:00:00Z' };
const match = (id, home, away, utcDate) => ({ id, homeTeam: { id: home }, awayTeam: { id: away }, utcDate });

test('REGLA ANTI-TRAMPA: no se acepta un partido que empezo antes de la prediccion', () => {
  const started = match(10, 1, 2, '2026-11-10T09:00:00Z'); // 3 h antes
  assert.equal(findMatchForPrediction(rec, [started]), null);
  const justBefore = match(11, 1, 2, '2026-11-10T11:59:59Z');
  assert.equal(findMatchForPrediction(rec, [justBefore]), null);
});

test('se elige el primer partido posterior y solo el cruce correcto', () => {
  const later = match(20, 1, 2, '2026-11-20T15:00:00Z');
  const sooner = match(21, 1, 2, '2026-11-14T15:00:00Z');
  const reversed = match(22, 2, 1, '2026-11-12T15:00:00Z');
  const other = match(23, 1, 3, '2026-11-11T15:00:00Z');
  assert.equal(findMatchForPrediction(rec, [later, reversed, other, sooner]).id, 21);
  assert.equal(findMatchForPrediction(rec, [reversed, other]), null);
});

const pick = (probability, hit, marketType = 'GOLES', tier = 'safe') => ({ probability, hit, marketType, tier });
const settled = (picks, extra = {}) => ({ settled: true, leagueId: 'PL', dataQuality: 0.7, picks, ...extra });

test('buildReport: calibracion y desvio (gap) por tramo', () => {
  const picks = [
    ...Array(10).fill(0).map((_, i) => pick(72, i < 6)), // dice 72, acierta 60
  ];
  const r = buildReport([settled(picks)]);
  assert.equal(r.resumen.picksEvaluados, 10);
  assert.equal(r.resumen.hitRate, 60);
  const bucket = r.calibracion.find((b) => b.bucket === '70-75%');
  assert.equal(bucket.total, 10);
  assert.equal(bucket.gap, 12); // sobreconfiado en 12 puntos
});

test('buildReport: ignora picks no evaluables y predicciones descartadas', () => {
  const r = buildReport([
    settled([pick(70, true), pick(70, null), pick(70, undefined)]),
    settled([pick(70, true)], { expired: true }),
    { settled: false, picks: [pick(70, true)] },
  ]);
  assert.equal(r.resumen.picksEvaluados, 1);
  assert.equal(r.resumen.picksNoEvaluables, 2);
  assert.equal(r.resumen.prediccionesDescartadas, 1);
});

test('buildReport vacio no revienta', () => {
  const r = buildReport([]);
  assert.equal(r.resumen.picksEvaluados, 0);
  assert.equal(r.resumen.hitRate, null);
});

test('settlePending descarta las predicciones antiguas sin partido valido', async () => {
  _resetForTests();
  _resetStoreForTests();
  const old = new Date(Date.now() - 60 * 86400000).toISOString();
  const fresh = new Date().toISOString();
  writeBlob('predictions', {
    predictions: [
      { id: 'a', key: 'k1', leagueId: 'PL', createdAt: old, picks: [], settled: false },
      { id: 'b', key: 'k2', leagueId: 'PL', createdAt: fresh, picks: [], settled: false },
    ],
  });
  _resetStoreForTests();
  const res = await settlePending();
  assert.equal(res.expired, 1);
});

test('persistencia en archivos: lo escrito se puede volver a leer', () => {
  _resetForTests();
  writeBlob('demo', { a: 1 });
  _resetForTests();
  assert.deepEqual(readBlob('demo'), { a: 1 });
  assert.equal(readBlob('no-existe'), null);
});
