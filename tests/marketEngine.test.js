import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScoreMatrix, summarizeMatrix, goalsLineProbability, handicapProbability,
  matrixProbability, calibrate, calibrateForMarket, priceSelection, marketOddsFrom,
  fairOddsFrom, expectedValue, computeDataQuality, correlationBetween, isIndependentEnough,
} from '../server/services/marketEngine.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} no es ~${b}`);

test('la matriz de marcadores suma 1', () => {
  for (const [l, m] of [[1.5, 1.1], [0.6, 2.4], [3.2, 0.4]]) {
    const total = matrixProbability(buildScoreMatrix(l, m), () => true);
    close(total, 1);
  }
});

test('1X2 suma 1 y favorece al equipo con mas xG', () => {
  const s = summarizeMatrix(buildScoreMatrix(2.1, 0.8));
  close(s.homeWin + s.draw + s.awayWin, 1);
  assert.ok(s.homeWin > s.awayWin);
});

test('Over y Under de goles son complementarios', () => {
  const m = buildScoreMatrix(1.4, 1.2);
  const { overProb, underProb } = goalsLineProbability(m, 2.5);
  close(overProb + underProb, 1);
  assert.ok(goalsLineProbability(m, 3.5).overProb < overProb, 'mas linea = menos probabilidad de Over');
});

test('el handicap con partidos parejos es simetrico', () => {
  const m = buildScoreMatrix(1.3, 1.3);
  const h = handicapProbability(m, 0);
  close(h.home, 0.5, 1e-6);
  close(h.away, 0.5, 1e-6);
});

test('Dixon-Coles: con rho negativo suben los empates a pocos goles', () => {
  const dc = matrixProbability(buildScoreMatrix(1.2, 1.0, -0.13), (h, a) => h === a && h <= 1);
  const indep = matrixProbability(buildScoreMatrix(1.2, 1.0, 0), (h, a) => h === a && h <= 1);
  assert.ok(dc > indep);
});

test('calibrate encoge hacia 50% y respeta el techo de 93%', () => {
  assert.ok(calibrate(80, 0.5) < 80 && calibrate(80, 0.5) > 50);
  assert.equal(calibrate(99.9, 1), 93);
  assert.ok(calibrate(80, 0) < calibrate(80, 1), 'peores datos = mas prudencia');
  assert.ok(calibrate(20, 0.5) > 20, 'tambien encoge las probabilidades bajas');
});

test('calibrateForMarket nunca supera el techo ni baja de 3', () => {
  for (const raw of [0, 5, 50, 95, 100]) {
    const v = calibrateForMarket(raw, 0.7, 'GOLES');
    assert.ok(v >= 3 && v <= 93);
  }
});

test('cuotas: la de la casa es menor que la justa por el margen', () => {
  assert.ok(marketOddsFrom(60) < fairOddsFrom(60));
  close(fairOddsFrom(50), 2);
  assert.ok(marketOddsFrom(99) >= 1.01);
});

test('expectedValue: cuota justa da EV 0, por encima positivo', () => {
  close(expectedValue(50, 2), 0);
  assert.ok(expectedValue(50, 2.2) > 0);
  assert.ok(expectedValue(50, 1.8) < 0);
});

test('priceSelection devuelve cuota minima = 1/p calibrada', () => {
  const r = priceSelection(70, 62);
  close(r.breakEvenOdds, fairOddsFrom(62));
});

test('priceSelection NO declara valor ni edge (seria circular: sale del mismo modelo)', () => {
  const r = priceSelection(70, 62);
  assert.equal('hasValue' in r, false);
  assert.equal('edge' in r, false);
});

test('calidad de datos: sube con muestra, H2H y datos externos, y queda en [0.05,1]', () => {
  const low = computeDataQuality({});
  const high = computeDataQuality({ played: 30, h2hCount: 10, hasExternalStats: true, isLiveData: true });
  assert.equal(low, 0.05);
  assert.equal(high, 1);
  assert.ok(computeDataQuality({ played: 5 }) < computeDataQuality({ played: 10 }));
});

test('correlacion: mismo grupo = 1, independientes pasan el filtro', () => {
  assert.equal(correlationBetween('CORNERS', 'CORNERS'), 1);
  assert.equal(isIndependentEnough({ correlationGroup: 'GOLES_LOCAL' }, [{ correlationGroup: 'GOLES_VISITA' }]), true);
  assert.equal(isIndependentEnough({ correlationGroup: 'GOLES_TOTAL' }, [{ correlationGroup: 'GOLES_LOCAL' }]), false);
});
