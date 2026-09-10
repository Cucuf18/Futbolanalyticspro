import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchFromApi } from './footballDataClient.js';
import { ingestMatches } from './ratingPool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_PATH = path.join(__dirname, '../data/predictions.json');

/**
 * BACKTEST AUTOMATICO
 * ------------------------------------------------------------------
 * Hasta ahora el unico registro de aciertos era el que se marcaba a mano
 * en el boleto. Eso no sirve para medir el modelo: es una muestra sesgada
 * (solo se apuntan los picks que uno decide apostar) y minuscula.
 *
 * Aqui se guarda AUTOMATICAMENTE cada prediccion que genera la pagina y
 * se resuelve sola contra el resultado real cuando el partido termina.
 *
 * Lo importante no es el porcentaje global de aciertos, sino la CURVA DE
 * CALIBRACION: cuando el modelo dice 75%, ¿acierta el 75% de las veces?
 * Un modelo que dice 80% y acierta el 60% no es util aunque gane mas de
 * la mitad. Eso es lo que hace que las predicciones sean confiables o no,
 * y es exactamente lo que no se estaba midiendo.
 *
 * Solo se resuelven los mercados deducibles del marcador final. Corners,
 * tarjetas, faltas, tiros y offsides quedan como 'no resoluble' porque
 * ninguna de las dos APIs gratuitas da esas estadisticas.
 */

const MAX_STORED = 5000;
// Margen tras el inicio antes de intentar resolver (partido + descuento).
const SETTLE_DELAY_MS = 3 * 60 * 60 * 1000;

let store = null;

function load() {
  if (store) return store;
  try {
    if (fs.existsSync(STORE_PATH)) {
      store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      if (!Array.isArray(store.predictions)) store.predictions = [];
      return store;
    }
  } catch (err) {
    console.error('[Backtest] No se pudo leer el historial:', err.message);
  }
  store = { predictions: [], updatedAt: null };
  return store;
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const s = load();
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      s.predictions = s.predictions.slice(-MAX_STORED);
      s.updatedAt = new Date().toISOString();
      fs.writeFileSync(STORE_PATH, JSON.stringify(s), 'utf8');
    } catch (err) {
      console.error('[Backtest] No se pudo guardar:', err.message);
    }
  }, 2000);
}

const keyOf = (leagueId, homeId, awayId) => `${leagueId}:${homeId}:${awayId}`;

/**
 * Guarda una prediccion recien generada. Se ignora si ya hay una sin
 * resolver para el mismo cruce, para que recargar la pagina veinte veces
 * no meta veinte copias y falsee la muestra.
 */
export function recordPrediction({ leagueId, homeTeam, awayTeam, prediction }) {
  if (!prediction?.matchPicks) return null;
  const s = load();
  const key = keyOf(leagueId, homeTeam.id, awayTeam.id);

  const existing = s.predictions.find((p) => p.key === key && !p.settled);
  if (existing) return existing.id;

  const picks = [];
  for (const tier of ['safe', 'medium', 'risky']) {
    for (const pick of prediction.matchPicks[tier] || []) {
      picks.push({
        tier,
        type: pick.type,
        label: pick.label,
        marketType: pick.marketType,
        probability: pick.probability,
        marketOdds: pick.marketOdds,
        breakEvenOdds: pick.breakEvenOdds,
        settle: pick.settle || null,
      });
    }
  }

  const record = {
    id: `${key}:${Date.now()}`,
    key,
    leagueId,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name,
    createdAt: new Date().toISOString(),
    dataQuality: prediction.dataQuality ?? null,
    expectedGoals: prediction.expectedGoals ?? null,
    probabilities: prediction.probabilities ?? null,
    picks,
    settled: false,
  };

  s.predictions.push(record);
  scheduleSave();
  return record.id;
}

/**
 * Resuelve un pick contra el marcador final.
 * @returns {boolean|null} true acierto, false fallo, null no resoluble
 */
export function gradePick(settle, homeGoals, awayGoals) {
  if (!settle) return null;
  const total = homeGoals + awayGoals;

  switch (settle.kind) {
    case 'RESULT':
      return settle.side === 'HOME' ? homeGoals > awayGoals : awayGoals > homeGoals;

    case 'DOUBLE_CHANCE':
      if (settle.side === '1X') return homeGoals >= awayGoals;
      if (settle.side === 'X2') return awayGoals >= homeGoals;
      if (settle.side === '12') return homeGoals !== awayGoals;
      return null;

    case 'GOALS_TOTAL':
      return settle.side === 'OVER' ? total > settle.line : total < settle.line;

    case 'BTTS': {
      const both = homeGoals > 0 && awayGoals > 0;
      return settle.side === 'YES' ? both : !both;
    }

    case 'TEAM_SCORES':
      return settle.side === 'HOME' ? homeGoals > 0 : awayGoals > 0;

    case 'HANDICAP': {
      const adjusted = settle.side === 'HOME'
        ? homeGoals + settle.line - awayGoals
        : awayGoals + settle.line - homeGoals;
      if (adjusted === 0) return null; // push: se devuelve la apuesta
      return adjusted > 0;
    }

    default:
      return null;
  }
}

/**
 * Busca los partidos ya terminados de cada competicion pendiente y
 * resuelve las predicciones que les correspondan.
 */
