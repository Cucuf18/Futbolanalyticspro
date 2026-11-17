import { config } from '../config.js';
import { fetchFromApi } from './footballDataClient.js';
import { getMatchPredictionDetails } from './sportsApi.js';
import { readBlob } from './persistence.js';
import { ENGINE_VERSION } from './backtest.js';

/**
 * REGISTRO AUTOMATICO DE PREDICCIONES
 * ------------------------------------------------------------------
 * Hasta ahora una prediccion solo se guardaba cuando alguien abria el
 * partido en la web. Eso tiene dos problemas:
 *   1. Si no entras, el historial no crece.
 *   2. Solo quedan los partidos que alguien decidio mirar (sesgo).
 *
 * Aqui el servidor busca los partidos de las proximas horas de TODAS las
 * ligas soportadas y registra su prediccion, con la hora de inicio. Como
 * se hace antes del partido y para todos por igual, es la muestra limpia
 * con la que se puede juzgar al modelo.
 *
 * Respeta el limite gratuito de la API: tope de partidos por pasada y
 * peticiones en serie (el cliente ya espera si se agota el cupo).
 */

const HORIZON_MS = 3 * 24 * 60 * 60 * 1000; // partidos de los proximos 3 dias
const MIN_LEAD_MS = 30 * 60 * 1000; // al menos 30 min antes del inicio
const MAX_PER_RUN = 20;

let running = false;

export async function fixturesToRegister(now = Date.now()) {
  const dateFrom = new Date(now).toISOString().slice(0, 10);
  const dateTo = new Date(now + HORIZON_MS).toISOString().slice(0, 10);
  const out = [];
  for (const league of config.supportedLeagues) {
    const data = await fetchFromApi(`/competitions/${league.id}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
    for (const m of data?.matches || []) {
      if (!['SCHEDULED', 'TIMED'].includes(m.status)) continue;
      const kickoff = new Date(m.utcDate).getTime();
      if (!m.homeTeam?.id || !m.awayTeam?.id || kickoff - now < MIN_LEAD_MS) continue;
      out.push({ leagueId: league.id, homeId: m.homeTeam.id, awayId: m.awayTeam.id, kickoff: m.utcDate });
    }
  }
  return out.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
}

/** Claves ya registradas y sin resolver, para no repetir trabajo. */
function alreadyRegistered() {
  const saved = readBlob('predictions');
  const keys = new Set();
  for (const p of saved?.predictions || []) {
    if (!p.settled && p.engineVersion === ENGINE_VERSION) keys.add(p.key);
  }
  return keys;
}

export async function runAutoRegister() {
  if (running) return { skipped: 'ya hay una pasada en curso' };
  if (!config.footballApiKey) return { skipped: 'sin API key de football-data' };
  running = true;
  const result = { found: 0, registered: 0, failed: 0 };
  try {
    const fixtures = await fixturesToRegister();
    const done = alreadyRegistered();
    const todo = fixtures.filter((f) => !done.has(`${f.leagueId}:${f.homeId}:${f.awayId}`));
    result.found = fixtures.length;
    for (const f of todo.slice(0, MAX_PER_RUN)) {
      try {
        await getMatchPredictionDetails(f.homeId, f.awayId, f.leagueId, { kickoff: f.kickoff, source: 'auto' });
        result.registered++;
      } catch (err) {
        result.failed++;
        console.warn(`[AutoRegistro] ${f.leagueId} ${f.homeId}-${f.awayId}: ${err.message}`);
      }
    }
  } finally {
    running = false;
  }
  return result;
}
