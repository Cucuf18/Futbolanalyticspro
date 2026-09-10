#!/usr/bin/env node
/**
 * BACKTEST WALK-FORWARD
 * ==================================================================
 * Mide el acierto real del motor sobre partidos ya jugados, SIN mirar el
 * futuro: para cada partido se predice usando unicamente lo que habia
 * ocurrido antes de ese partido, y despues se compara con el resultado.
 *
 * Es la diferencia entre "mi modelo acierta el 80%" y saberlo de verdad.
 * Un backtest que usa la clasificacion de hoy para predecir un partido de
 * hace tres meses se autoengana: la tabla ya contiene el resultado.
 *
 * Uso:
 *   node scripts/backtest.mjs                 (todas las ligas)
 *   node scripts/backtest.mjs PL              (una liga)
 *   node scripts/backtest.mjs PL PD SA        (varias)
 *   node scripts/backtest.mjs --min 6         (partidos previos minimos)
 */

import dotenv from 'dotenv';
import { config } from '../server/config.js';
import { calculateMatchPrediction } from '../server/services/predictorEngine.js';
import { gradePick } from '../server/services/backtest.js';
import { getLeagueProfile } from '../server/services/leagueProfiles.js';

dotenv.config();

const args = process.argv.slice(2);
const minIdx = args.indexOf('--min');
const MIN_PRIOR_MATCHES = minIdx >= 0 ? Number(args[minIdx + 1]) : 5;
const leagueArgs = args.filter((a) => !a.startsWith('--') && a !== String(MIN_PRIOR_MATCHES));
const LEAGUES = leagueArgs.length
  ? leagueArgs
  : config.supportedLeagues.filter((l) => l.id !== 'CL').map((l) => l.id);

const START_ELO = 1500;
const HOME_ADV_ELO = 60;

// Se recogen ~14 meses para tener una temporada completa por la que
// caminar. Sin esto solo habria las 3 jornadas de la temporada nueva y
// ningun equipo llegaria al minimo de partidos previos.
const LOOKBACK_DAYS = 430;

async function fetchMatches(leagueId) {
  const dateTo = new Date().toISOString().slice(0, 10);
  const dateFrom = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
  const res = await fetch(
    `${config.footballApiBaseUrl}/competitions/${leagueId}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`,
    { headers: { 'X-Auth-Token': config.footballApiKey } }
  );
  if (!res.ok) {
    console.error(`  ${leagueId}: HTTP ${res.status}`);
    return [];
  }
  const json = await res.json();
  return (json.matches || [])
    .filter((m) => typeof m.score?.fullTime?.home === 'number')
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
}

/** Estado incremental de una liga: solo sabe lo ya jugado. */
function createState(leagueId) {
  return { leagueId, teams: new Map(), elo: new Map() };
}

function team(state, id, name) {
  if (!state.teams.has(id)) {
    state.teams.set(id, {
      id, name, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0, matches: [],
    });
    state.elo.set(id, START_ELO);
  }
  return state.teams.get(id);
}

