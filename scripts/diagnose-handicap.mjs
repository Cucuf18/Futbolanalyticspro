#!/usr/bin/env node
/**
 * DIAGNOSTICO DEL HANDICAP
 * ==================================================================
 * El handicap decia 64% de cubrir y se cumplia el 19%. La matematica de
 * la funcion es correcta (verificada con marcadores fijos), asi que la
 * sospecha es que el xG del modelo se dispara en los cruces desiguales:
 * si el motor cree que el local marcara 4.5 goles, dara por muy probable
 * una victoria por 3+, y eso casi nunca ocurre.
 *
 * Aqui se compara, sobre partidos reales, el xG predicho con los goles
 * que se marcaron de verdad, por tramos.
 *
 *   node scripts/diagnose-handicap.mjs
 */

import dotenv from 'dotenv';
import { config } from '../server/config.js';
import { calculateMatchPrediction } from '../server/services/predictorEngine.js';

dotenv.config();

const MIN_PRIOR = 6;
const LEAGUES = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'DED', 'PPL', 'ELC', 'BSA'];
const START_ELO = 1500;
const HOME_ADV_ELO = 60;

async function fetchMatches(leagueId) {
  const dateTo = new Date().toISOString().slice(0, 10);
  const dateFrom = new Date(Date.now() - 430 * 86400000).toISOString().slice(0, 10);
  const res = await fetch(
    `${config.footballApiBaseUrl}/competitions/${leagueId}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`,
    { headers: { 'X-Auth-Token': config.footballApiKey } }
  );
  if (!res.ok) return [];
  return ((await res.json()).matches || [])
    .filter((m) => typeof m.score?.fullTime?.home === 'number')
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
}

const state = { teams: new Map(), elo: new Map() };
const team = (id, name) => {
  if (!state.teams.has(id)) {
    state.teams.set(id, { id, name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, matches: [] });
    state.elo.set(id, START_ELO);
  }
  return state.teams.get(id);
};
function historyOf(id) {
  const t = state.teams.get(id);
  if (!t || t.matches.length === 0) return null;
  const now = new Date(t.matches[t.matches.length - 1].date).getTime();
  const acc = (list) => {
    let gf = 0, ga = 0, w = 0;
    for (const m of list) {
      const wt = Math.pow(0.5, Math.max(0, (now - new Date(m.date).getTime()) / 86400000) / 150);
      gf += wt * m.gf; ga += wt * m.ga; w += wt;
    }
    return w > 0 ? { gf: gf / w, ga: ga / w, samples: list.length } : null;
  };
  const all = acc(t.matches);
  const hm = acc(t.matches.filter((m) => m.isHome));
  const aw = acc(t.matches.filter((m) => !m.isHome));
  return {
    known: true, count: t.matches.length, matches: t.matches,
    form: [...t.matches].slice(-5).reverse().map((m) => m.result),
    lastMatchDate: t.matches[t.matches.length - 1].date,
    attack: { overall: all.gf, home: hm && hm.samples >= 4 ? hm.gf : all.gf, away: aw && aw.samples >= 4 ? aw.gf : all.gf },
    defense: { overall: all.ga, home: hm && hm.samples >= 4 ? hm.ga : all.ga, away: aw && aw.samples >= 4 ? aw.ga : all.ga },
  };
}

const rows = [];

