#!/usr/bin/env node
/**
 * BACKTEST CONTRA EL MERCADO (cuotas reales)
 * ==================================================================
 * Responde la pregunta que importa: ¿el modelo sabe algo que el mercado
 * no sabe? Acertar mucho no basta: si las casas ya incorporan esa
 * informacion en sus cuotas, apostar no da ganancia.
 *
 * Datos: CSV gratuitos de football-data.co.uk (resultados + cuotas de
 * apertura y de cierre). Sin clave, sin red: se leen de una carpeta.
 *
 * Es walk-forward: cada partido se predice con lo ocurrido ANTES de el.
 * Ademas se comparan las probabilidades del modelo con las de Pinnacle al
 * cierre (el mercado mas eficiente) sobre los MISMOS partidos.
 *
 * Uso:
 *   node scripts/backtest-market.mjs <carpeta-temporada-1> <carpeta-temporada-2> ...
 *   (carpetas en orden cronologico; cada una con E0.csv, SP1.csv, ...)
 *   --json salida.json   guarda el resumen
 */
import fs from 'fs';
import path from 'path';
import { calculateMatchPrediction } from '../server/services/predictorEngine.js';
import { getLeagueProfile } from '../server/services/leagueProfiles.js';
import { gradePick } from '../server/services/backtest.js';

const args = process.argv.slice(2);
const dumpIdx = args.indexOf('--dump');
const dumpOut = dumpIdx >= 0 ? args[dumpIdx + 1] : null;
const jsonIdx = args.indexOf('--json');
const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;
const valueIdx = new Set([jsonIdx, dumpIdx].filter((i) => i >= 0).map((i) => i + 1));
const dirs = args.filter((a, i) => !a.startsWith('--') && !valueIdx.has(i));
if (dirs.length === 0) {
  console.error('Uso: node scripts/backtest-market.mjs <carpeta-temporada> [...] [--json salida.json]');
  process.exit(1);
}

// Codigo de football-data.co.uk -> id de liga del proyecto
const LEAGUES = { E0: 'PL', SP1: 'PD', I1: 'SA', D1: 'BL1', F1: 'FL1', N1: 'DED', P1: 'PPL', E1: 'ELC' };
const START_ELO = 1500;
const HOME_ADV_ELO = 60;
const MIN_SEASON_PLAYED = 4; // partidos de la temporada antes de predecir
const MIN_HISTORY = 8; // partidos totales (entre temporadas) antes de predecir

/* ───────────── lectura de CSV ───────────── */
function parseCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(',');
  return lines.slice(1).map((l) => {
    const cells = l.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}
const n = (v) => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : null;
};
function parseDate(d, t) {
  const [dd, mm, yy] = (d || '').split('/');
  if (!dd || !mm || !yy) return null;
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
  const [hh, mi] = (t || '15:00').split(':');
  return new Date(Date.UTC(year, Number(mm) - 1, Number(dd), Number(hh) || 15, Number(mi) || 0)).toISOString();
}

