import { americanToDecimal } from './basketball.js';

/**
 * COPAS DE EUROPA (Europa League y Conference League)
 * ------------------------------------------------------------------
 * football-data.org las deja fuera de su plan gratuito (cubre 12
 * competiciones y estas no estan), asi que se leen de la API publica de
 * ESPN: sin clave, pero NO oficial y puede cambiar sin aviso.
 *
 * Aqui NO hay modelo propio: en la fase de liga cada equipo juega 6-8
 * partidos, muy pocos para estimar nada, y en las ligas domesticas el
 * modelo ya perdio frente al mercado. Se muestra la tabla, los partidos y
 * las cuotas del mercado cuando ESPN las publica.
 */

const BASE = 'https://site.api.espn.com/apis';
export const COMPETITIONS = {
  el: { id: 'el', name: 'Europa League', slug: 'uefa.europa' },
  uecl: { id: 'uecl', name: 'Conference League', slug: 'uefa.europa.conf' },
};

const numOf = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

/** Quita el margen de un mercado de tres opciones (1X2). */
export function devig3(h, d, a) {
  if (![h, d, a].every((o) => o > 1)) return null;
  const inv = [1 / h, 1 / d, 1 / a];
  const s = inv.reduce((x, y) => x + y, 0);
  return { home: inv[0] / s, draw: inv[1] / s, away: inv[2] / s };
}

function parseOdds(o) {
  if (!o) return null;
  const pick = (a, b) => a ?? b ?? null;
  const dec = (v) => (v === null || v === undefined ? null : americanToDecimal(String(v).replace('+', '')));
  const h = dec(pick(o.homeTeamOdds?.moneyLine, o.moneyline?.home?.close?.odds ?? o.moneyline?.home?.open?.odds));
  const a = dec(pick(o.awayTeamOdds?.moneyLine, o.moneyline?.away?.close?.odds ?? o.moneyline?.away?.open?.odds));
  const d = dec(pick(o.drawOdds?.moneyLine, o.moneyline?.draw?.close?.odds ?? o.moneyline?.draw?.open?.odds));
  const probs = h && d && a ? devig3(h, d, a) : null;
  return {
    provider: o.provider?.name || null,
    overUnder: numOf(o.overUnder),
    decimal: h && d && a ? { home: h, draw: d, away: a } : null,
    probs,
  };
}

export function parseScoreboard(json) {
  const out = [];
  for (const ev of json?.events || []) {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === 'home');
    const away = comp?.competitors?.find((c) => c.homeAway === 'away');
    if (!ev.id || !home?.team || !away?.team) continue;
    const team = (c) => ({
      id: String(c.team.id),
      name: c.team.displayName || c.team.name,
      abbr: c.team.abbreviation || null,
      logo: c.team.logo || null,
      score: numOf(c.score),
    });
    out.push({
      id: String(ev.id),
      date: ev.date,
      state: ev.status?.type?.state || 'pre', // pre | in | post
      detail: ev.status?.type?.shortDetail || ev.status?.type?.description || '',
      home: team(home),
      away: team(away),
      market: parseOdds(comp.odds?.[0]),
    });
  }
  return out.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/** Fase de liga: 1-8 pasan directo, 9-24 juegan eliminatoria previa, 25+ quedan fuera. */
export function zoneOf(rank) {
  if (rank <= 8) return 'directo';
  if (rank <= 24) return 'playoff';
  return 'fuera';
}

export function parseStandings(json) {
  const rows = [];
  const visit = (node) => {
    for (const e of node?.standings?.entries || []) {
      const st = {};
      for (const s of e.stats || []) st[s.name] = numOf(s.value);
      if (!e.team?.id) continue;
      rows.push({
        rank: st.rank ?? null,
        team: { id: String(e.team.id), name: e.team.displayName || e.team.name, abbr: e.team.abbreviation || null, logo: e.team.logos?.[0]?.href || null },
        gp: st.gamesPlayed ?? 0,
        w: st.wins ?? 0,
        d: st.ties ?? st.draws ?? 0,
        l: st.losses ?? 0,
        gf: st.pointsFor ?? 0,
        ga: st.pointsAgainst ?? 0,
        gd: st.pointDifferential ?? (st.pointsFor ?? 0) - (st.pointsAgainst ?? 0),
        pts: st.points ?? 0,
      });
    }
    for (const c of node?.children || []) visit(c);
  };
  visit(json);
  rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  rows.forEach((r, i) => {
    r.rank = r.rank ?? i + 1;
    r.zone = zoneOf(r.rank);
  });
  return rows.sort((a, b) => a.rank - b.rank);
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

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');

/** Tabla y partidos de una competicion. Cada parte falla por separado. */
export async function getCompetition(id, now = Date.now()) {
  const comp = COMPETITIONS[id];
  if (!comp) return null;
  const range = `${ymd(now - 5 * 86400000)}-${ymd(now + 14 * 86400000)}`;
  const [st, sb] = await Promise.allSettled([
    espn(`/v2/sports/soccer/${comp.slug}/standings`, 60 * 60 * 1000),
    espn(`/site/v2/sports/soccer/${comp.slug}/scoreboard?dates=${range}&limit=200`, 10 * 60 * 1000),
  ]);
  const matches = sb.status === 'fulfilled' ? parseScoreboard(sb.value) : [];
  return {
    competition: { id: comp.id, name: comp.name, slug: comp.slug },
    standings: st.status === 'fulfilled' ? parseStandings(st.value) : [],
    standingsError: st.status === 'rejected' ? st.reason.message : null,
    upcoming: matches.filter((m) => m.state === 'pre' || m.state === 'in'),
    recent: matches.filter((m) => m.state === 'post').sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20),
    matchesError: sb.status === 'rejected' ? sb.reason.message : null,
  };
}
