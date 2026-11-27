import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../server/services/euroCups.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} no es ~${b}`);

test('devig3: suma 1, respeta el orden y rechaza cuotas invalidas', () => {
  const p = E.devig3(2.0, 3.4, 4.0);
  close(p.home + p.draw + p.away, 1);
  assert.ok(p.home > p.draw && p.draw > p.away);
  assert.equal(E.devig3(2, 3, 1), null);
  assert.equal(E.devig3(2, null, 4), null);
});

test('zoneOf: 1-8 directo, 9-24 eliminatoria previa, 25+ fuera', () => {
  assert.equal(E.zoneOf(1), 'directo');
  assert.equal(E.zoneOf(8), 'directo');
  assert.equal(E.zoneOf(9), 'playoff');
  assert.equal(E.zoneOf(24), 'playoff');
  assert.equal(E.zoneOf(25), 'fuera');
  assert.equal(E.zoneOf(36), 'fuera');
});

const scoreboard = {
  events: [
    {
      id: '1', date: '2026-11-27T20:00Z', status: { type: { state: 'pre', shortDetail: '3:00 PM' } },
      competitions: [{
        competitors: [
          { homeAway: 'home', team: { id: '10', displayName: 'AS Roma', abbreviation: 'ROM' }, score: '0' },
          { homeAway: 'away', team: { id: '20', displayName: 'Ajax', abbreviation: 'AJA' }, score: '0' },
        ],
        odds: [{ provider: { name: 'ESPN BET' }, overUnder: 2.5, homeTeamOdds: { moneyLine: -120 }, drawOdds: { moneyLine: 260 }, awayTeamOdds: { moneyLine: 330 } }],
      }],
    },
    {
      id: '2', date: '2026-11-20T20:00Z', status: { type: { state: 'post' } },
      competitions: [{ competitors: [
        { homeAway: 'home', team: { id: '30', displayName: 'Lille' }, score: '2' },
        { homeAway: 'away', team: { id: '40', displayName: 'Celtic' }, score: '1' },
      ] }],
    },
    { id: 'roto', competitions: [] },
  ],
};

test('parseScoreboard: partidos, estado, marcador y cuotas de tres opciones', () => {
  const g = E.parseScoreboard(scoreboard);
  assert.equal(g.length, 2); // el evento roto se ignora
  const pre = g.find((x) => x.id === '1');
  assert.equal(pre.home.name, 'AS Roma');
  assert.equal(pre.market.overUnder, 2.5);
  close(pre.market.probs.home + pre.market.probs.draw + pre.market.probs.away, 1);
  assert.ok(pre.market.probs.home > pre.market.probs.away);
  const post = g.find((x) => x.id === '2');
  assert.equal(post.home.score, 2);
  assert.equal(post.market, null);
  // ordenados por fecha
  assert.equal(g[0].id, '2');
});

test('parseScoreboard: vacio o nulo no rompe; cuotas incompletas no inventan probabilidades', () => {
  assert.deepEqual(E.parseScoreboard({}), []);
  assert.deepEqual(E.parseScoreboard(null), []);
  const partial = JSON.parse(JSON.stringify(scoreboard));
  delete partial.events[0].competitions[0].odds[0].drawOdds;
  assert.equal(E.parseScoreboard(partial).find((x) => x.id === '1').market.probs, null);
});

const standings = {
  children: [{
    standings: { entries: [
      { team: { id: '2', displayName: 'Beta' }, stats: [{ name: 'gamesPlayed', value: 4 }, { name: 'wins', value: 2 }, { name: 'ties', value: 1 }, { name: 'losses', value: 1 }, { name: 'pointsFor', value: 6 }, { name: 'pointsAgainst', value: 4 }, { name: 'points', value: 7 }] },
      { team: { id: '1', displayName: 'Alfa' }, stats: [{ name: 'gamesPlayed', value: 4 }, { name: 'wins', value: 3 }, { name: 'ties', value: 1 }, { name: 'losses', value: 0 }, { name: 'pointsFor', value: 8 }, { name: 'pointsAgainst', value: 2 }, { name: 'points', value: 10 }] },
    ] },
  }],
};

test('parseStandings: ordena por puntos, calcula la diferencia y asigna zona', () => {
  const t = E.parseStandings(standings);
  assert.equal(t.length, 2);
  assert.equal(t[0].team.name, 'Alfa');
  assert.equal(t[0].rank, 1);
  assert.equal(t[0].gd, 6);
  assert.equal(t[0].zone, 'directo');
  assert.equal(t[1].d, 1);
  assert.deepEqual(E.parseStandings({}), []);
});

test('getCompetition con ESPN simulado: junta tabla y partidos', async () => {
  E._clearCacheForTests();
  const saved = globalThis.fetch;
  globalThis.fetch = async (url) => ({ ok: true, status: 200, json: async () => (String(url).includes('standings') ? standings : scoreboard) });
  try {
    const r = await E.getCompetition('el', Date.parse('2026-11-25T12:00:00Z'));
    assert.equal(r.competition.slug, 'uefa.europa');
    assert.equal(r.standings.length, 2);
    assert.equal(r.upcoming.length, 1);
    assert.equal(r.recent.length, 1);
    assert.equal(await E.getCompetition('nope'), null);
    assert.equal(E.COMPETITIONS.uecl.slug, 'uefa.europa.conf');
  } finally {
    globalThis.fetch = saved;
  }
});

test('si una parte de ESPN falla, la otra se sigue mostrando', async () => {
  E._clearCacheForTests();
  const saved = globalThis.fetch;
  globalThis.fetch = async (url) => (String(url).includes('standings')
    ? { ok: false, status: 404, json: async () => ({}) }
    : { ok: true, status: 200, json: async () => scoreboard });
  try {
    const r = await E.getCompetition('uecl');
    assert.equal(r.standings.length, 0);
    assert.match(r.standingsError, /404/);
    assert.equal(r.upcoming.length, 1);
    assert.equal(r.matchesError, null);
  } finally {
    globalThis.fetch = saved;
  }
});
