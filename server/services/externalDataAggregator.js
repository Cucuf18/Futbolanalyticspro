import { config } from '../config.js';

// Simple in-memory cache for external data
const cache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function cacheGet(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.timestamp < CACHE_TTL_MS) return hit.data;
  return null;
}

function cacheSet(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Temporada europea actual. Antes estaba cableada a '2024', asi que a
 * partir de agosto de 2025 se pedian estadisticas de una temporada
 * cerrada (o inexistente para el equipo) y la API devolvia vacio.
 */
export function currentSeason(date = new Date()) {
  const y = date.getFullYear();
  // La temporada 2025/26 se identifica como "2025" y arranca en agosto.
  return String(date.getMonth() >= 6 ? y : y - 1);
}

async function apiFootball(endpoint) {
  if (!config.apiFootballKey) return null;
  try {
    const response = await fetch(`${config.apiFootballBaseUrl}${endpoint}`, {
      method: 'GET',
      headers: { 'x-apisports-key': config.apiFootballKey },
    });
    if (!response.ok) {
      console.warn(`[ExternalData] HTTP ${response.status} on ${endpoint}`);
      return null;
    }
    const json = await response.json();
    if (json.errors && Object.keys(json.errors).length > 0) {
      console.warn('[ExternalData] API Error:', json.errors);
      return null;
    }
    return json;
  } catch (error) {
    console.error('[ExternalData] Fetch error:', error.message);
    return null;
  }
}

/**
 * Resuelve el id de api-football a partir del NOMBRE del equipo.
 *
 * football-data.org y api-football usan numeraciones distintas: pasar el
 * id de una a la otra devolvia estadisticas de un equipo equivocado o
 * directamente nada, y todo el modulo de datos externos quedaba muerto
 * sin que se notara (caia en silencio a las estimaciones internas).
 */
export async function resolveApiFootballTeamId(teamName, leagueId, season) {
  if (!teamName) return null;
  const key = `resolve_${teamName}_${leagueId}_${season}`;
  const cached = cacheGet(key);
  if (cached !== null) return cached;

  const json = await apiFootball(`/teams?league=${leagueId}&season=${season}`);
  const list = json?.response || [];
  if (list.length === 0) {
    cacheSet(key, null);
    return null;
  }

  const normalize = (s) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\b(fc|cf|ac|as|ss|sc|afc|club|de|the)\b/g, '')
      .replace(/[^a-z0-9]/g, '');

  const target = normalize(teamName);
  let match = list.find((t) => normalize(t.team.name) === target);
  if (!match) {
    match = list.find((t) => {
      const n = normalize(t.team.name);
      return n.includes(target) || target.includes(n);
    });
  }
  if (!match) {
    match = list.find((t) => t.team.code && normalize(t.team.code) === target);
  }

  const id = match ? match.team.id : null;
  cacheSet(key, id);
  if (!id) console.warn(`[ExternalData] No se pudo mapear "${teamName}" en la liga ${leagueId}`);
  return id;
}

/**
 * Estadisticas reales del equipo. `teamRef` puede ser un id numerico de
 * api-football o el nombre del equipo (se resuelve automaticamente).
 */
export async function getTeamStats(teamRef, leagueId, season = currentSeason()) {
  const teamId = typeof teamRef === 'number' || /^\d+$/.test(String(teamRef))
    ? String(teamRef)
    : await resolveApiFootballTeamId(teamRef, leagueId, season);

  if (!teamId) return null;

  const cacheKey = `team_stats_${teamId}_${leagueId}_${season}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  if (!config.apiFootballKey) {
    console.warn('[ExternalData] API_FOOTBALL_KEY no configurada. Se usan estimaciones internas.');
    return null;
  }

  const json = await apiFootball(`/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`);
  const data = json?.response;
  if (!data) return null;

  const fixtures = data.fixtures || {};
  const played = fixtures.played?.total || 0;
  if (played === 0) return null;

  const countCards = (cardObj = {}) => {
    let total = 0;
    for (const key in cardObj) {
      if (cardObj[key]?.total !== null && cardObj[key]?.total !== undefined) total += cardObj[key].total;
    }
    return total;
  };

  const totalYellowCards = countCards(data.cards?.yellow);
  const totalRedCards = countCards(data.cards?.red);

  const goalsFor = data.goals?.for?.total?.total || 0;
  const goalsAgainst = data.goals?.against?.total?.total || 0;
  const goalsForAvg = goalsFor / played;
  const goalsAgainstAvg = goalsAgainst / played;

  // /teams/statistics no expone corners, remates ni faltas en el plan
  // gratuito. Marcamos explicitamente lo estimado para que el motor sepa
  // que fiabilidad tiene cada campo, en vez de tratarlo como dato real.
  const stats = {
    played,
    isReal: true,
    avgGoalsFor: Number(goalsForAvg.toFixed(2)),
    avgGoalsAgainst: Number(goalsAgainstAvg.toFixed(2)),
    avgYellowCards: Number((totalYellowCards / played).toFixed(2)),
    avgRedCards: Number((totalRedCards / played).toFixed(2)),
    // Derivados (estimaciones ancladas a los goles reales)
    estimated: ['avgCorners', 'avgShotsOnTarget', 'avgTotalShots', 'avgFouls', 'avgOffsides'],
    avgCorners: Number((4.5 + Math.min((goalsForAvg / 2.5) * 2.5, 2.5)).toFixed(2)),
    avgShotsOnTarget: Number((3.5 + Math.min((goalsForAvg / 2.5) * 3.0, 3.0)).toFixed(2)),
    avgTotalShots: Number((10.0 + Math.min((goalsForAvg / 2.5) * 6.0, 6.0)).toFixed(2)),
    avgFouls: Number((10.0 + Math.min((goalsAgainstAvg / 2.5) * 3.0, 3.0)).toFixed(2)),
    avgOffsides: Number((1.5 + Math.min((goalsForAvg / 2.5) * 1.0, 1.0)).toFixed(2)),
  };

  cacheSet(cacheKey, stats);
  return stats;
}
