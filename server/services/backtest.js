import { fetchFromApi } from './footballDataClient.js';
import { ingestMatches } from './ratingPool.js';
import { readBlob, writeBlob } from './persistence.js';

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

// Limite de seguridad. Antes eran 5000 y se borraban las mas antiguas,
// lo que falseaba el historial publico: ahora el techo es mucho mayor.
const MAX_STORED = 20000;

// Version del motor que genero la prediccion. Las anteriores a la 2 se
// hicieron con H2H inventado al azar (bug de inFlightRequests) y NO cuentan
// en el informe: medirian ruido, no el modelo.
export const ENGINE_VERSION = 2;
// Margen tras el inicio antes de intentar resolver (partido + descuento).
const SETTLE_DELAY_MS = 3 * 60 * 60 * 1000;
// Una prediccion sin partido posterior tras estos dias se descarta del
// informe (se hizo con el partido ya empezado, o el cruce no se jugo).
const EXPIRE_AFTER_MS = 45 * 24 * 60 * 60 * 1000;

let store = null;

function load() {
  if (store) return store;
  const saved = readBlob('predictions');
  store = saved && Array.isArray(saved.predictions) ? saved : { predictions: [], updatedAt: null };
  return store;
}

/** Solo para tests: fuerza a releer del almacenamiento. */
export function _resetStoreForTests() {
  store = null;
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const s = load();
    s.predictions = s.predictions.slice(-MAX_STORED);
    s.updatedAt = new Date().toISOString();
    writeBlob('predictions', s);
  }, 2000);
  saveTimer.unref?.();
}

const keyOf = (leagueId, homeId, awayId) => `${leagueId}:${homeId}:${awayId}`;

/**
 * Guarda una prediccion recien generada. Se ignora si ya hay una sin
 * resolver para el mismo cruce, para que recargar la pagina veinte veces
 * no meta veinte copias y falsee la muestra.
 */
export function recordPrediction({ leagueId, homeTeam, awayTeam, prediction, kickoff = null, source = 'manual' }) {
  if (!prediction?.matchPicks) return null;
  const s = load();
  const key = keyOf(leagueId, homeTeam.id, awayTeam.id);

  const existing = s.predictions.find((p) => p.key === key && !p.settled && p.engineVersion === ENGINE_VERSION);
  if (existing) {
    // Si el partido se registro a mano y despues llega con su hora de
    // inicio conocida, se completa el dato (la fecha de creacion no cambia).
    if (kickoff && !existing.kickoff) {
      existing.kickoff = kickoff;
      scheduleSave();
    }
    return existing.id;
  }

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
    engineVersion: ENGINE_VERSION,
    leagueId,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name,
    createdAt: new Date().toISOString(),
    // Hora de inicio del partido (solo en el registro automatico).
    kickoff,
    // 'auto' = lo registro el servidor sin intervencion; 'manual' = alguien
    // abrio el partido en la web.
    source,
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

    case 'TEAM_GOALS': {
      const goals = settle.side === 'HOME' ? homeGoals : awayGoals;
      return settle.over ? goals > settle.line : goals < settle.line;
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
 * Elige el partido real que corresponde a una prediccion.
 * Regla anti-trampa: el partido tiene que EMPEZAR DESPUES de que se
 * generara la prediccion. Antes se toleraban 12 h de margen, y un pick
 * hecho con el partido ya en juego podia puntuar con un resultado casi
 * conocido. Si hay varios cruces, se toma el primero tras la prediccion.
 */
export function findMatchForPrediction(rec, matches) {
  const predictedAt = new Date(rec.createdAt).getTime();
  const kickoffAt = rec.kickoff ? new Date(rec.kickoff).getTime() : null;
  return (
    matches
      .filter((m) => {
        if (m.homeTeam?.id !== rec.homeTeamId || m.awayTeam?.id !== rec.awayTeamId) return false;
        const t = new Date(m.utcDate).getTime();
        if (t <= predictedAt) return false;
        // Con hora de inicio conocida, solo vale ESE partido (tolerancia
        // de 3 h por si lo aplazan unas horas), no otro cruce posterior.
        if (kickoffAt !== null && Math.abs(t - kickoffAt) > 3 * 3600 * 1000) return false;
        return true;
      })
      .sort((x, y) => new Date(x.utcDate) - new Date(y.utcDate))[0] || null
  );
}

/**
 * Busca los partidos ya terminados de cada competicion pendiente y
 * resuelve las predicciones que les correspondan.
 */
export async function settlePending() {
  const s = load();
  const now = Date.now();

  // Descartar las que nunca tendran partido valido (ver EXPIRE_AFTER_MS).
  let expired = 0;
  for (const p of s.predictions) {
    if (!p.settled && now - new Date(p.createdAt).getTime() > EXPIRE_AFTER_MS) {
      p.settled = true;
      p.expired = true;
      p.settledAt = new Date().toISOString();
      expired++;
    }
  }
  if (expired > 0) scheduleSave();

  const pending = s.predictions.filter(
    (p) => !p.settled && now - new Date(p.createdAt).getTime() > SETTLE_DELAY_MS
  );
  if (pending.length === 0) {
    return { checked: 0, settled: 0, expired, message: 'No hay predicciones pendientes de resolver.' };
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
      const match = findMatchForPrediction(rec, matches);
      if (!match) continue;

      const hg = match.score?.fullTime?.home;
      const ag = match.score?.fullTime?.away;
      if (typeof hg !== 'number' || typeof ag !== 'number') continue;

      rec.settled = true;
      rec.settledAt = new Date().toISOString();
      rec.matchId = match.id;
      rec.matchDate = match.utcDate;
      rec.finalScore = `${hg}-${ag}`;
      rec.picks = rec.picks.map((p) => ({ ...p, hit: gradePick(p.settle, hg, ag) }));
      settled++;
    }
  }

  if (settled > 0) scheduleSave();
  return { checked: pending.length, settled, expired };
}

/**
 * Informe de rendimiento. Devuelve el global, el desglose por mercado y
 * por liga, y la curva de calibracion.
 */
/**
 * Intervalo de confianza de Wilson al 95% para una proporcion. Con pocos
 * picks es muy ancho: es la forma honesta de mostrar que un 70% sobre 20
 * picks no demuestra nada.
 */
export function wilsonInterval(wins, n, z = 1.96) {
  if (!n) return null;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Number(((center - margin) * 100).toFixed(1)), Number(((center + margin) * 100).toFixed(1))];
}

