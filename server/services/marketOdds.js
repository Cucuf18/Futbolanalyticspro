/**
 * MERCADO PRIMERO (cuotas reales de proximos partidos)
 * ------------------------------------------------------------------
 * Fuente: fixtures.csv de football-data.co.uk (gratis, sin clave). Trae
 * cuotas de Pinnacle, Bet365, la mejor y el promedio del mercado para los
 * partidos de la semana. Las cuotas se recogen los viernes por la tarde
 * (fin de semana) y los martes (entre semana): NO son en tiempo real.
 *
 * La union con nuestros partidos se hace por nombre de equipo, que en esa
 * fuente viene abreviado ("Wolves", "Sheffield Weds"). La regla es
 * estricta: si no se esta seguro de que es el mismo partido, no se muestra
 * nada, antes que mostrar las cuotas de otro encuentro.
 */

const URL = 'https://www.football-data.co.uk/fixtures.csv';
const TTL_MS = 3 * 60 * 60 * 1000;

// Id de liga del proyecto -> codigo de division de football-data.co.uk
export const DIV_BY_LEAGUE = { PL: 'E0', PD: 'SP1', SA: 'I1', BL1: 'D1', FL1: 'F1', DED: 'N1', PPL: 'P1', ELC: 'E1' };

/* ───────────── nombres de equipo ───────────── */
const STOP = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'as', 'ssc', 'us', 'rc', 'rcd', 'ud', 'sv', 'fk', 'club', 'de', 'calcio', 'cd', 'sd', 'ca', 'the', 'fsv', 'vfb', 'vfl', 'tsg', 'bsc', 'og', 'ogc', 'sk', 'ss']);
const ALIAS = new Map([
  ['man united', 'manchester united'], ['man utd', 'manchester united'], ['man city', 'manchester city'],
  ['spurs', 'tottenham'], ['tottenham hotspur', 'tottenham'],
  ['newcastle utd', 'newcastle united'], ['sheffield weds', 'sheffield wednesday'], ['sheffield utd', 'sheffield united'],
  ['nottm forest', 'nottingham forest'], ['nott m forest', 'nottingham forest'], ['wolves', 'wolverhampton wanderers'],
  ['west brom', 'west bromwich albion'], ['brighton', 'brighton hove albion'], ['leeds', 'leeds united'],
  ['ath madrid', 'atletico madrid'], ['ath bilbao', 'athletic club'], ['betis', 'real betis'], ['sociedad', 'real sociedad'],
  ['vallecano', 'rayo vallecano'], ['inter', 'internazionale'], ['milan', 'ac milan'], ['dortmund', 'borussia dortmund'],
  ['m gladbach', 'monchengladbach'], ['leverkusen', 'bayer leverkusen'], ['ein frankfurt', 'eintracht frankfurt'],
  ['paris sg', 'paris saint germain'], ['psg', 'paris saint germain'], ['st etienne', 'saint etienne'],
  ['sp lisbon', 'sporting cp'], ['sporting', 'sporting cp'], ['sp braga', 'braga'], ['psv', 'psv eindhoven'],
]);

export function normalizeTeam(name) {
  let s = String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (ALIAS.has(s)) s = ALIAS.get(s);
  const tokens = s.split(' ').filter((t) => t && !STOP.has(t) && !/^\d{2,4}$/.test(t));
  return tokens.join(' ');
}

