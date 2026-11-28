import { fetchFromApi, getCached, setCache, getLastFailure } from './footballDataClient.js';
import { ingestMatches, getRating } from './ratingPool.js';

/**
 * HISTORIAL REAL POR EQUIPO
 * ------------------------------------------------------------------
 * Antes el motor solo leia la fila del equipo en la tabla de la
 * competicion actual: goles a favor, goles en contra y posicion. Todo lo
 * demas se tiraba.
 *
 * Aqui se usa el historial completo de partidos de cada equipo, en
 * TODAS las competiciones, para sacar:
 *   - forma real (la tabla de Champions la devuelve vacia)
 *   - fecha del ultimo partido, que resucita el calculo de fatiga
 *   - goles marcados y encajados con decaimiento temporal
 *   - splits de local y visitante por separado
 *   - ajuste por la calidad del rival al que se le marco
 *   - rivales en comun con el otro equipo
 */

const HISTORY_TTL = 12 * 60 * 60 * 1000; // 12 horas
const FAILED_TTL = 60 * 1000; // 1 minuto si la descarga fallo
const LOOKBACK_DAYS = 760; // ~2 temporadas: el modelo de goles v2 usa vida media de 240 dias
const MAX_MATCHES = 100;

// Vida media del decaimiento: un partido de hace 5 meses pesa la mitad
// que uno de esta semana.
const DECAY_HALFLIFE_DAYS = 150;

// Un amistoso o una copa menor no dice lo mismo que una liga o Europa.
const COMPETITION_WEIGHT = {
  CL: 1.0, EL: 0.95,
  PL: 1.0, PD: 1.0, SA: 1.0, BL1: 1.0, FL1: 0.95, PPL: 0.85, DED: 0.85,
  ELC: 0.80, BSA: 0.85,
  WC: 1.0, EC: 1.0,
  DEFAULT: 0.80,
};

function competitionWeight(code) {
  return COMPETITION_WEIGHT[code] ?? COMPETITION_WEIGHT.DEFAULT;
}

function decayWeight(dateStr) {
  const days = Math.max(0, (Date.now() - new Date(dateStr).getTime()) / 86400000);
  return Math.pow(0.5, days / DECAY_HALFLIFE_DAYS);
}

/**
 * Descarga y normaliza el historial de un equipo.
 * Cada descarga alimenta ademas la bolsa de ratings Elo, asi que la
 * pagina se vuelve mas lista con cada consulta sin gastar peticiones extra.
 */