/** Cuanta muestra hay para sacar conclusiones. */
export function confidenceLevel(picksEvaluados) {
  if (picksEvaluados < 100) return 'muy baja';
  if (picksEvaluados < 300) return 'baja';
  if (picksEvaluados < 1000) return 'media';
  return 'alta';
}

export function getReport() {
  return buildReport(load().predictions);
}

export function buildReport(predictions) {
  const isClean = (p) => (p.engineVersion ?? 1) >= ENGINE_VERSION;
  const resolved = predictions.filter((p) => p.settled && !p.expired && isClean(p));

  const rows = [];
  for (const rec of resolved) {
    for (const p of rec.picks) {
      if (p.hit === null || p.hit === undefined) continue;
      rows.push({ ...p, leagueId: rec.leagueId, dataQuality: rec.dataQuality, source: rec.source || 'manual' });
    }
  }

  const tally = (list) => {
    const won = list.filter((r) => r.hit).length;
    const n = list.length;
    const ci = wilsonInterval(won, n);
    // Brier: error cuadratico medio de la probabilidad (0 = perfecto,
    // 0.25 = equivale a tirar una moneda). Mide la calidad de las
    // probabilidades sin depender de ninguna cuota.
    const brier = n
      ? Number((list.reduce((a, r) => a + (r.probability / 100 - (r.hit ? 1 : 0)) ** 2, 0) / n).toFixed(4))
      : null;
    // Yield SIMULADO: 1 unidad por pick a la cuota ESTIMADA (no real).
    const priced = list.filter((r) => typeof r.marketOdds === 'number' && r.marketOdds > 1);
    const yieldSim = priced.length
      ? Number(
          ((priced.reduce((a, r) => a + (r.hit ? r.marketOdds - 1 : -1), 0) / priced.length) * 100).toFixed(1)
        )
      : null;
    return {
      total: n,
      won,
      lost: n - won,
      hitRate: n ? Number(((won / n) * 100).toFixed(1)) : null,
      ic95: ci,
      avgPredicted: n
        ? Number((list.reduce((a, r) => a + r.probability, 0) / n).toFixed(1))
        : null,
      brier,
      yieldSimulado: yieldSim,
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
      prediccionesGuardadas: predictions.length,
      prediccionesDescartadas: predictions.filter((p) => p.expired).length,
      prediccionesExcluidas: predictions.filter((p) => !isClean(p)).length,
      partidosResueltos: resolved.length,
      picksEvaluados: gradable,
      picksNoEvaluables: ungradable,
      ...tally(rows),
    },
    calibracion: calibration,
    porMercado: groupBy(rows, (r) => r.marketType),
    porNivelDeRiesgo: groupBy(rows, (r) => r.tier),
    porLiga: groupBy(rows, (r) => r.leagueId),
    // Los registros automaticos cubren TODOS los partidos de las ligas, sin
    // sesgo de seleccion; los manuales son solo los que alguien abrio.
    porOrigen: groupBy(rows, (r) => (r.source === 'auto' ? 'automatico' : 'manual')),
    // Con datos pobres el modelo deberia acertar menos: si no es asi, la
    // metrica de calidad de datos no esta midiendo nada.
    porCalidadDeDatos: groupBy(rows, (r) =>
      r.dataQuality === null ? 'desconocida' : r.dataQuality >= 0.6 ? 'alta' : r.dataQuality >= 0.4 ? 'media' : 'baja'
    ),
    confianza: confidenceLevel(gradable),
    notaYield:
      'El yield simulado usa cuotas ESTIMADAS por el modelo (probabilidad cruda menos 6% de margen), no cuotas reales de ninguna casa. Sirve para comparar versiones del modelo, no para prometer ganancias: el rendimiento real depende de la cuota que ofrezca tu casa.',
    notaExcluidas:
      'Las predicciones guardadas antes de corregir el error del H2H se excluyen de este informe: se hicieron con datos inventados.',
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
