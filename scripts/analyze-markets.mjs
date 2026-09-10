#!/usr/bin/env node
/**
 * ANALISIS POR TRAMOS DE CONFIANZA
 * ==================================================================
 * El backtest midio que RESULTADO, HANDICAP y BTTS no tenian ventaja
 * y por eso se anularon (k = 0). Pero ese numero es un promedio de
 * TODOS los picks que pasaban el filtro.
 *
 * Aqui se comprueba otra cosa: ¿hay algun TRAMO donde si funcionen?
 * Puede que el modelo no sirva para decidir un partido igualado pero si
 * cuando ve un favorito claro. Si existe ese tramo, en vez de matar el
 * mercado hay que exigirle un umbral mas alto.
 *
 * Se evalua la probabilidad CRUDA del modelo, saltandose el filtro de
 * picks, porque con k = 0 esos picks ya no se generan.
 *
 *   node scripts/analyze-markets.mjs
 */

import dotenv from 'dotenv';
import { config } from '../server/config.js';
import { calculateMatchPrediction } from '../server/services/predictorEngine.js';
import { getLeagueProfile } from '../server/services/leagueProfiles.js';

dotenv.config();

const MIN_PRIOR = 6;
const LEAGUES = config.supportedLeagues.filter((l) => l.id !== 'CL').map((l) => l.id);
const LOOKBACK_DAYS = 430;
const START_ELO = 1500;
const HOME_ADV_ELO = 60;

async function fetchMatches(leagueId) {
  const dateTo = new Date().toISOString().slice(0, 10);
  const dateFrom = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
  const res = await fetch(
    `${config.footballApiBaseUrl}/competitions/${leagueId}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`,
    { headers: { 'X-Auth-Token': config.footballApiKey } }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.matches || [])
    .filter((m) => typeof m.score?.fullTime?.home === 'number')
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
}

const state = { teams: new Map(), elo: new Map() };
function team(id, name) {
  if (!state.teams.has(id)) {
    state.teams.set(id, { id, name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, matches: [] });
    state.elo.set(id, START_ELO);
  }
  return state.teams.get(id);
}
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
  const home = acc(t.matches.filter((m) => m.isHome));
  const away = acc(t.matches.filter((m) => !m.isHome));
  return {
    known: true, count: t.matches.length, matches: t.matches,
    form: [...t.matches].slice(-5).reverse().map((m) => m.result),
    lastMatchDate: t.matches[t.matches.length - 1].date,
    attack: { overall: all.gf, home: home && home.samples >= 4 ? home.gf : all.gf, away: away && away.samples >= 4 ? away.gf : all.gf },
    defense: { overall: all.ga, home: home && home.samples >= 4 ? home.ga : all.ga, away: away && away.samples >= 4 ? away.ga : all.ga },
  };
}

const samples = [];

