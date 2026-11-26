import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../server/services/marketOdds.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} no es ~${b}`);

test('normalizeTeam: quita acentos, FC/CF y numeros, y resuelve alias', () => {
  assert.equal(M.normalizeTeam('Wolverhampton Wanderers FC'), 'wolverhampton wanderers');
  assert.equal(M.normalizeTeam('Wolves'), 'wolverhampton wanderers');
  assert.equal(M.normalizeTeam('Atlético de Madrid'), 'atletico madrid');
  assert.equal(M.normalizeTeam('FSV Mainz 05'), 'mainz');
  assert.equal(M.normalizeTeam('Man United'), 'manchester united');
});

test('sameTeam: une abreviaturas y NO confunde equipos parecidos', () => {
  assert.equal(M.sameTeam('Cardiff', 'Cardiff City FC'), true);
  assert.equal(M.sameTeam('Sheffield Weds', 'Sheffield Wednesday FC'), true);
  assert.equal(M.sameTeam('Wolves', 'Wolverhampton Wanderers FC'), true);
  assert.equal(M.sameTeam('Man City', 'Manchester City FC'), true);
  // peligros reales:
  assert.equal(M.sameTeam('Manchester City', 'Manchester United'), false);
  assert.equal(M.sameTeam('Sheffield United', 'Sheffield Wednesday'), false);
  assert.equal(M.sameTeam('Real Madrid', 'Real Sociedad'), false);
  assert.equal(M.sameTeam('Inter', 'Inter Miami'), false);
  assert.equal(M.sameTeam('', 'Arsenal'), false);
});

const CSV = [
  'Div,Date,Time,HomeTeam,AwayTeam,Referee,B365H,B365D,B365A,PPH,PPD,PPA,MaxH,MaxD,MaxA,AvgH,AvgD,AvgA,Avg>2.5,Avg<2.5,AHh',
  'E1,24/11/2026,19:45,Cardiff,Preston,D Webb,1.48,4.5,6.25,1.44,4.75,5.5,1.52,5.2,6.2,1.47,4.75,5.66,2.1,1.75,-1.25',
  'E1,24/11/2026,20:00,Wolves,Derby,J Busby,1.3,4.75,10,1.25,5.5,11,1.32,5.9,12.5,1.3,5.29,9.47,1.67,2.2,-1.5',
  'E0,28/11/2026,15:00,Man City,Man United,M Oliver,1.6,4.2,5,1.58,4.3,5.2,1.65,4.5,5.4,1.6,4.2,5,1.7,2.1,-1',
  'E0,28/11/2026,15:00,Man United,Man City,M Oliver,4,3.8,1.9,4,3.9,1.9,4.1,4,2,3.9,3.8,1.9,1.8,2,0.5',
].join('\n');

test('parseCsv: lee cabeceras, filas y BOM', () => {
  const rows = M.parseCsv('\uFEFF' + CSV);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].HomeTeam, 'Cardiff');
  assert.equal(rows[1].PPH, '1.25');
});

test('devig: las probabilidades suman 1 y se descartan cuotas invalidas', () => {
  const p = M.devig([2.0, 3.5, 4.0]);
  close(p[0] + p[1] + p[2], 1);
  assert.ok(p[0] > p[1] && p[1] > p[2]);
  assert.equal(M.devig([2.0, null, 4]), null);
  assert.equal(M.devig([1.0, 2, 3]), null);
});

test('findFixture: encuentra el partido por liga y por orden local/visitante', () => {
  const rows = M.parseCsv(CSV);
  const r = M.findFixture(rows, 'ELC', 'Cardiff City FC', 'Preston North End FC');
  assert.equal(r.Referee, 'D Webb');
  // el mismo cruce al reves es OTRO partido: no debe confundirse
  const rev = M.findFixture(rows, 'PL', 'Manchester United FC', 'Manchester City FC');
  assert.equal(rev.AHh, '0.5');
  const fwd = M.findFixture(rows, 'PL', 'Manchester City FC', 'Manchester United FC');
  assert.equal(fwd.AHh, '-1');
});

test('findFixture: sin coincidencia clara o liga sin cuotas devuelve null', () => {
  const rows = M.parseCsv(CSV);
  assert.equal(M.findFixture(rows, 'ELC', 'Cardiff City FC', 'Swansea City AFC'), null);
  assert.equal(M.findFixture(rows, 'BSA', 'Flamengo', 'Palmeiras'), null);
  assert.equal(M.findFixture(rows, 'PL', 'Arsenal FC', 'Chelsea FC'), null);
});

test('summarizeRow: usa Pinnacle como referencia, y el promedio si falta', () => {
  const rows = M.parseCsv(CSV);
  const s = M.summarizeRow(rows[0]);
  assert.equal(s.reference, 'Pinnacle');
  close(s.probs.home + s.probs.draw + s.probs.away, 1);
  assert.ok(s.probs.home > 0.6);
  assert.equal(s.referee, 'D Webb');
  assert.equal(s.asianHandicap.line, -1.25);
  close(s.over25.over + s.over25.under, 1);
  const noPin = M.summarizeRow({ ...rows[0], PPH: '', PPD: '', PPA: '' });
  assert.equal(noPin.reference, 'promedio del mercado');
  assert.equal(M.summarizeRow({ ...rows[0], AHh: '0' }).asianHandicap.line, 0);
  const none = M.summarizeRow({ Date: 'x', Time: 'y' });
  assert.equal(none.probs, null);
  assert.match(s.note, /no son en tiempo real/);
});

test('getMarketFor con CSV simulado: encontrado, no encontrado y fallo de red', async () => {
  M._resetForTests();
  const saved = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => CSV });
  try {
    const hit = await M.getMarketFor('ELC', 'Wolverhampton Wanderers FC', 'Derby County FC');
    assert.equal(hit.found, true);
    assert.equal(hit.market.referee, 'J Busby');
    const miss = await M.getMarketFor('PL', 'Arsenal FC', 'Chelsea FC');
    assert.equal(miss.found, false);
    assert.equal((await M.getMarketFor('CL', 'A', 'B')).reason, 'liga-sin-cuotas');
  } finally {
    globalThis.fetch = saved;
  }
  M._resetForTests();
  globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => '' });
  try {
    await assert.rejects(() => M.getMarketFor('PL', 'Arsenal FC', 'Chelsea FC'), /503/);
  } finally {
    globalThis.fetch = saved;
  }
});