/* ───────────── estado walk-forward (igual que scripts/backtest.mjs) ───────────── */
function createState() {
  return { teams: new Map(), elo: new Map() };
}
function team(state, id, name) {
  if (!state.teams.has(id)) {
    state.teams.set(id, { id, name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, matches: [] });
    state.elo.set(id, START_ELO);
  }
  return state.teams.get(id);
}
function newSeason(state) {
  for (const t of state.teams.values()) {
    t.played = t.won = t.drawn = t.lost = t.goalsFor = t.goalsAgainst = t.points = 0;
  }
}
function standingsSnapshot(state) {
  const rows = [...state.teams.values()].filter((t) => t.played > 0).sort(
    (a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
  );
  rows.forEach((t, i) => { t.position = i + 1; });
  for (const t of state.teams.values()) if (t.played === 0) t.position = rows.length + 1;
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
      gf += weight * m.gf; ga += weight * m.ga; w += weight;
    }
    return w > 0 ? { gf: gf / w, ga: ga / w, samples: list.length } : null;
  };
  const all = acc(t.matches);
  const home = acc(t.matches.filter((m) => m.isHome));
  const away = acc(t.matches.filter((m) => !m.isHome));
  const recent = [...t.matches].slice(-5).reverse();
  return {
    known: true, count: t.matches.length, matches: t.matches, form: recent.map((m) => m.result),
    lastMatchDate: t.matches[t.matches.length - 1].date,
    attack: { overall: all.gf, home: home && home.samples >= 4 ? home.gf : all.gf, away: away && away.samples >= 4 ? away.gf : all.gf },
    defense: { overall: all.ga, home: home && home.samples >= 4 ? home.ga : all.ga, away: away && away.samples >= 4 ? away.ga : all.ga },
  };
}
function updateAfter(state, m, leagueId) {
  const { hg, ag } = m;
  const h = team(state, m.homeId, m.home);
  const a = team(state, m.awayId, m.away);
  h.played++; a.played++;
  h.goalsFor += hg; h.goalsAgainst += ag; a.goalsFor += ag; a.goalsAgainst += hg;
  if (hg > ag) { h.won++; a.lost++; h.points += 3; }
  else if (hg === ag) { h.drawn++; a.drawn++; h.points++; a.points++; }
  else { a.won++; h.lost++; a.points += 3; }
  h.matches.push({ date: m.date, isHome: true, gf: hg, ga: ag, result: hg > ag ? 'W' : hg === ag ? 'D' : 'L', opponentId: a.id, competition: leagueId });
  a.matches.push({ date: m.date, isHome: false, gf: ag, ga: hg, result: ag > hg ? 'W' : hg === ag ? 'D' : 'L', opponentId: h.id, competition: leagueId });
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

/* ───────────── mercado ───────────── */
/** Quita el margen de la casa (normalizacion proporcional). */
function devig(odds) {
  if (odds.some((o) => !o || o <= 1)) return null;
  const inv = odds.map((o) => 1 / o);
  const s = inv.reduce((a, b) => a + b, 0);
  return inv.map((x) => x / s);
}
const pick = (row, ...cols) => {
  for (const c of cols) { const v = n(row[c]); if (v) return v; }
  return null;
};

/* ───────────── recorrido ───────────── */
const records = []; // un registro por partido predicho
const idMaps = {};
for (const [code, leagueId] of Object.entries(LEAGUES)) {
  const state = createState();
  const profile = getLeagueProfile(leagueId);
  idMaps[leagueId] = new Map();
  const idOf = (name) => {
    const m = idMaps[leagueId];
    if (!m.has(name)) m.set(name, m.size + 1);
    return m.get(name);
  };

  for (let s = 0; s < dirs.length; s++) {
    const file = path.join(dirs[s], `${code}.csv`);
    if (!fs.existsSync(file)) continue;
    const matches = parseCsv(file)
      .map((r) => ({
        row: r, date: parseDate(r.Date, r.Time), home: r.HomeTeam, away: r.AwayTeam,
        hg: n(r.FTHG), ag: n(r.FTAG),
      }))
      .filter((m) => m.date && m.home && m.away && m.hg !== null && m.ag !== null)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (s > 0) newSeason(state);

    for (const m of matches) {
      m.homeId = idOf(m.home);
      m.awayId = idOf(m.away);
      const hPrev = state.teams.get(m.homeId);
      const aPrev = state.teams.get(m.awayId);

      if (
        hPrev && aPrev &&
        hPrev.played >= MIN_SEASON_PLAYED && aPrev.played >= MIN_SEASON_PLAYED &&
        hPrev.matches.length >= MIN_HISTORY && aPrev.matches.length >= MIN_HISTORY
      ) {
        standingsSnapshot(state);
        const snap = (t) => ({
          id: t.id, name: t.name, shortName: t.name.slice(0, 12), position: t.position,
          played: t.played, won: t.won, drawn: t.drawn, lost: t.lost,
          goalsFor: t.goalsFor, goalsAgainst: t.goalsAgainst, points: t.points, form: [], lastMatchDate: null,
        });
        const eloOf = (id) => ({ elo: Math.round(state.elo.get(id)), matches: state.teams.get(id).matches.length, confidence: Math.min(1, state.teams.get(id).matches.length / 20), known: true });
        try {
          const pred = calculateMatchPrediction(snap(hPrev), snap(aPrev), [], null, null, {
            leagueId, isLiveData: true, skipMonteCarlo: true, now: new Date(m.date).getTime(),
            homeHistory: historyOf(state, m.homeId, profile.goalsPerTeam),
            awayHistory: historyOf(state, m.awayId, profile.goalsPerTeam),
            homeRating: eloOf(m.homeId), awayRating: eloOf(m.awayId),
          });
          const r = m.row;
          const pr = pred.probabilities;
          const sec = pred.probabilitiesSecondary;
          const picks = [];
          for (const tier of ['safe', 'medium', 'risky']) {
            for (const pk of pred.matchPicks?.[tier] || []) {
              const hit = gradePick(pk.settle, m.hg, m.ag);
              if (hit === null || hit === undefined) continue;
              picks.push({ p: pk.probability, type: pk.marketType, tier, hit: hit ? 1 : 0 });
            }
          }
          records.push({
            picks, goalsModel: pred.model?.goals || 'v1',
            leagueId, season: s, date: m.date, hg: m.hg, ag: m.ag,
            model: { h: pr.homeWin / 100, d: pr.draw / 100, a: pr.awayWin / 100, over: sec.over25 / 100, under: sec.under25 / 100 },
            // Probabilidades justas (sin margen) del cierre de Pinnacle y del promedio
            closePin: devig([pick(r, 'PSCH'), pick(r, 'PSCD'), pick(r, 'PSCA')]),
            closeAvg: devig([pick(r, 'AvgCH'), pick(r, 'AvgCD'), pick(r, 'AvgCA')]),
            closePinOU: devig([pick(r, 'PC>2.5'), pick(r, 'PC<2.5')]),
            closeAvgOU: devig([pick(r, 'AvgC>2.5'), pick(r, 'AvgC<2.5')]),
            // Cuotas a las que se podria haber apostado
            open: { h: pick(r, 'B365H'), d: pick(r, 'B365D'), a: pick(r, 'B365A'), over: pick(r, 'B365>2.5'), under: pick(r, 'B365<2.5') },
            best: { h: pick(r, 'MaxH'), d: pick(r, 'MaxD'), a: pick(r, 'MaxA'), over: pick(r, 'Max>2.5'), under: pick(r, 'Max<2.5') },
            pinClose: { h: pick(r, 'PSCH'), d: pick(r, 'PSCD'), a: pick(r, 'PSCA'), over: pick(r, 'PC>2.5'), under: pick(r, 'PC<2.5') },
          });
        } catch {
          /* un partido que falle no tumba el backtest */
        }
      }
      updateAfter(state, m, leagueId);
    }
  }
}

/* ───────────── estadistica ───────────── */
let seed = 12345;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
/** Intervalo bootstrap 95% de la media. */
function bootCI(values, B = 2000) {
  if (values.length < 2) return [NaN, NaN];
  const means = [];
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < values.length; i++) s += values[Math.floor(rand() * values.length)];
    means.push(s / values.length);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(B * 0.025)], means[Math.floor(B * 0.975)]];
}
const f = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : '—');
const pct = (x, d = 1) => (Number.isFinite(x) ? (x * 100).toFixed(d) + '%' : '—');
const sgn = (x, d = 1) => (Number.isFinite(x) ? (x >= 0 ? '+' : '') + (x * 100).toFixed(d) + '%' : '—');

