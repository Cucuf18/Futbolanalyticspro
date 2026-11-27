import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import * as G from '../server/services/goalsModelV2.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} no es ~${b}`);
const NOW = Date.parse('2026-11-27T12:00:00Z');
const toMatches = (list) => list.map((m) => ({ date: new Date(NOW - m.daysAgo * 86400000).toISOString(), gf: m.gf, ga: m.ga, competition: 'X' }));

test('PARIDAD con la version de Python del laboratorio (6 casos aleatorios fijos)', () => {
  const cases = JSON.parse(fs.readFileSync(new URL('./goalsV2_parity.json', import.meta.url), 'utf8'));
  for (const c of cases) {
    const r = G.computeLambdas(toMatches(c.home), toMatches(c.away), c.means, NOW);
    close(r.lh, c.lh);
    close(r.la, c.la);
  }
});

test('un equipo promedio contra otro promedio da las medias de la liga', () => {
  const means = G.LEAGUE_GOALS.PL;
  const mu = (means.home + means.away) / 2;
  const avg = Array.from({ length: 30 }, (_, i) => ({ date: new Date(NOW - (i + 1) * 7 * 86400000).toISOString(), gf: mu, ga: mu }));
  const r = G.computeLambdas(avg, avg, means, NOW);
  close(r.lh, means.home, 1e-6);
  close(r.la, means.away, 1e-6);
});

test('mejor ataque contra peor defensa sube los goles esperados; el prior frena a los equipos con poca muestra', () => {
  const means = G.LEAGUE_GOALS.PL;
  const mk = (gf, ga, n) => Array.from({ length: n }, (_, i) => ({ date: new Date(NOW - (i + 1) * 7 * 86400000).toISOString(), gf, ga }));
  const strong = G.computeLambdas(mk(2.5, 0.8, 30), mk(1.0, 2.0, 30), means, NOW);
  const weak = G.computeLambdas(mk(1.0, 2.0, 30), mk(2.5, 0.8, 30), means, NOW);
  assert.ok(strong.lh > weak.lh && strong.la < weak.la);
  const few = G.computeLambdas(mk(2.5, 0.8, 8), mk(1.0, 2.0, 8), means, NOW);
  assert.ok(few.lh < strong.lh, 'con 8 partidos se acerca mas a la media que con 30');
  assert.ok(few.lh > means.home, 'pero sigue siendo mayor que la media');
});

test('los goles esperados siempre quedan acotados', () => {
  const means = G.LEAGUE_GOALS.PL;
  const crazy = Array.from({ length: 30 }, (_, i) => ({ date: new Date(NOW - (i + 1) * 3 * 86400000).toISOString(), gf: 9, ga: 0 }));
  const r = G.computeLambdas(crazy, crazy, means, NOW);
  assert.ok(r.lh <= 4.5 && r.la >= 0.2);
});

test('goalsModelV2: sin historial suficiente devuelve null (el motor usa su camino anterior)', () => {
  const few = { matches: Array.from({ length: 5 }, (_, i) => ({ date: new Date(NOW - i * 86400000).toISOString(), gf: 1, ga: 1, competition: 'PL' })) };
  assert.equal(G.goalsModelV2({ homeHistory: few, awayHistory: few, leagueId: 'PL', now: NOW }), null);
  assert.equal(G.goalsModelV2({ homeHistory: null, awayHistory: undefined, leagueId: 'PL', now: NOW }), null);
});

test('selectMatches: usa los de la liga si hay >= 12; si no, todos; ordenados y con tope', () => {
  const mk = (comp, n, start) => Array.from({ length: n }, (_, i) => ({ date: new Date(NOW - (start + i) * 86400000).toISOString(), gf: 1, ga: 1, competition: comp }));
  const mixed = { matches: [...mk('PL', 14, 100), ...mk('CL', 6, 10)] };
  const onlyLeague = G.selectMatches(mixed, 'PL');
  assert.equal(onlyLeague.length, 14);
  assert.ok(onlyLeague.every((m) => m.competition === 'PL'));
  const fewLeague = { matches: [...mk('PL', 5, 100), ...mk('CL', 10, 10)] };
  assert.equal(G.selectMatches(fewLeague, 'PL').length, 15);
  const sorted = G.selectMatches(mixed, 'PL');
  assert.ok(new Date(sorted[0].date) < new Date(sorted[sorted.length - 1].date));
  assert.equal(G.selectMatches({ matches: mk('PL', 200, 1) }, 'PL').length, G.GOALS_V2.MAX_MATCHES);
});

test('leagueGoalMeans: ligas medidas usan sus datos; las demas, la proporcion tipica', () => {
  assert.equal(G.leagueGoalMeans('PL').home, 1.613);
  const f = G.leagueGoalMeans('BSA', 1.3);
  close((f.home + f.away) / 2, 1.3, 1e-9);
  assert.ok(f.home > f.away);
});