export async function settlePending() {
  const s = load();
  const now = Date.now();

  const pending = s.predictions.filter(
    (p) => !p.settled && now - new Date(p.createdAt).getTime() > SETTLE_DELAY_MS
  );
  if (pending.length === 0) {
    return { checked: 0, settled: 0, message: 'No hay predicciones pendientes de resolver.' };
  }

  const leagues = [...new Set(pending.map((p) => p.leagueId))];
  let settled = 0;

  for (const leagueId of leagues) {
    const dateFrom = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
    const dateTo = new Date(now + 86400000).toISOString().slice(0, 10);
    const data = await fetchFromApi(
      `/competitions/${leagueId}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`
    );
    const matches = data?.matches || [];
    if (matches.length === 0) continue;

    // De paso, estos resultados alimentan los ratings Elo.
    ingestMatches(matches);

    for (const rec of pending.filter((p) => p.leagueId === leagueId)) {
      const predictedAt = new Date(rec.createdAt).getTime();
      const match = matches.find(
        (m) =>
          m.homeTeam?.id === rec.homeTeamId &&
          m.awayTeam?.id === rec.awayTeamId &&
          // El partido tiene que ser posterior a la prediccion, si no
          // estariamos puntuando con un resultado ya conocido.
          new Date(m.utcDate).getTime() >= predictedAt - 12 * 3600 * 1000
      );
      if (!match) continue;

      const hg = match.score?.fullTime?.home;
      const ag = match.score?.fullTime?.away;
      if (typeof hg !== 'number' || typeof ag !== 'number') continue;

      rec.settled = true;
      rec.settledAt = new Date().toISOString();
      rec.matchId = match.id;
      rec.finalScore = `${hg}-${ag}`;
      rec.picks = rec.picks.map((p) => ({ ...p, hit: gradePick(p.settle, hg, ag) }));
      settled++;
    }
  }

  if (settled > 0) scheduleSave();
  return { checked: pending.length, settled };
}

/**
 * Informe de rendimiento. Devuelve el global, el desglose por mercado y
 * por liga, y la curva de calibracion.
 */
export function getReport() {
  const s = load();
  const resolved = s.predictions.filter((p) => p.settled);

  const rows = [];
  for (const rec of resolved) {
    for (const p of rec.picks) {
      if (p.hit === null || p.hit === undefined) continue;
      rows.push({ ...p, leagueId: rec.leagueId, dataQuality: rec.dataQuality });
    }
  }

  const tally = (list) => {
    const won = list.filter((r) => r.hit).length;
    return {
      total: list.length,
      won,
      lost: list.length - won,
      hitRate: list.length ? Number(((won / list.length) * 100).toFixed(1)) : null,
      avgPredicted: list.length
        ? Number((list.reduce((a, r) => a + r.probability, 0) / list.length).toFixed(1))
        : null,
    };
  };

  const groupBy = (list, fn) => {
    const map = new Map();
    for (const r of list) {
      const k = fn(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    return [...map.entries()]
      .map(([k, v]) => ({ key: k, ...tally(v) }))
      .sort((a, b) => b.total - a.total);
  };

  // Curva de calibracion: lo prometido frente a lo cumplido.
  const buckets = [
    [50, 60], [60, 65], [65, 70], [70, 75], [75, 80], [80, 85], [85, 101],
  ];
  const calibration = buckets.map(([lo, hi]) => {
    const list = rows.filter((r) => r.probability >= lo && r.probability < hi);
    const t = tally(list);
    return {
      bucket: `${lo}-${hi === 101 ? 100 : hi}%`,
      ...t,
      // Positivo = el modelo prometia mas de lo que cumple (sobreconfiado).
      gap: t.hitRate !== null ? Number((t.avgPredicted - t.hitRate).toFixed(1)) : null,
    };
  });

  const gradable = rows.length;
  const ungradable = resolved.reduce(
    (acc, rec) => acc + rec.picks.filter((p) => p.hit === null || p.hit === undefined).length,
    0
  );

  return {
    resumen: {
      prediccionesGuardadas: s.predictions.length,
      partidosResueltos: resolved.length,
      picksEvaluados: gradable,
      picksNoEvaluables: ungradable,
      ...tally(rows),
    },
    calibracion: calibration,
    porMercado: groupBy(rows, (r) => r.marketType),
    porNivelDeRiesgo: groupBy(rows, (r) => r.tier),
    porLiga: groupBy(rows, (r) => r.leagueId),
    // Con datos pobres el modelo deberia acertar menos: si no es asi, la
    // metrica de calidad de datos no esta midiendo nada.
    porCalidadDeDatos: groupBy(rows, (r) =>
      r.dataQuality === null ? 'desconocida' : r.dataQuality >= 0.6 ? 'alta' : r.dataQuality >= 0.4 ? 'media' : 'baja'
    ),
    nota:
      'Corners, tarjetas, faltas, tiros y offsides no se pueden evaluar: ninguna de las dos APIs gratuitas devuelve esas estadisticas por partido.',
  };
}

export function getPending() {
  const s = load();
  return s.predictions
    .filter((p) => !p.settled)
    .map((p) => ({
      id: p.id,
      liga: p.leagueId,
      partido: `${p.homeTeamName} vs ${p.awayTeamName}`,
      creada: p.createdAt,
      picks: p.picks.length,
    }));
}
