import { readBlob, writeBlob } from './persistence.js';
import { wilsonInterval, confidenceLevel } from './backtest.js';

/**
 * BALONCESTO (NBA)
 * ------------------------------------------------------------------
 * Datos: API publica de ESPN. No requiere clave, pero NO es oficial ni
 * esta documentada: puede cambiar sin aviso. Por eso todo el parseo es
 * defensivo y, si falla, la pagina lo dice en lugar de inventar datos.
 *
 * Modelo: deliberadamente simple y transparente. Rating de puntos a
 * favor y en contra por equipo, encogido hacia la media de la liga segun
 * los partidos jugados, mas ventaja de local. NO conoce lesiones, descanso
 * ni viajes, que en la NBA importan. No hay ninguna evidencia de que
 * supere al mercado: el registro de este archivo existe justo para medirlo
 * contra la linea real de las casas.
 */

const BASE = 'https://site.api.espn.com/apis';
const HOME_ADV = 2.5; // puntos de ventaja de local
const SIGMA_MARGIN = 12; // desviacion tipica del margen final en la NBA
const SHRINK_GAMES = 10; // peso de la media de liga = SHRINK/(SHRINK+jugados)
export const BB_ENGINE_VERSION = 1;
const EXPIRE_MS = 10 * 24 * 3600 * 1000;

/* ───────────── matematica ───────────── */
export function normCdf(x) {
  // Aproximacion de Abramowitz-Stegun (error < 1e-7)
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** Cuota americana (+150, -200) a decimal. */
export function americanToDecimal(a) {
  const n = Number(a);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

/** Probabilidades justas de un mercado de dos opciones (quita el margen). */
export function devigTwoWay(oddsA, oddsB) {
  if (!(oddsA > 1) || !(oddsB > 1)) return null;
  const a = 1 / oddsA;
  const b = 1 / oddsB;
  return [a / (a + b), b / (a + b)];
}

/* ───────────── lectura de ESPN (defensiva) ───────────── */
const numOf = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

export function parseMoneyline(odds) {
  // ESPN ha publicado la linea de dinero en varias formas segun la version.
  const home =
    odds?.homeTeamOdds?.moneyLine ?? odds?.moneyline?.home?.close?.odds ?? odds?.moneyline?.home?.open?.odds ?? null;
  const away =
    odds?.awayTeamOdds?.moneyLine ?? odds?.moneyline?.away?.close?.odds ?? odds?.moneyline?.away?.open?.odds ?? null;
  const h = americanToDecimal(String(home).replace('+', ''));
  const a = americanToDecimal(String(away).replace('+', ''));
  return h && a ? { homeDecimal: h, awayDecimal: a } : null;
}

export function parseScoreboard(json) {
  const games = [];
  for (const ev of json?.events || []) {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === 'home');
    const away = comp?.competitors?.find((c) => c.homeAway === 'away');
    if (!ev.id || !home?.team || !away?.team) continue;
    const team = (c) => ({
      id: String(c.team.id),
      name: c.team.displayName || c.team.name,
      abbr: c.team.abbreviation,
      logo: c.team.logo || null,
      score: numOf(c.score),
      record: c.records?.[0]?.summary || null,
    });
    const o = comp.odds?.[0];
    const ml = o ? parseMoneyline(o) : null;
    const fair = ml ? devigTwoWay(ml.homeDecimal, ml.awayDecimal) : null;
    games.push({
      id: String(ev.id),
      date: ev.date,
      state: ev.status?.type?.state || 'pre', // pre | in | post
      detail: ev.status?.type?.shortDetail || ev.status?.type?.description || '',
      home: team(home),
      away: team(away),
      market: o
        ? {
            provider: o.provider?.name || null,
            line: o.details || null, // ej. "BOS -4.5"
            overUnder: numOf(o.overUnder),
            homeDecimal: ml?.homeDecimal ?? null,
            awayDecimal: ml?.awayDecimal ?? null,
            homeProb: fair ? fair[0] : null,
            awayProb: fair ? fair[1] : null,
          }
        : null,
    });
  }
  return games;
}

export function parseStandings(json) {
  const teams = new Map();
  const visit = (node) => {
    for (const e of node?.standings?.entries || []) {
      const stats = {};
      for (const s of e.stats || []) stats[s.name] = numOf(s.value);
      const wins = stats.wins ?? 0;
      const losses = stats.losses ?? 0;
      const gp = wins + losses;
      const pf = stats.avgPointsFor ?? stats.pointsFor / (gp || 1) ?? null;
      const pa = stats.avgPointsAgainst ?? stats.pointsAgainst / (gp || 1) ?? null;
      if (!e.team?.id || !gp || !Number.isFinite(pf) || !Number.isFinite(pa)) continue;
      teams.set(String(e.team.id), {
        id: String(e.team.id),
        name: e.team.displayName || e.team.name,
        abbr: e.team.abbreviation,
        logo: e.team.logos?.[0]?.href || null,
        gp, wins, losses, pf, pa,
      });
    }
    for (const c of node?.children || []) visit(c);
  };
  visit(json);
  return teams;
}

/* ───────────── modelo ───────────── */
export function leagueAverage(teams) {
  const list = [...teams.values()];
  return list.length ? list.reduce((a, t) => a + t.pf, 0) / list.length : null;
}

export function predictGame(home, away, lgAvg) {
  const shrink = (t) => {
    const w = t.gp / (t.gp + SHRINK_GAMES);
    return { pf: w * t.pf + (1 - w) * lgAvg, pa: w * t.pa + (1 - w) * lgAvg };
  };
  const h = shrink(home);
  const a = shrink(away);
  const expHome = (h.pf + a.pa) / 2 + HOME_ADV / 2;
  const expAway = (a.pf + h.pa) / 2 - HOME_ADV / 2;
  const margin = expHome - expAway;
  const homeProb = normCdf(margin / SIGMA_MARGIN);
  const minGp = Math.min(home.gp, away.gp);
  return {
    homeProb,
    awayProb: 1 - homeProb,
    expMargin: margin,
    expTotal: expHome + expAway,
    expHome,
    expAway,
    dataQuality: Math.min(1, minGp / 20),
    limitedData: minGp < 10,
  };
}

/* ───────────── descarga con cache ───────────── */
const cache = new Map();
async function espn(path, ttlMs) {
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.data;
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`ESPN respondio ${res.status}`);
  const data = await res.json();
  cache.set(path, { data, exp: Date.now() + ttlMs });
  return data;
}
export function _clearCacheForTests() {
  cache.clear();
}