const outcome1x2 = (r) => (r.hg > r.ag ? 0 : r.hg === r.ag ? 1 : 2);
const logloss = (p) => -Math.log(Math.max(1e-6, p));
// Ranked Probability Score 1X2 (penaliza menos errar por poco)
const rps = (p, o) => {
  const c1 = p[0] - (o === 0 ? 1 : 0);
  const c2 = p[0] + p[1] - (o <= 1 ? 1 : 0);
  return (c1 * c1 + c2 * c2) / 2;
};
const brier3 = (p, o) => p.reduce((a, x, i) => a + (x - (i === o ? 1 : 0)) ** 2, 0);

const summary = { partidosPredichos: records.length, comparacion: {}, apuestas: {} };
console.log('='.repeat(78));
console.log('BACKTEST CONTRA EL MERCADO (cuotas reales, walk-forward)');
console.log('='.repeat(78));
console.log(`Partidos predichos sin mirar el futuro: ${records.length}`);
for (const l of [...new Set(records.map((r) => r.leagueId))]) {
  console.log(`   ${l}: ${records.filter((r) => r.leagueId === l).length}`);
}

/* ── 1) ¿Quien predice mejor? modelo vs Pinnacle al cierre ── */
function compare(label, sel, getModel, getMarket, outcomeFn, metrics) {
  const rows = records.filter((r) => getMarket(r) && sel(r));
  if (rows.length === 0) return;
  console.log(`\n${label}  (${rows.length} partidos con cuota de cierre)`);
  const res = {};
  for (const [name, fn] of Object.entries(metrics)) {
    const m = rows.map((r) => fn(getModel(r), outcomeFn(r)));
    const k = rows.map((r) => fn(getMarket(r), outcomeFn(r)));
    const diff = m.map((v, i) => v - k[i]);
    const [lo, hi] = bootCI(diff);
    res[name] = { modelo: mean(m), mercado: mean(k), diff: mean(diff), ic95: [lo, hi] };
    const verdict = lo > 0 ? 'EL MERCADO ES MEJOR (diferencia significativa)' : hi < 0 ? 'EL MODELO ES MEJOR (significativo)' : 'sin diferencia estadisticamente clara';
    console.log(`   ${name.padEnd(9)} modelo ${f(mean(m))}   mercado ${f(mean(k))}   dif ${f(mean(diff))}  IC95 [${f(lo)}, ${f(hi)}]   -> ${verdict}`);
  }
  return res;
}
console.log('\n(Menor = mejor. "dif" = modelo - mercado; si es positiva, el modelo lo hace peor.)');
const m1x2 = { 'logloss': (p, o) => logloss(p[o]), 'RPS': rps, 'Brier': brier3 };
summary.comparacion['1X2 vs Pinnacle'] = compare('1X2 · modelo vs Pinnacle (cierre)', () => true, (r) => [r.model.h, r.model.d, r.model.a], (r) => r.closePin, outcome1x2, m1x2);
summary.comparacion['1X2 vs Promedio'] = compare('1X2 · modelo vs promedio del mercado (cierre)', () => true, (r) => [r.model.h, r.model.d, r.model.a], (r) => r.closeAvg, outcome1x2, m1x2);
const ouOutcome = (r) => (r.hg + r.ag > 2.5 ? 0 : 1);
const mOU = { 'logloss': (p, o) => logloss(p[o]), 'Brier': (p, o) => p.reduce((a, x, i) => a + (x - (i === o ? 1 : 0)) ** 2, 0) };
summary.comparacion['Over/Under 2.5 vs Pinnacle'] = compare('Mas/Menos 2.5 goles · modelo vs Pinnacle (cierre)', () => true, (r) => [r.model.over, r.model.under], (r) => r.closePinOU, ouOutcome, mOU);