function standingsSnapshot(state) {
  const rows = [...state.teams.values()].sort(
    (a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
  );
  rows.forEach((t, i) => { t.position = i + 1; });
  return rows;
}

function historyOf(state, id, leagueAvg) {
  const t = state.teams.get(id);
  if (!t || t.matches.length === 0) return null;

  const HALFLIFE = 150;
  const now = new Date(t.matches[t.matches.length - 1].date).getTime();
  const acc = (list) => {
    let gf = 0, ga = 0, w = 0;
    for (const m of list) {
      const days = Math.max(0, (now - new Date(m.date).getTime()) / 86400000);
      const weight = Math.pow(0.5, days / HALFLIFE);
      gf += weight * m.gf;
      ga += weight * m.ga;
      w += weight;
    }
    return w > 0 ? { gf: gf / w, ga: ga / w, samples: list.length } : null;
  };

  const all = acc(t.matches);
  const home = acc(t.matches.filter((m) => m.isHome));
  const away = acc(t.matches.filter((m) => !m.isHome));
  const recent = [...t.matches].slice(-5).reverse();

  return {
    known: true,
    count: t.matches.length,
    matches: t.matches,
    form: recent.map((m) => m.result),
    lastMatchDate: t.matches[t.matches.length - 1].date,
    attack: {
      overall: all.gf,
      home: home && home.samples >= 4 ? home.gf : all.gf,
      away: away && away.samples >= 4 ? away.gf : all.gf,
    },
    defense: {
      overall: all.ga,
      home: home && home.samples >= 4 ? home.ga : all.ga,
      away: away && away.samples >= 4 ? away.ga : all.ga,
    },
  };
}

function updateAfter(state, m) {
  const hg = m.score.fullTime.home;
  const ag = m.score.fullTime.away;
  const h = team(state, m.homeTeam.id, m.homeTeam.name);
  const a = team(state, m.awayTeam.id, m.awayTeam.name);

  h.played++; a.played++;
  h.goalsFor += hg; h.goalsAgainst += ag;
  a.goalsFor += ag; a.goalsAgainst += hg;
  if (hg > ag) { h.won++; a.lost++; h.points += 3; }
  else if (hg === ag) { h.drawn++; a.drawn++; h.points++; a.points++; }
  else { a.won++; h.lost++; a.points += 3; }

  h.matches.push({ date: m.utcDate, isHome: true, gf: hg, ga: ag, result: hg > ag ? 'W' : hg === ag ? 'D' : 'L', opponentId: a.id, competition: state.leagueId });
  a.matches.push({ date: m.utcDate, isHome: false, gf: ag, ga: hg, result: ag > hg ? 'W' : hg === ag ? 'D' : 'L', opponentId: h.id, competition: state.leagueId });

  // Elo incremental
  const eh = state.elo.get(h.id);
  const ea = state.elo.get(a.id);
  const expected = 1 / (1 + Math.pow(10, (ea - (eh + HOME_ADV_ELO)) / 400));
  const actual = hg > ag ? 1 : hg === ag ? 0.5 : 0;
  const gd = Math.abs(hg - ag);
  const mult = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
  const delta = 24 * mult * (actual - expected);
  state.elo.set(h.id, eh + delta);
  state.elo.set(a.id, ea - delta);
}

const rows = [];

let leagueIndex = 0;
for (const leagueId of LEAGUES) {
  if (leagueIndex++ > 0) await new Promise((r) => setTimeout(r, 7000));
  process.stdout.write(`Descargando ${leagueId}... `);
  const matches = await fetchMatches(leagueId);
  console.log(`${matches.length} partidos`);
  if (matches.length === 0) continue;

  const state = createState(leagueId);
  const profile = getLeagueProfile(leagueId);
  let predicted = 0;

  for (const m of matches) {
    const hId = m.homeTeam.id;
    const aId = m.awayTeam.id;
    const hPrev = state.teams.get(hId);
    const aPrev = state.teams.get(aId);

    // Solo se predice si ambos equipos ya tienen historial suficiente.
    if (hPrev && aPrev && hPrev.played >= MIN_PRIOR_MATCHES && aPrev.played >= MIN_PRIOR_MATCHES) {
      standingsSnapshot(state);

      const snap = (t) => ({
        id: t.id, name: t.name, shortName: t.name.slice(0, 12), position: t.position,
        played: t.played, won: t.won, drawn: t.drawn, lost: t.lost,
        goalsFor: t.goalsFor, goalsAgainst: t.goalsAgainst, points: t.points,
        form: [], lastMatchDate: null,
      });

      const eloOf = (id) => {
        const e = Math.round(state.elo.get(id));
        const n = state.teams.get(id).played;
        return { elo: e, matches: n, confidence: Math.min(1, n / 20), known: true };
      };

      try {
        const pred = calculateMatchPrediction(
          snap(hPrev), snap(aPrev), [], null, null,
          {
            leagueId,
            isLiveData: true,
            skipMonteCarlo: true,
            homeHistory: historyOf(state, hId, profile.goalsPerTeam),
            awayHistory: historyOf(state, aId, profile.goalsPerTeam),
            homeRating: eloOf(hId),
            awayRating: eloOf(aId),
          }
        );

        const hg = m.score.fullTime.home;
        const ag = m.score.fullTime.away;
        for (const tier of ['safe', 'medium', 'risky']) {
          for (const pick of pred.matchPicks[tier] || []) {
            const hit = gradePick(pick.settle, hg, ag);
            if (hit === null || hit === undefined) continue;
            rows.push({
              leagueId, tier, marketType: pick.marketType,
              probability: pick.probability, odds: pick.marketOdds,
              breakEven: pick.breakEvenOdds, hit,
            });
          }
        }
        predicted++;
      } catch (err) {
        // un partido que falle no debe tumbar el backtest entero
      }
    }

    updateAfter(state, m);
  }
  console.log(`  ${leagueId}: ${predicted} partidos predichos sin mirar el futuro`);
}

/* ── INFORME ────────────────────────────────────────────────────── */

const pct = (n, d) => (d ? (n / d) * 100 : 0);
const tally = (list) => {
  const won = list.filter((r) => r.hit).length;
  const predictedAvg = list.length ? list.reduce((a, r) => a + r.probability, 0) / list.length : 0;
  // Beneficio si se hubiera apostado 1 unidad a cada pick a la cuota estimada.
  const profit = list.reduce((a, r) => a + (r.hit ? r.odds - 1 : -1), 0);
  return {
    n: list.length,
    won,
    hit: pct(won, list.length),
    predicted: predictedAvg,
    gap: predictedAvg - pct(won, list.length),
    roi: list.length ? (profit / list.length) * 100 : 0,
  };
};

const line = (label, t) =>
  `  ${label.padEnd(16)} ${String(t.n).padStart(5)}  ${t.hit.toFixed(1).padStart(6)}%  ${t.predicted.toFixed(1).padStart(6)}%  ${(t.gap >= 0 ? '+' : '') + t.gap.toFixed(1)}`.padEnd(62) +
  `${(t.roi >= 0 ? '+' : '') + t.roi.toFixed(1)}%`;

console.log('\n' + '='.repeat(78));
console.log('RESULTADO DEL BACKTEST WALK-FORWARD');
console.log('='.repeat(78));

if (rows.length === 0) {
  console.log('\nNo se pudo evaluar ningun pick. Comprueba la clave de la API.');
  process.exit(0);
}

const global = tally(rows);
console.log(`\nPicks evaluados: ${global.n}`);
console.log(`Acierto real:    ${global.hit.toFixed(1)}%`);
console.log(`El modelo decia: ${global.predicted.toFixed(1)}%`);
console.log(`Desvio:          ${(global.gap >= 0 ? '+' : '') + global.gap.toFixed(1)} puntos ${global.gap > 3 ? '(SOBRECONFIADO)' : global.gap < -3 ? '(demasiado prudente)' : '(bien calibrado)'}`);
console.log(`ROI a cuota estimada: ${(global.roi >= 0 ? '+' : '') + global.roi.toFixed(1)}%`);

console.log('\nCURVA DE CALIBRACION (lo prometido frente a lo cumplido)');
console.log('  rango             picks  acierto  decia   desvio            ROI');
for (const [lo, hi] of [[50, 60], [60, 65], [65, 70], [70, 75], [75, 80], [80, 86], [86, 101]]) {
  const list = rows.filter((r) => r.probability >= lo && r.probability < hi);
  if (list.length === 0) continue;
  console.log(line(`${lo}-${hi === 101 ? 100 : hi}%`, tally(list)));
}

console.log('\nPOR MERCADO');
console.log('  mercado           picks  acierto  decia   desvio            ROI');
const markets = [...new Set(rows.map((r) => r.marketType))];
for (const mk of markets.sort()) console.log(line(mk, tally(rows.filter((r) => r.marketType === mk))));

console.log('\nPOR NIVEL DE RIESGO');
console.log('  nivel             picks  acierto  decia   desvio            ROI');
for (const t of ['safe', 'medium', 'risky']) {
  const list = rows.filter((r) => r.tier === t);
  if (list.length) console.log(line(t, tally(list)));
}

console.log('\nPOR LIGA');
console.log('  liga              picks  acierto  decia   desvio            ROI');
for (const l of [...new Set(rows.map((r) => r.leagueId))]) {
  console.log(line(l, tally(rows.filter((r) => r.leagueId === l))));
}

console.log('\nNota: solo se evaluan los mercados deducibles del marcador final');
console.log('(resultado, doble oportunidad, goles, ambos anotan, handicap).');
console.log('Corners, tarjetas, faltas, tiros y offsides no se pueden comprobar:');
console.log('ninguna de las dos APIs gratuitas da esas estadisticas por partido.');