/** Fecha en formato ESPN (YYYYMMDD, dia de EE. UU.) para un instante dado. */
export function espnDate(ms) {
  return new Date(ms - 6 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
}

export async function getStandings() {
  return parseStandings(await espn('/v2/sports/basketball/nba/standings', 60 * 60 * 1000));
}
export async function getScoreboard(yyyymmdd) {
  return parseScoreboard(await espn(`/site/v2/sports/basketball/nba/scoreboard?dates=${yyyymmdd}`, 5 * 60 * 1000));
}

/** Partidos de los proximos dias con la prediccion y la linea del mercado. */
export async function getUpcoming(days = 3, now = Date.now()) {
  const dates = Array.from({ length: days }, (_, i) => espnDate(now + i * 86400000));
  const [teams, ...boards] = await Promise.all([getStandings(), ...dates.map((d) => getScoreboard(d))]);
  const lg = leagueAverage(teams);
  const seen = new Set();
  const games = [];
  for (const g of boards.flat()) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    const h = teams.get(g.home.id);
    const a = teams.get(g.away.id);
    games.push({ ...g, model: h && a && lg ? predictGame(h, a, lg) : null });
  }
  return games.sort((x, y) => new Date(x.date) - new Date(y.date));
}

/* ───────────── registro y medicion ───────────── */
function load() {
  const saved = readBlob('bb_predictions');
  return saved && Array.isArray(saved.predictions) ? saved : { predictions: [] };
}
function save(data) {
  data.predictions = data.predictions.slice(-20000);
  return writeBlob('bb_predictions', data);
}

/** Registra la prediccion de los partidos que aun no empezaron. */
export function recordGames(games, now = Date.now()) {
  const data = load();
  let added = 0;
  for (const g of games) {
    if (g.state !== 'pre' || !g.model) continue;
    if (new Date(g.date).getTime() - now < 20 * 60 * 1000) continue; // al menos 20 min antes
    if (data.predictions.some((p) => p.key === g.id)) continue;
    data.predictions.push({
      key: g.id,
      engineVersion: BB_ENGINE_VERSION,
      createdAt: new Date(now).toISOString(),
      kickoff: g.date,
      homeId: g.home.id,
      awayId: g.away.id,
      homeName: g.home.name,
      awayName: g.away.name,
      homeProb: Number(g.model.homeProb.toFixed(4)),
      expMargin: Number(g.model.expMargin.toFixed(2)),
      expTotal: Number(g.model.expTotal.toFixed(1)),
      limitedData: g.model.limitedData,
      market: g.market && g.market.homeProb
        ? {
            homeProb: Number(g.market.homeProb.toFixed(4)),
            homeDecimal: g.market.homeDecimal,
            awayDecimal: g.market.awayDecimal,
            overUnder: g.market.overUnder,
          }
        : null,
      settled: false,
    });
    added++;
  }
  if (added > 0) save(data);
  return added;
}

/** Aplica el resultado real a una prediccion. */
export function applyFinal(pred, game) {
  if (game?.state !== 'post' || game.home.score === null || game.away.score === null) return false;
  pred.settled = true;
  pred.settledAt = new Date().toISOString();
  pred.homeScore = game.home.score;
  pred.awayScore = game.away.score;
  pred.homeWon = game.home.score > game.away.score;
  return true;
}