/* ── 2) Simulacion de apuestas: 1 unidad plana ── */
function simulate(label, oddsKey, thresholds) {
  console.log(`\n${label}`);
  console.log('   umbral edge   apuestas   acierto    ROI        IC95 del ROI           CLV medio');
  const out = [];
  for (const thr of thresholds) {
    const bets = [];
    for (const r of records) {
      if (!r.closePin) continue;
      const cands = [
        { k: 'h', p: r.model.h, win: r.hg > r.ag, fair: r.closePin[0] },
        { k: 'd', p: r.model.d, win: r.hg === r.ag, fair: r.closePin[1] },
        { k: 'a', p: r.model.a, win: r.hg < r.ag, fair: r.closePin[2] },
      ];
      if (r.closePinOU) {
        cands.push({ k: 'over', p: r.model.over, win: r.hg + r.ag > 2.5, fair: r.closePinOU[0] });
        cands.push({ k: 'under', p: r.model.under, win: r.hg + r.ag < 2.5, fair: r.closePinOU[1] });
      }
      // Solo la mejor opcion por partido (la de mayor edge), si supera el umbral.
      let best = null;
      for (const c of cands) {
        const odds = r[oddsKey][c.k];
        if (!odds) continue;
        const edge = c.p * odds - 1;
        if (edge > thr && (!best || edge > best.edge)) best = { ...c, odds, edge };
      }
      if (best) {
        bets.push({
          profit: best.win ? best.odds - 1 : -1,
          win: best.win,
          // CLV: valor esperado de la cuota tomada frente a la probabilidad justa del cierre
          clv: best.odds * best.fair - 1,
        });
      }
    }
    if (bets.length === 0) { console.log(`   ${('> ' + (thr * 100) + '%').padEnd(12)} sin apuestas`); continue; }
    const profits = bets.map((b) => b.profit);
    const [lo, hi] = bootCI(profits);
    const row = { umbral: thr, apuestas: bets.length, acierto: bets.filter((b) => b.win).length / bets.length, roi: mean(profits), ic95: [lo, hi], clv: mean(bets.map((b) => b.clv)) };
    out.push(row);
    console.log(`   ${('> ' + (thr * 100) + '%').padEnd(12)} ${String(row.apuestas).padStart(8)}   ${pct(row.acierto).padStart(7)}   ${sgn(row.roi).padStart(7)}   [${sgn(lo)}, ${sgn(hi)}]`.padEnd(78) + `${sgn(row.clv)}`);
  }
  return out;
}
console.log('\n' + '-'.repeat(78));
console.log('Apostar 1 unidad cuando el modelo ve ventaja (edge = prob_modelo x cuota - 1).');
console.log('CLV = si la cuota tomada era mejor que la probabilidad justa al cierre (>0 = hay senal real).');
const T = [0, 0.03, 0.05, 0.08, 0.12];
summary.apuestas['cuota apertura Bet365'] = simulate('A) A la cuota de APERTURA de Bet365 (la que habrias podido conseguir)', 'open', T);
summary.apuestas['cuota cierre Pinnacle'] = simulate('B) A la cuota de CIERRE de Pinnacle (el mercado mas duro)', 'pinClose', T);
summary.apuestas['mejor cuota del mercado'] = simulate('C) A la MEJOR cuota disponible entre casas (optimista: pocos la consiguen)', 'best', T);