for (const leagueId of LEAGUES) {
  const matches = await fetchMatches(leagueId);
  process.stdout.write(`${leagueId} `);
  state.teams.clear(); state.elo.clear();
  const profile = getLeagueProfile(leagueId);

  for (const m of matches) {
    const h = state.teams.get(m.homeTeam.id);
    const a = state.teams.get(m.awayTeam.id);

    if (h && a && h.played >= MIN_PRIOR && a.played >= MIN_PRIOR) {
      const rows = [...state.teams.values()].sort((x, y) => y.points - x.points || (y.goalsFor - y.goalsAgainst) - (x.goalsFor - x.goalsAgainst));
      rows.forEach((t, i) => { t.position = i + 1; });
      const snap = (t) => ({ id: t.id, name: t.name, shortName: t.name.slice(0, 10), position: t.position, played: t.played, won: t.won, drawn: t.drawn, lost: t.lost, goalsFor: t.goalsFor, goalsAgainst: t.goalsAgainst, points: t.points, form: [], lastMatchDate: null });
      const eloOf = (id) => ({ elo: Math.round(state.elo.get(id)), matches: state.teams.get(id).played, confidence: Math.min(1, state.teams.get(id).played / 20), known: true });

      try {
        const p = calculateMatchPrediction(snap(h), snap(a), [], null, null, {
          leagueId, isLiveData: true, skipMonteCarlo: true,
          homeHistory: historyOf(h.id), awayHistory: historyOf(a.id),
          homeRating: eloOf(h.id), awayRating: eloOf(a.id),
        });
        const hg = m.score.fullTime.home;
        const ag = m.score.fullTime.away;
        const ah = p.asianHandicap;

        samples.push({
          homeWin: { prob: p.probabilities.homeWin, hit: hg > ag },
          awayWin: { prob: p.probabilities.awayWin, hit: ag > hg },
          dc1x: { prob: p.probabilities.homeWin + p.probabilities.draw, hit: hg >= ag },
          dcx2: { prob: p.probabilities.draw + p.probabilities.awayWin, hit: ag >= hg },
          dc12: { prob: p.probabilities.homeWin + p.probabilities.awayWin, hit: hg !== ag },
          bttsYes: { prob: p.probabilitiesSecondary.btts, hit: hg > 0 && ag > 0 },
          bttsNo: { prob: 100 - p.probabilitiesSecondary.btts, hit: !(hg > 0 && ag > 0) },
          ahHome: { prob: ah.homeProb, hit: hg + ah.line > ag ? true : hg + ah.line < ag ? false : null },
          homeScores: { prob: null, hit: hg > 0 },
          awayScores: { prob: null, hit: ag > 0 },
          homeOver15: { prob: null, hit: hg > 1.5 },
          margin2: { prob: null, hit: Math.abs(hg - ag) >= 2 },
        });
      } catch { /* ignorar */ }
    }

    // actualizar estado
    const hg = m.score.fullTime.home, ag = m.score.fullTime.away;
    const H = team(m.homeTeam.id, m.homeTeam.name), A = team(m.awayTeam.id, m.awayTeam.name);
    H.played++; A.played++;
    H.goalsFor += hg; H.goalsAgainst += ag; A.goalsFor += ag; A.goalsAgainst += hg;
    if (hg > ag) { H.won++; A.lost++; H.points += 3; } else if (hg === ag) { H.drawn++; A.drawn++; H.points++; A.points++; } else { A.won++; H.lost++; A.points += 3; }
    H.matches.push({ date: m.utcDate, isHome: true, gf: hg, ga: ag, result: hg > ag ? 'W' : hg === ag ? 'D' : 'L', opponentId: A.id, competition: leagueId });
    A.matches.push({ date: m.utcDate, isHome: false, gf: ag, ga: hg, result: ag > hg ? 'W' : hg === ag ? 'D' : 'L', opponentId: H.id, competition: leagueId });
    const eh = state.elo.get(H.id), ea = state.elo.get(A.id);
    const exp = 1 / (1 + Math.pow(10, (ea - (eh + HOME_ADV_ELO)) / 400));
    const gd = Math.abs(hg - ag);
    const mult = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
    const delta = 24 * mult * ((hg > ag ? 1 : hg === ag ? 0.5 : 0) - exp);
    state.elo.set(H.id, eh + delta); state.elo.set(A.id, ea - delta);
  }
  await new Promise((r) => setTimeout(r, 7000));
}

console.log(`\n\nPartidos analizados: ${samples.length}\n`);

const MARKETS = [
  ['RESULTADO local', 'homeWin'],
  ['RESULTADO visitante', 'awayWin'],
  ['DOBLE 1X', 'dc1x'],
  ['DOBLE X2', 'dcx2'],
  ['DOBLE 12', 'dc12'],
  ['BTTS si', 'bttsYes'],
  ['BTTS no', 'bttsNo'],
  ['HANDICAP local', 'ahHome'],
];

console.log('ACIERTO POR TRAMO DE CONFIANZA DEL MODELO');
console.log('(el numero entre parentesis es cuantos partidos caen en ese tramo)\n');
console.log('mercado'.padEnd(22) + ['50-60', '60-70', '70-80', '80-90', '90+'].map((x) => x.padStart(14)).join(''));

for (const [label, key] of MARKETS) {
  let row = label.padEnd(22);
  for (const [lo, hi] of [[50, 60], [60, 70], [70, 80], [80, 90], [90, 101]]) {
    const list = samples.map((s) => s[key]).filter((x) => x && x.hit !== null && x.prob >= lo && x.prob < hi);
    if (list.length < 25) { row += '           —  '; continue; }
    const hit = (list.filter((x) => x.hit).length / list.length) * 100;
    const avg = list.reduce((a, x) => a + x.prob, 0) / list.length;
    const gap = avg - hit;
    const mark = gap <= 3 ? '+' : gap <= 8 ? ' ' : '!';
    row += `${hit.toFixed(0)}%/${avg.toFixed(0)}%${mark}(${String(list.length).padStart(4)})`.padStart(14);
  }
  console.log(row);
}

console.log('\n  formato: aciertoReal/loQueDecia  (+ = bien calibrado, ! = sobreconfiado)\n');

console.log('TASA BASE DE MERCADOS DERIVABLES DEL MARCADOR (candidatos a anadir)');
for (const [label, key] of [
  ['El local marca', 'homeScores'],
  ['El visitante marca', 'awayScores'],
  ['El local marca 2+', 'homeOver15'],
  ['Diferencia de 2+ goles', 'margin2'],
]) {
  const list = samples.map((s) => s[key]).filter(Boolean);
  const hit = (list.filter((x) => x.hit).length / list.length) * 100;
  console.log(`  ${label.padEnd(24)} ocurre el ${hit.toFixed(1)}% de las veces`);
}