export async function settleGames(now = Date.now()) {
  const data = load();
  let settled = 0;
  let expired = 0;
  const pending = data.predictions.filter((p) => !p.settled);
  const days = new Map();
  for (const p of pending) {
    const kick = new Date(p.kickoff).getTime();
    if (now - kick > EXPIRE_MS) {
      p.settled = true;
      p.expired = true;
      expired++;
    } else if (now - kick > 3.5 * 3600 * 1000) {
      const d = espnDate(kick);
      if (!days.has(d)) days.set(d, []);
      days.get(d).push(p);
    }
  }
  for (const [d, preds] of days) {
    let board;
    try {
      board = await getScoreboard(d);
    } catch {
      continue;
    }
    for (const p of preds) {
      const g = board.find((x) => x.id === p.key);
      if (g && applyFinal(p, g)) settled++;
    }
  }
  if (settled > 0 || expired > 0) save(data);
  return { pending: pending.length, settled, expired };
}

export async function autoRun() {
  const games = await getUpcoming(3);
  const added = recordGames(games);
  const s = await settleGames();
  return { added, ...s };
}

/** Medicion del modelo frente al mercado, solo con partidos ya jugados. */
export function buildBasketballReport(predictions) {
  const done = predictions.filter((p) => p.settled && !p.expired && p.engineVersion >= BB_ENGINE_VERSION && typeof p.homeWon === 'boolean');
  const n = done.length;
  const brier = (p, won) => (p - (won ? 1 : 0)) ** 2;
  const ll = (p, won) => -Math.log(Math.max(1e-6, won ? p : 1 - p));
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const r = (v, d = 4) => (v === null ? null : Number(v.toFixed(d)));

  const withMkt = done.filter((p) => p.market);
  // Acierto del lado que el modelo favorecia
  const favHits = done.filter((p) => (p.homeProb >= 0.5) === p.homeWon).length;
  // Apostar 1 unidad al lado donde el modelo ve > 5% de ventaja sobre la cuota real
  const bets = [];
  for (const p of withMkt) {
    const cands = [
      { prob: p.homeProb, odds: p.market.homeDecimal, win: p.homeWon },
      { prob: 1 - p.homeProb, odds: p.market.awayDecimal, win: !p.homeWon },
    ].filter((c) => c.odds > 1);
    const best = cands.map((c) => ({ ...c, edge: c.prob * c.odds - 1 })).sort((a, b) => b.edge - a.edge)[0];
    if (best && best.edge > 0.05) bets.push(best.win ? best.odds - 1 : -1);
  }
  const buckets = [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 1.01]].map(([lo, hi]) => {
    const rows = done
      .map((p) => ({ p: Math.max(p.homeProb, 1 - p.homeProb), hit: (p.homeProb >= 0.5) === p.homeWon }))
      .filter((x) => x.p >= lo && x.p < hi);
    return {
      bucket: `${Math.round(lo * 100)}-${Math.min(100, Math.round(hi * 100))}%`,
      total: rows.length,
      predicho: rows.length ? r(mean(rows.map((x) => x.p)) * 100, 1) : null,
      real: rows.length ? r((rows.filter((x) => x.hit).length / rows.length) * 100, 1) : null,
    };
  });
  return {
    partidos: n,
    pendientes: predictions.filter((p) => !p.settled).length,
    conMercado: withMkt.length,
    aciertoFavorito: n ? r((favHits / n) * 100, 1) : null,
    ic95: wilsonInterval(favHits, n),
    brierModelo: r(mean(done.map((p) => brier(p.homeProb, p.homeWon)))),
    loglossModelo: r(mean(done.map((p) => ll(p.homeProb, p.homeWon)))),
    // Mismos partidos, para comparar en igualdad de condiciones
    brierModeloEnConMercado: r(mean(withMkt.map((p) => brier(p.homeProb, p.homeWon)))),
    brierMercado: r(mean(withMkt.map((p) => brier(p.market.homeProb, p.homeWon)))),
    loglossModeloEnConMercado: r(mean(withMkt.map((p) => ll(p.homeProb, p.homeWon)))),
    loglossMercado: r(mean(withMkt.map((p) => ll(p.market.homeProb, p.homeWon)))),
    apuestasConVentaja: bets.length,
    yieldSimulado: bets.length ? r(mean(bets) * 100, 1) : null,
    calibracion: buckets,
    confianza: confidenceLevel(n),
    nota:
      'El modelo de baloncesto es un rating simple de puntos. No conoce lesiones, descanso ni viajes. Hasta tener cientos de partidos medidos contra la linea del mercado no hay base para decir que aporta algo.',
  };
}

export function getBasketballReport() {
  return buildBasketballReport(load().predictions);
}