for (const leagueId of LEAGUES) {
  const matches = await fetchMatches(leagueId);
  process.stdout.write(`${leagueId} `);
  state.teams.clear(); state.elo.clear();

  for (const m of matches) {
    const h = state.teams.get(m.homeTeam.id);
    const a = state.teams.get(m.awayTeam.id);
    if (h && a && h.played >= MIN_PRIOR && a.played >= MIN_PRIOR) {
      const ordered = [...state.teams.values()].sort((x, y) => y.points - x.points || (y.goalsFor - y.goalsAgainst) - (x.goalsFor - x.goalsAgainst));
      ordered.forEach((t, i) => { t.position = i + 1; });
      const snap = (t) => ({ id: t.id, name: t.name, shortName: t.name.slice(0, 10), position: t.position, played: t.played, won: t.won, drawn: t.drawn, lost: t.lost, goalsFor: t.goalsFor, goalsAgainst: t.goalsAgainst, points: t.points, form: [], lastMatchDate: null });
      const eloOf = (id) => ({ elo: Math.round(state.elo.get(id)), matches: state.teams.get(id).played, confidence: Math.min(1, state.teams.get(id).played / 20), known: true });
      try {
        const p = calculateMatchPrediction(snap(h), snap(a), [], null, null, {
          leagueId, isLiveData: true, skipMonteCarlo: true,
          homeHistory: historyOf(h.id), awayHistory: historyOf(a.id),
          homeRating: eloOf(h.id), awayRating: eloOf(a.id),
        });
        rows.push({
          xgH: p.expectedGoals.home, xgA: p.expectedGoals.away,
          gH: m.score.fullTime.home, gA: m.score.fullTime.away,
          ahLine: p.asianHandicap.line, ahHomeProb: p.asianHandicap.homeProb,
        });
      } catch { /* ignorar */ }
    }
    const hg = m.score.fullTime.home, ag = m.score.fullTime.away;
    const H = team(m.homeTeam.id, m.homeTeam.name), A = team(m.awayTeam.id, m.awayTeam.name);
    H.played++; A.played++; H.goalsFor += hg; H.goalsAgainst += ag; A.goalsFor += ag; A.goalsAgainst += hg;
    if (hg > ag) { H.won++; A.lost++; H.points += 3; } else if (hg === ag) { H.drawn++; A.drawn++; H.points++; A.points++; } else { A.won++; H.lost++; A.points += 3; }
    H.matches.push({ date: m.utcDate, isHome: true, gf: hg, ga: ag, result: hg > ag ? 'W' : hg === ag ? 'D' : 'L', opponentId: A.id, competition: leagueId });
    A.matches.push({ date: m.utcDate, isHome: false, gf: ag, ga: hg, result: ag > hg ? 'W' : hg === ag ? 'D' : 'L', opponentId: H.id, competition: leagueId });
    const eh = state.elo.get(H.id), ea = state.elo.get(A.id);
    const exp = 1 / (1 + Math.pow(10, (ea - (eh + HOME_ADV_ELO)) / 400));
    const gd = Math.abs(hg - ag);
    const mult = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
    state.elo.set(H.id, eh + 24 * mult * ((hg > ag ? 1 : hg === ag ? 0.5 : 0) - exp));
    state.elo.set(A.id, ea - 24 * mult * ((hg > ag ? 1 : hg === ag ? 0.5 : 0) - exp));
  }
  await new Promise((r) => setTimeout(r, 7000));
}

console.log(`\n\nPartidos: ${rows.length}\n`);

console.log('¿ESTA INFLADO EL xG? (goles predichos frente a goles reales)');
console.log('  tramo de xG local      n    xG dice   marco de verdad   error');
for (const [lo, hi] of [[0, 1], [1, 1.5], [1.5, 2], [2, 2.5], [2.5, 3], [3, 9]]) {
  const list = rows.filter((r) => r.xgH >= lo && r.xgH < hi);
  if (list.length < 20) continue;
  const pred = list.reduce((a, r) => a + r.xgH, 0) / list.length;
  const real = list.reduce((a, r) => a + r.gH, 0) / list.length;
  console.log(`  ${(lo + '-' + (hi === 9 ? '+' : hi)).padEnd(20)} ${String(list.length).padStart(5)}   ${pred.toFixed(2).padStart(6)}   ${real.toFixed(2).padStart(14)}   ${(pred - real >= 0 ? '+' : '') + (pred - real).toFixed(2)}`);
}

console.log('\n¿ACIERTA LA DIFERENCIA DE GOLES?');
console.log('  diferencia de xG       n   predicha   real       error');
for (const [lo, hi] of [[-9, -1], [-1, -0.5], [-0.5, 0.5], [0.5, 1], [1, 1.5], [1.5, 2], [2, 9]]) {
  const list = rows.filter((r) => r.xgH - r.xgA >= lo && r.xgH - r.xgA < hi);
  if (list.length < 20) continue;
  const pred = list.reduce((a, r) => a + (r.xgH - r.xgA), 0) / list.length;
  const real = list.reduce((a, r) => a + (r.gH - r.gA), 0) / list.length;
  console.log(`  ${(lo + ' a ' + hi).padEnd(20)} ${String(list.length).padStart(5)}   ${pred.toFixed(2).padStart(7)}   ${real.toFixed(2).padStart(5)}   ${(pred - real >= 0 ? '+' : '') + (pred - real).toFixed(2)}`);
}

console.log('\nEL HANDICAP EN LA PRACTICA');
const covered = (r) => (r.gH + r.ahLine > r.gA ? 1 : r.gH + r.ahLine < r.gA ? 0 : null);
for (const [lo, hi] of [[0, 45], [45, 55], [55, 65], [65, 101]]) {
  const list = rows.filter((r) => r.ahHomeProb >= lo && r.ahHomeProb < hi);
  const g = list.map(covered).filter((x) => x !== null);
  if (g.length < 20) continue;
  const real = (g.reduce((a, b) => a + b, 0) / g.length) * 100;
  const pred = list.reduce((a, r) => a + r.ahHomeProb, 0) / list.length;
  console.log(`  dice ${lo}-${hi}%: cubre de verdad ${real.toFixed(1)}% (decia ${pred.toFixed(1)}%, n=${g.length})`);
}

console.log('\nLINEAS ELEGIDAS');
const byLine = {};
for (const r of rows) byLine[r.ahLine] = (byLine[r.ahLine] || 0) + 1;
console.log('  ' + Object.entries(byLine).sort((a, b) => Number(a[0]) - Number(b[0])).map(([l, c]) => `${l}:${c}`).join('  '));
