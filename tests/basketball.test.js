import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import path from 'path';
import fs from 'fs';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fap-bb-'));
delete process.env.DATABASE_URL;

const B = await import('../server/services/basketball.js');
const { _resetForTests } = await import('../server/services/persistence.js');

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} no es ~${b}`);

test('normCdf: valores conocidos', () => {
  close(B.normCdf(0), 0.5);
  close(B.normCdf(1.96), 0.975, 1e-3);
  close(B.normCdf(-1) + B.normCdf(1), 1, 1e-6);
});

test('cuotas americanas a decimal y devig a dos vias', () => {
  close(B.americanToDecimal('+150'), 2.5);
  close(B.americanToDecimal(-200), 1.5);
  assert.equal(B.americanToDecimal(0), null);
  assert.equal(B.americanToDecimal('abc'), null);
  const [h, a] = B.devigTwoWay(1.5, 2.8); // -200 / +180
  close(h + a, 1);
  assert.ok(h > a);
  assert.equal(B.devigTwoWay(1, 2), null);
});

const scoreboard = {
  events: [
    {
      id: '401', date: '2026-11-20T00:30Z', status: { type: { state: 'pre', shortDetail: '7:30 PM ET' } },
      competitions: [{
        competitors: [
          { homeAway: 'home', team: { id: '2', displayName: 'Boston Celtics', abbreviation: 'BOS', logo: 'x' }, score: '0', records: [{ summary: '12-3' }] },
          { homeAway: 'away', team: { id: '13', displayName: 'Los Angeles Lakers', abbreviation: 'LAL' }, score: '0' },
        ],
        odds: [{ provider: { name: 'ESPN BET' }, details: 'BOS -6.5', overUnder: 224.5, homeTeamOdds: { moneyLine: -260 }, awayTeamOdds: { moneyLine: 215 } }],
      }],
    },
    { id: 'roto', competitions: [] }, // se ignora
    {
      id: '402', date: '2026-11-20T02:00Z', status: { type: { state: 'post' } },
      competitions: [{ competitors: [
        { homeAway: 'home', team: { id: '9', displayName: 'A' }, score: '101' },
        { homeAway: 'away', team: { id: '10', displayName: 'B' }, score: '99' },
      ] }],
    },
  ],
};

test('parseScoreboard: lee equipos, estado, marcador y linea de dinero', () => {
  const g = B.parseScoreboard(scoreboard);
  assert.equal(g.length, 2); // el evento roto se ignora
  assert.equal(g[0].home.abbr, 'BOS');
  assert.equal(g[0].state, 'pre');
  assert.equal(g[0].market.line, 'BOS -6.5');
  assert.equal(g[0].market.overUnder, 224.5);
  close(g[0].market.homeProb + g[0].market.awayProb, 1);
  assert.ok(g[0].market.homeProb > 0.65 && g[0].market.homeProb < 0.72);
  assert.equal(g[1].market, null);
  assert.equal(g[1].home.score, 101);
});

test('parseScoreboard: sin cuotas o respuesta vacia no rompe', () => {
  assert.deepEqual(B.parseScoreboard({}), []);
  assert.deepEqual(B.parseScoreboard(null), []);
});

const standings = {
  children: [
    { standings: { entries: [
      { team: { id: '2', displayName: 'Boston Celtics', abbreviation: 'BOS' }, stats: [{ name: 'wins', value: 12 }, { name: 'losses', value: 3 }, { name: 'avgPointsFor', value: 121 }, { name: 'avgPointsAgainst', value: 108 }] },
      { team: { id: '13', displayName: 'Los Angeles Lakers', abbreviation: 'LAL' }, stats: [{ name: 'wins', value: 7 }, { name: 'losses', value: 8 }, { name: 'avgPointsFor', value: 113 }, { name: 'avgPointsAgainst', value: 114 }] },
    ] } },
    { children: [{ standings: { entries: [
      { team: { id: '5', displayName: 'Sin datos' }, stats: [{ name: 'wins', value: 0 }, { name: 'losses', value: 0 }] },
    ] } }] },
  ],
};

test('parseStandings: lee puntos a favor/en contra y descarta equipos sin datos', () => {
  const t = B.parseStandings(standings);
  assert.equal(t.size, 2);
  assert.equal(t.get('2').pf, 121);
  assert.equal(t.get('13').gp, 15);
});

test('predictGame: el mejor equipo y el local tienen mas probabilidad; suma 1', () => {
  const t = B.parseStandings(standings);
  const lg = B.leagueAverage(t);
  const p = B.predictGame(t.get('2'), t.get('13'), lg);
  close(p.homeProb + p.awayProb, 1);
  assert.ok(p.homeProb > 0.7);
  assert.ok(p.expMargin > 5);
  // Mismo partido con la localia invertida: el local ya no es tan favorito
  const inv = B.predictGame(t.get('13'), t.get('2'), lg);
  assert.ok(inv.homeProb < 0.5);
  assert.ok(p.homeProb > 1 - inv.homeProb, 'jugar en casa suma probabilidad');
  assert.equal(p.limitedData, false);
});

test('predictGame: con pocos partidos se encoge hacia la media y avisa de datos limitados', () => {
  const lg = 112;
  const hot = { gp: 2, pf: 135, pa: 95 };
  const veteran = { gp: 40, pf: 135, pa: 95 };
  const avg = { gp: 20, pf: 112, pa: 112 };
  const a = B.predictGame(hot, avg, lg);
  const b = B.predictGame(veteran, avg, lg);
  assert.ok(a.homeProb < b.homeProb, 'misma racha, menos muestra = menos confianza');
  assert.equal(a.limitedData, true);
  assert.ok(a.dataQuality < 0.2);
});

test('espnDate usa el dia de EE. UU. (un partido a las 00:30 UTC es del dia anterior)', () => {
  assert.equal(B.espnDate(Date.parse('2026-11-20T00:30:00Z')), '20261119');
  assert.equal(B.espnDate(Date.parse('2026-11-20T18:00:00Z')), '20261120');
});

const mkGame = (over = {}) => ({
  id: 'g1', date: new Date(Date.now() + 5 * 3600e3).toISOString(), state: 'pre',
  home: { id: '2', name: 'BOS' }, away: { id: '13', name: 'LAL' },
  model: { homeProb: 0.72, expMargin: 6.5, expTotal: 226, limitedData: false },
  market: { homeProb: 0.7, homeDecimal: 1.42, awayDecimal: 3.0, overUnder: 224.5 },
  ...over,
});

test('recordGames: registra una vez, no registra partidos empezados ni sin modelo', () => {
  _resetForTests();
  assert.equal(B.recordGames([mkGame(), mkGame()]), 1); // duplicado
  assert.equal(B.recordGames([mkGame()]), 0); // ya estaba
  assert.equal(B.recordGames([mkGame({ id: 'g2', state: 'in' })]), 0);
  assert.equal(B.recordGames([mkGame({ id: 'g3', date: new Date(Date.now() + 5 * 60e3).toISOString() })]), 0); // faltan 5 min
  assert.equal(B.recordGames([mkGame({ id: 'g4', model: null })]), 0);
});

test('applyFinal: solo resuelve partidos terminados con marcador', () => {
  const pred = { key: 'x', homeProb: 0.6 };
  assert.equal(B.applyFinal(pred, { state: 'in', home: { score: 50 }, away: { score: 48 } }), false);
  assert.equal(B.applyFinal(pred, { state: 'post', home: { score: null }, away: { score: 1 } }), false);
  assert.equal(B.applyFinal(pred, { state: 'post', home: { score: 101 }, away: { score: 99 } }), true);
  assert.equal(pred.homeWon, true);
  assert.equal(pred.settled, true);
});

const done = (homeProb, homeWon, market = null, extra = {}) => ({
  settled: true, engineVersion: B.BB_ENGINE_VERSION, homeProb, homeWon, market, ...extra,
});

test('informe: Brier y acierto con numeros simples', () => {
  const r = B.buildBasketballReport([done(1, true), done(0, false), done(0.5, true), done(0.5, false)]);
  assert.equal(r.partidos, 4);
  assert.equal(r.brierModelo, 0.125); // (0 + 0 + .25 + .25) / 4
  assert.equal(r.aciertoFavorito, 75); // el 0.5 cuenta como local y acierta 1 de 2
});

test('informe: compara modelo y mercado en los MISMOS partidos', () => {
  const m = { homeProb: 0.7, homeDecimal: 1.4, awayDecimal: 3.2 };
  const r = B.buildBasketballReport([
    done(0.8, true, m), done(0.8, false, m), done(0.6, true), // el ultimo no tiene mercado
  ]);
  assert.equal(r.conMercado, 2);
  // el modelo y el mercado solo se comparan en los 2 partidos con mercado
  assert.equal(r.brierModeloEnConMercado, Number((((0.2 ** 2) + (0.8 ** 2)) / 2).toFixed(4)));
  assert.equal(r.brierMercado, Number((((0.3 ** 2) + (0.7 ** 2)) / 2).toFixed(4)));
});

test('informe: yield simulado solo apuesta con >5% de ventaja y usa la cuota real', () => {
  const m = { homeProb: 0.5, homeDecimal: 2.0, awayDecimal: 2.0 };
  // modelo dice 0.6 local: edge = 0.6*2-1 = 20% -> apuesta local a cuota 2.0
  const r = B.buildBasketballReport([done(0.6, true, m), done(0.6, false, m), done(0.5, true, m)]);
  assert.equal(r.apuestasConVentaja, 2); // el 0.5 no tiene ventaja
  assert.equal(r.yieldSimulado, 0); // +1 y -1
});

test('informe: excluye expirados, pendientes y versiones anteriores; vacio no rompe', () => {
  const r = B.buildBasketballReport([
    done(0.7, true), done(0.7, true, null, { expired: true }),
    { settled: false, homeProb: 0.7 }, { ...done(0.7, true), engineVersion: 0 },
  ]);
  assert.equal(r.partidos, 1);
  assert.equal(r.pendientes, 1);
  const e = B.buildBasketballReport([]);
  assert.equal(e.partidos, 0);
  assert.equal(e.brierModelo, null);
  assert.equal(e.aciertoFavorito, null);
});

test('getUpcoming con ESPN simulado: junta marcador, tabla, modelo y mercado', async () => {
  B._clearCacheForTests();
  const saved = globalThis.fetch;
  globalThis.fetch = async (url) => ({
    ok: true, status: 200,
    json: async () => (String(url).includes('standings') ? standings : scoreboard),
  });
  try {
    const games = await B.getUpcoming(2);
    const g = games.find((x) => x.id === '401');
    assert.ok(g.model.homeProb > 0.7);
    assert.equal(g.market.line, 'BOS -6.5');
    assert.equal(games.filter((x) => x.id === '401').length, 1); // sin duplicados entre dias
  } finally {
    globalThis.fetch = saved;
  }
});

test('si ESPN falla, getUpcoming lanza error en vez de inventar datos', async () => {
  B._clearCacheForTests();
  const saved = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  try {
    await assert.rejects(() => B.getUpcoming(1), /ESPN respondio 503/);
  } finally {
    globalThis.fetch = saved;
  }
});