export async function getTeamHistory(teamId) {
  const cacheKey = `history_${teamId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const dateTo = new Date().toISOString().slice(0, 10);

  // Si la API rechaza los parametros (400), se prueba con rangos mas
  // cortos que ya se sabe que acepta, en vez de dejar al equipo sin historial.
  let endpoint = '';
  let data = null;
  for (const [days, limit] of [[LOOKBACK_DAYS, MAX_MATCHES], [720, 100], [420, 60]]) {
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    endpoint = `/teams/${teamId}/matches?status=FINISHED&dateFrom=${from}&dateTo=${dateTo}&limit=${limit}`;
    data = await fetchFromApi(endpoint);
    if (data) break;
    if (getLastFailure(endpoint)?.status !== 400) break; // 429, 403, red...: otro rango no ayuda
  }

  const raw = data?.matches || [];
  // Todo partido visto engorda los ratings, incluido el de los rivales.
  if (raw.length) ingestMatches(raw);

  const id = Number(teamId);
  const matches = raw
    .filter((m) => typeof m.score?.fullTime?.home === 'number' && typeof m.score?.fullTime?.away === 'number')
    .map((m) => {
      const isHome = m.homeTeam.id === id;
      const gf = isHome ? m.score.fullTime.home : m.score.fullTime.away;
      const ga = isHome ? m.score.fullTime.away : m.score.fullTime.home;
      return {
        matchId: m.id,
        date: m.utcDate,
        isHome,
        gf,
        ga,
        result: gf > ga ? 'W' : gf === ga ? 'D' : 'L',
        opponentId: isHome ? m.awayTeam.id : m.homeTeam.id,
        opponentName: isHome ? m.awayTeam.name : m.homeTeam.name,
        competition: m.competition?.code || null,
        competitionName: m.competition?.name || null,
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // mas reciente primero

  const history = buildAggregates(id, matches);
  // Partidos tal como los entrega la API: el H2H los reutiliza en vez de
  // volver a pedirlos (antes cada prediccion gastaba dos consultas por equipo).
  history.rawMatches = raw;
  if (!data) history.failure = String(getLastFailure(endpoint)?.status ?? 'sin-respuesta');
  else if (matches.length === 0) history.failure = 'sin-partidos';
  // Solo se recuerda 12 h lo que se descargo bien. Si la peticion fallo
  // (limite por minuto, red), se guarda 1 minuto: antes un fallo pasajero
  // dejaba al equipo "sin historial" durante medio dia.
  setCache(cacheKey, history, data ? HISTORY_TTL : FAILED_TTL);
  return history;
}

function buildAggregates(teamId, matches) {
  if (matches.length === 0) {
    return { teamId, count: 0, known: false, matches: [], form: [], lastMatchDate: null };
  }

  const acc = (subset) => {
    let wGF = 0;
    let wGA = 0;
    let wTotal = 0;
    for (const m of subset) {
      // El rival importa: marcarle 2 al lider no es lo mismo que
      // marcarle 2 al colista. Se ajusta por el Elo del rival, que sale
      // de la bolsa global de ratings.
      const oppRating = getRating(m.opponentId);
      const oppFactor = oppRating.known
        ? Math.pow(10, ((oppRating.elo - 1500) / 1400) * oppRating.confidence)
        : 1;

      const w = decayWeight(m.date) * competitionWeight(m.competition);
      wTotal += w;
      wGF += w * m.gf * oppFactor;          // marcar a un rival fuerte vale mas
      wGA += (w * m.ga) / oppFactor;        // encajar ante un rival flojo pesa mas
    }
    if (wTotal === 0) return null;
    return { gf: wGF / wTotal, ga: wGA / wTotal, samples: subset.length };
  };

  const homeMatches = matches.filter((m) => m.isHome);
  const awayMatches = matches.filter((m) => !m.isHome);

  const overall = acc(matches);
  const home = acc(homeMatches);
  const away = acc(awayMatches);

  const rating = getRating(teamId);

  return {
    teamId,
    known: true,
    count: matches.length,
    matches,
    form: matches.slice(0, 5).map((m) => m.result),
    lastMatchDate: matches[0].date,
    restDays: Math.floor((Date.now() - new Date(matches[0].date).getTime()) / 86400000),
    competitions: [...new Set(matches.map((m) => m.competitionName).filter(Boolean))],
    // Con pocos partidos en casa/fuera se cae al promedio general para no
    // sacar conclusiones de una muestra de dos partidos.
    attack: {
      overall: overall.gf,
      home: home && home.samples >= 4 ? home.gf : overall.gf,
      away: away && away.samples >= 4 ? away.gf : overall.gf,
    },
    defense: {
      overall: overall.ga,
      home: home && home.samples >= 4 ? home.ga : overall.ga,
      away: away && away.samples >= 4 ? away.ga : overall.ga,
    },
    elo: rating.elo,
    eloMatches: rating.matches,
    eloConfidence: rating.confidence,
  };
}

/**
 * RIVALES EN COMUN
 *
 * Aunque dos equipos no se hayan enfrentado nunca, si ambos jugaron
 * contra los mismos rivales se pueden comparar por ahi. Es la tecnica
 * clasica de handicap y era la senal mas evidente que no se estaba
 * usando: el Bodo/Glimt no tenia historial directo con nadie, pero habia
 * jugado contra el Inter y el Sporting.
 *
 * Devuelve el diferencial medio de goles de cada equipo frente a los
 * rivales que comparten, ponderado por antiguedad.
 */
export function compareByCommonOpponents(historyA, historyB) {
  if (!historyA?.known || !historyB?.known) return null;

  const byOpponent = (history) => {
    const map = new Map();
    for (const m of history.matches) {
      if (!map.has(m.opponentId)) map.set(m.opponentId, []);
      map.get(m.opponentId).push(m);
    }
    return map;
  };

  const mapA = byOpponent(historyA);
  const mapB = byOpponent(historyB);

  const shared = [];
  let wDiffA = 0;
  let wDiffB = 0;
  let wTotal = 0;

  for (const [oppId, matchesA] of mapA) {
    const matchesB = mapB.get(oppId);
    if (!matchesB) continue;

    const avg = (list) => {
      let wd = 0;
      let wt = 0;
      for (const m of list) {
        const w = decayWeight(m.date) * competitionWeight(m.competition);
        wd += w * (m.gf - m.ga);
        wt += w;
      }
      return { diff: wt > 0 ? wd / wt : 0, weight: wt };
    };

    const a = avg(matchesA);
    const b = avg(matchesB);
    const pairWeight = Math.min(a.weight, b.weight);
    if (pairWeight <= 0.02) continue; // rastro demasiado viejo

    wDiffA += a.diff * pairWeight;
    wDiffB += b.diff * pairWeight;
    wTotal += pairWeight;

    shared.push({
      opponentId: oppId,
      opponentName: matchesA[0].opponentName,
      teamADiff: Number(a.diff.toFixed(2)),
      teamBDiff: Number(b.diff.toFixed(2)),
      teamAResults: matchesA.slice(0, 2).map((m) => `${m.gf}-${m.ga}`),
      teamBResults: matchesB.slice(0, 2).map((m) => `${m.gf}-${m.ga}`),
    });
  }

  if (shared.length === 0 || wTotal === 0) return null;

  const avgDiffA = wDiffA / wTotal;
  const avgDiffB = wDiffB / wTotal;

  return {
    count: shared.length,
    // Positivo = el equipo A rindio mejor contra los rivales compartidos.
    edge: Number((avgDiffA - avgDiffB).toFixed(2)),
    teamAAvgDiff: Number(avgDiffA.toFixed(2)),
    teamBAvgDiff: Number(avgDiffB.toFixed(2)),
    // La fiabilidad crece con el numero de rivales compartidos.
    confidence: Math.min(1, shared.length / 5),
    opponents: shared
      .sort((x, y) => Math.abs(y.teamADiff - y.teamBDiff) - Math.abs(x.teamADiff - x.teamBDiff))
      .slice(0, 5),
  };
}
