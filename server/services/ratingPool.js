import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RATINGS_PATH = path.join(__dirname, '../data/ratings.json');

/**
 * BOLSA DE RATINGS ELO
 * ------------------------------------------------------------------
 * El problema que resuelve: la tabla de clasificacion solo sabe de la
 * competicion actual. En la jornada 1 de Champions todos los equipos
 * valen lo mismo, y un equipo como el Bodo/Glimt "no existe" aunque
 * haya ganado al Inter hace unos meses.
 *
 * Aqui se acumula un Elo por equipo alimentado con CUALQUIER partido que
 * la pagina llegue a ver: ligas, copas, Champions, temporadas pasadas.
 * Cada peticion que se hace a la API para otra cosa (historial, H2H)
 * tambien engorda esta bolsa, asi que el sistema mejora solo con el uso
 * sin gastar ni una peticion extra.
 *
 * Es transitivo por construccion: si A gana a X y X gana a B, el rating
 * de A acaba por encima del de B aunque A y B no se hayan enfrentado
 * nunca. Eso es exactamente lo que no se estaba aprovechando.
 */

const START_ELO = 1500;
const HOME_ADVANTAGE_ELO = 60;

// Cuanto mueve el rating un partido, segun la importancia de la competicion.
const COMPETITION_K = {
  CL: 30,   // Champions
  EL: 26,   // Europa League
  PL: 24, PD: 24, SA: 24, BL1: 24, FL1: 22, PPL: 20, DED: 20,
  WC: 34, EC: 32,
  DEFAULT: 20,
};

let state = null;

function load() {
  if (state) return state;
  try {
    if (fs.existsSync(RATINGS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(RATINGS_PATH, 'utf8'));
      state = {
        ratings: parsed.ratings || {},
        processed: new Set(parsed.processed || []),
        updatedAt: parsed.updatedAt || null,
      };
      return state;
    }
  } catch (err) {
    console.error('[Ratings] No se pudo leer la bolsa de ratings:', err.message);
  }
  state = { ratings: {}, processed: new Set(), updatedAt: null };
  return state;
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  // Se agrupan las escrituras: una prediccion puede ingerir 100 partidos
  // y no tiene sentido tocar el disco 100 veces.
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const s = load();
    try {
      const dir = path.dirname(RATINGS_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        RATINGS_PATH,
        JSON.stringify(
          {
            ratings: s.ratings,
            // Se guardan los ultimos 20.000 ids para que el archivo no crezca sin fin.
            processed: [...s.processed].slice(-20000),
            updatedAt: new Date().toISOString(),
          },
          null,
          0
        ),
        'utf8'
      );
    } catch (err) {
      console.error('[Ratings] No se pudo guardar:', err.message);
    }
  }, 1500);
}

function entry(teamId, name) {
  const s = load();
  const key = String(teamId);
  if (!s.ratings[key]) {
    s.ratings[key] = { elo: START_ELO, matches: 0, name: name || null, lastMatch: null };
  }
  if (name && !s.ratings[key].name) s.ratings[key].name = name;
  return s.ratings[key];
}

/**
 * Multiplicador por diferencia de goles (formula de World Football Elo).
 * Un 4-0 mueve el rating mas que un 1-0, pero con rendimientos
 * decrecientes para que una goleada suelta no dispare a un equipo.
 */
function goalDiffMultiplier(goalDiff) {
  const gd = Math.abs(goalDiff);
  if (gd <= 1) return 1.0;
  if (gd === 2) return 1.5;
  return (11 + gd) / 8;
}

/**
 * Ingiere una lista de partidos terminados y actualiza los ratings.
 * Idempotente: cada partido se procesa una sola vez, identificado por su
 * id, asi que se puede llamar con los mismos datos sin deformar nada.
 *
 * @param {Array} matches partidos en formato football-data.org
 * @returns {number} cuantos partidos nuevos se han procesado
 */
export function ingestMatches(matches) {
  if (!Array.isArray(matches) || matches.length === 0) return 0;
  const s = load();

  // Cronologicamente: el Elo es secuencial y el orden importa.
  const fresh = matches
    .filter((m) => {
      const id = m?.id;
      const home = m?.score?.fullTime?.home;
      const away = m?.score?.fullTime?.away;
      return (
        id != null &&
        !s.processed.has(id) &&
        typeof home === 'number' &&
        typeof away === 'number' &&
        m.homeTeam?.id &&
        m.awayTeam?.id
      );
    })
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  for (const m of fresh) {
    const hg = m.score.fullTime.home;
    const ag = m.score.fullTime.away;

    const home = entry(m.homeTeam.id, m.homeTeam.name);
    const away = entry(m.awayTeam.id, m.awayTeam.name);

    const code = m.competition?.code;
    const K = COMPETITION_K[code] ?? COMPETITION_K.DEFAULT;

    const expectedHome = 1 / (1 + Math.pow(10, (away.elo - (home.elo + HOME_ADVANTAGE_ELO)) / 400));
    const actualHome = hg > ag ? 1 : hg === ag ? 0.5 : 0;
    const mult = goalDiffMultiplier(hg - ag);
    const delta = K * mult * (actualHome - expectedHome);

    home.elo += delta;
    away.elo -= delta;
    home.matches += 1;
    away.matches += 1;
    home.lastMatch = m.utcDate;
    away.lastMatch = m.utcDate;

    s.processed.add(m.id);
  }

  if (fresh.length > 0) scheduleSave();
  return fresh.length;
}

/**
 * Rating de un equipo. `confidence` va de 0 a 1 segun cuantos partidos
 * hemos visto: con 3 partidos el rating es una pista, con 25 es un dato.
 */
export function getRating(teamId) {
  const s = load();
  const r = s.ratings[String(teamId)];
  if (!r) return { elo: START_ELO, matches: 0, confidence: 0, known: false };
  return {
    elo: Math.round(r.elo),
    matches: r.matches,
    confidence: Math.min(1, r.matches / 20),
    known: r.matches > 0,
    name: r.name,
    lastMatch: r.lastMatch,
  };
}

export function getPoolStats() {
  const s = load();
  const all = Object.values(s.ratings);
  if (all.length === 0) return { teams: 0, matches: 0, meanElo: START_ELO };
  const elos = all.map((r) => r.elo);
  return {
    teams: all.length,
    matches: s.processed.size,
    meanElo: Math.round(elos.reduce((a, b) => a + b, 0) / elos.length),
    minElo: Math.round(Math.min(...elos)),
    maxElo: Math.round(Math.max(...elos)),
    top: all
      .filter((r) => r.matches >= 5)
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 10)
      .map((r) => ({ name: r.name, elo: Math.round(r.elo), matches: r.matches })),
  };
}

/**
 * Convierte una diferencia de Elo en un multiplicador de xG.
 * 100 puntos de Elo equivalen aproximadamente a un 12% mas de goles
 * esperados, con el efecto acotado para que no se desboque.
 */
export function eloToXgMultiplier(teamElo, rivalElo, confidence = 1) {
  const diff = (teamElo - rivalElo) * Math.min(1, Math.max(0, confidence));
  const raw = Math.pow(10, diff / 1600); // ~1.15 con +100 de Elo
  return Math.max(0.70, Math.min(1.45, raw));
}

export { START_ELO };
