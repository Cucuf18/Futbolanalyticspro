import { config } from '../config.js';

/**
 * Cliente unico para football-data.org.
 *
 * Estaba duplicado dentro de sportsApi.js, y al necesitarlo tambien el
 * modulo de historial se habria creado una dependencia circular. Aqui
 * vive el control de rate limit (10 peticiones por minuto en el plan
 * gratuito) y la cache compartida, para que dos modulos que piden lo
 * mismo no gasten dos peticiones.
 */

const cache = new Map();
export const DEFAULT_TTL = 60 * 60 * 1000; // 1 hora

export function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < entry.ttl) return entry.data;
  cache.delete(key);
  return null;
}

export function setCache(key, data, ttlMs = DEFAULT_TTL) {
  cache.set(key, { data, ts: Date.now(), ttl: ttlMs });
}

let rateLimitRemaining = 10;
let rateLimitResetMs = 0;

// Peticiones en vuelo: si dos predicciones simultaneas piden el historial
// del mismo equipo, se comparte la promesa en vez de gastar dos llamadas.
const inFlight = new Map();

export async function fetchFromApi(endpoint) {
  if (!config.footballApiKey) return null;

  if (inFlight.has(endpoint)) return inFlight.get(endpoint);

  const run = (async () => {
    if (rateLimitRemaining <= 1 && rateLimitResetMs > Date.now()) {
      const waitSec = Math.ceil((rateLimitResetMs - Date.now()) / 1000);
      console.log(`[API] Limite alcanzado. Esperando ${waitSec}s...`);
      await new Promise((r) => setTimeout(r, (waitSec + 1) * 1000));
    }

    try {
      const res = await fetch(`${config.footballApiBaseUrl}${endpoint}`, {
        headers: { 'X-Auth-Token': config.footballApiKey },
      });

      const remaining = res.headers.get('x-requests-available-minute');
      const resetSeconds = res.headers.get('x-requestcounter-reset');
      if (remaining !== null) rateLimitRemaining = parseInt(remaining, 10);
      if (resetSeconds !== null) rateLimitResetMs = Date.now() + parseInt(resetSeconds, 10) * 1000;

      if (res.status === 429) {
        console.warn(`[API] 429 en ${endpoint}. Reintentar en ${resetSeconds || 60}s.`);
        return null;
      }
      if (!res.ok) {
        console.warn(`[API] ${res.status} en ${endpoint}`);
        return null;
      }

      return await res.json();
    } catch (err) {
      console.warn(`[API] Error de red: ${err.message}`);
      return null;
    }
  })();

  inFlight.set(endpoint, run);
  try {
    return await run;
  } finally {
    inFlight.delete(endpoint);
  }
}