/** Mismo equipo si coinciden, o si uno contiene al otro ("cardiff" / "cardiff city"). */
export function sameTeam(a, b) {
  const na = normalizeTeam(a);
  const nb = normalizeTeam(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const A = new Set(na.split(' '));
  const B = new Set(nb.split(' '));
  const [small, big] = A.size <= B.size ? [A, B] : [B, A];
  // Todos los terminos del nombre corto deben estar en el largo, y al
  // menos uno distintivo (evita que "city" empareje con "manchester city").
  const contained = [...small].every((t) => big.has(t));
  const distinctive = [...small].some((t) => t.length >= 4);
  return contained && distinctive;
}

/* ───────────── CSV ───────────── */
export function parseCsv(text) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  return lines.slice(1).map((l) => {
    const cells = l.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

const num = (v) => {
  const x = parseFloat(v);
  return Number.isFinite(x) && x > 1 ? x : null;
};

/** Quita el margen de la casa (normalizacion proporcional). */
export function devig(odds) {
  if (!odds.every((o) => o && o > 1)) return null;
  const inv = odds.map((o) => 1 / o);
  const s = inv.reduce((a, b) => a + b, 0);
  return inv.map((x) => x / s);
}

const set3 = (r, h, d, a) => [num(r[h]), num(r[d]), num(r[a])];

/** Convierte una fila del CSV en el resumen de mercado que usa la web. */
export function summarizeRow(r) {
  const pin = set3(r, 'PPH', 'PPD', 'PPA');
  const avg = set3(r, 'AvgH', 'AvgD', 'AvgA');
  const b365 = set3(r, 'B365H', 'B365D', 'B365A');
  const max = set3(r, 'MaxH', 'MaxD', 'MaxA');
  // Referencia: Pinnacle (el mercado mas afilado); si falta, el promedio.
  const refName = devig(pin) ? 'Pinnacle' : devig(avg) ? 'promedio del mercado' : null;
  const ref = devig(pin) || devig(avg);
  const ou = [num(r['Avg>2.5']), num(r['Avg<2.5'])];
  const ouFair = devig(ou);
  return {
    kickoff: { date: r.Date, time: r.Time, zone: 'hora del Reino Unido' },
    referee: (r.Referee || '').trim() || null,
    reference: refName,
    probs: ref ? { home: ref[0], draw: ref[1], away: ref[2] } : null,
    odds: {
      pinnacle: pin, average: avg, bet365: b365, best: max,
    },
    over25: ouFair ? { over: ouFair[0], under: ouFair[1], overOdds: ou[0], underOdds: ou[1] } : null,
    asianHandicap: Number.isFinite(parseFloat(r.AHh)) ? { line: parseFloat(r.AHh) } : null,
    note: 'Cuotas recogidas viernes por la tarde (fin de semana) o martes (entre semana): no son en tiempo real.',
  };
}

/** Busca el partido en las filas del CSV. Devuelve null si no hay coincidencia clara. */
export function findFixture(rows, leagueId, homeName, awayName) {
  const div = DIV_BY_LEAGUE[leagueId];
  if (!div) return null;
  const candidates = rows.filter((r) => r.Div === div && sameTeam(r.HomeTeam, homeName) && sameTeam(r.AwayTeam, awayName));
  // Si hubiera mas de uno (no deberia en una semana) se descarta: mejor nada.
  return candidates.length === 1 ? candidates[0] : null;
}

/* ───────────── descarga con cache ───────────── */
let cache = { rows: null, at: 0, fetchedAt: null };
export function _resetForTests() {
  cache = { rows: null, at: 0, fetchedAt: null };
}

export async function getFixtures() {
  if (cache.rows && Date.now() - cache.at < TTL_MS) return cache;
  const res = await fetch(URL, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`football-data.co.uk respondio ${res.status}`);
  const rows = parseCsv(await res.text());
  cache = { rows, at: Date.now(), fetchedAt: new Date().toISOString() };
  return cache;
}

export async function getMarketFor(leagueId, homeName, awayName) {
  if (!DIV_BY_LEAGUE[leagueId]) return { found: false, reason: 'liga-sin-cuotas' };
  const { rows, fetchedAt } = await getFixtures();
  const row = findFixture(rows, leagueId, homeName, awayName);
  if (!row) return { found: false, reason: 'sin-cuota-para-este-partido', fetchedAt };
  return { found: true, fetchedAt, market: summarizeRow(row) };
}