/* ── 3) Control: apostar a ciegas ── */
const control = [];
for (const r of records) {
  for (const [k, win] of [['h', r.hg > r.ag], ['d', r.hg === r.ag], ['a', r.hg < r.ag]]) {
    if (r.open[k]) control.push(win ? r.open[k] - 1 : -1);
  }
}
console.log(`\nControl: apostar a TODOS los resultados 1X2 a cuota de apertura de Bet365 -> ROI ${sgn(mean(control))}`);
console.log('   (es el "impuesto" del margen de la casa: cualquier estrategia parte de ahi)');
summary.control = mean(control);

/* ── 4) Por temporada ── */
console.log('\nPOR TEMPORADA (1X2, logloss; menor = mejor)');
for (let s = 0; s < dirs.length; s++) {
  const rows = records.filter((r) => r.season === s && r.closePin);
  if (rows.length === 0) continue;
  const m = mean(rows.map((r) => logloss([r.model.h, r.model.d, r.model.a][outcome1x2(r)])));
  const k = mean(rows.map((r) => logloss(r.closePin[outcome1x2(r)])));
  console.log(`   temporada ${s + 1}: ${rows.length} partidos   modelo ${f(m)}   Pinnacle ${f(k)}   dif ${f(m - k)}`);
}

if (dumpOut) fs.writeFileSync(dumpOut, JSON.stringify(records));
if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify(summary, null, 2));
  console.log(`\nResumen guardado en ${jsonOut}`);
}
