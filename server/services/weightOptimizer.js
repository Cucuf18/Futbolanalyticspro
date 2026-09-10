import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEIGHTS_PATH = path.join(__dirname, '../data/optimizedWeights.json');

const DEFAULT_WEIGHTS = {
  homeAdvantage: 1.14,
  homeAttackMultiplier: 1.0,
  awayAttackMultiplier: 1.0,
  emaWeight: 1.0,
  fatigueMultiplier: 1.0,
  h2hBaseWeight: 0.70,
  starPickMinProbability: 65,
  safeThreshold: 70,
  mediumThreshold: 58,
  // Registro de resultados por mercado: permite saber que mercados
  // aciertan de verdad y priorizarlos en los picks seguros.
  marketStats: {},
  // Ids ya procesados, para que reenviar el historial completo no
  // vuelva a aplicar los mismos ajustes una y otra vez.
  processedIds: [],
  updatedAt: null,
};

const MAX_PROCESSED_IDS = 800;

export function getWeights() {
  try {
    if (fs.existsSync(WEIGHTS_PATH)) {
      const data = fs.readFileSync(WEIGHTS_PATH, 'utf8');
      return { ...DEFAULT_WEIGHTS, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error reading optimized weights, using defaults:', err);
  }
  return { ...DEFAULT_WEIGHTS };
}

function saveWeights(weights) {
  try {
    const dir = path.dirname(WEIGHTS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(weights, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving optimized weights:', err);
  }
}

const betId = (bet) => `${bet.matchId || bet.valueBetType}|${bet.settledAt || ''}`;

/**
 * Fiabilidad historica de un mercado, en puntos de bonus/penalizacion
 * para el orden de seleccion de picks (NO altera la probabilidad).
 *
 * Con menos de 8 resoluciones el mercado se considera sin evidencia y
 * devuelve 0: no queremos que 2 fallos sueltos entierren un mercado.
 */
export function getMarketReliability(marketType) {
  const { marketStats = {} } = getWeights();
  const s = marketStats[marketType];
  if (!s) return 0;
  const total = (s.won || 0) + (s.lost || 0);
  if (total < 8) return 0;
  const hitRate = (s.won || 0) / total;
  // 50% de acierto => 0 ; 90% => +8 ; 20% => -6
  return Number(((hitRate - 0.60) * 20).toFixed(2));
}

export function getMarketReport() {
  const { marketStats = {} } = getWeights();
  return Object.entries(marketStats)
    .map(([market, s]) => {
      const total = (s.won || 0) + (s.lost || 0);
      return {
        market,
        won: s.won || 0,
        lost: s.lost || 0,
        total,
        hitRate: total > 0 ? Number(((s.won / total) * 100).toFixed(1)) : 0,
        reliability: getMarketReliability(market),
      };
    })
    .sort((a, b) => b.total - a.total);
}

/**
 * Bucle de auto-aprendizaje.
 * Solo procesa apuestas nuevas (idempotente): el frontend reenvia el
 * historial completo en cada resolucion, y antes eso re-aplicaba todos
 * los ajustes antiguos, desviando los pesos de forma acumulativa.
 */
export function learn(history) {
  const weights = getWeights();
  if (!Array.isArray(history) || history.length === 0) return weights;

  const processed = new Set(weights.processedIds || []);
  const fresh = history.filter((bet) => bet && bet.status && !processed.has(betId(bet)));
  if (fresh.length === 0) return weights;

  let homeAdvantageAdj = 0;
  let homeAttackAdj = 0;
  let awayAttackAdj = 0;
  let h2hWeightAdj = 0;
  let safeThresholdAdj = 0;
  let mediumThresholdAdj = 0;

  const marketStats = { ...(weights.marketStats || {}) };

  fresh.forEach((bet) => {
    const isWon = bet.status === 'WON';
    const betType = bet.valueBetType || '';

    // Registro por mercado
    const market = bet.marketType || 'OTRO';
    if (!marketStats[market]) marketStats[market] = { won: 0, lost: 0 };
    if (isWon) marketStats[market].won += 1;
    else marketStats[market].lost += 1;

    if (betType.includes('Victoria Local')) {
      homeAdvantageAdj += isWon ? 0.005 : -0.01;
      homeAttackAdj += isWon ? 0.005 : -0.01;
    }

    if (betType.includes('Victoria Visitante')) {
      awayAttackAdj += isWon ? 0.005 : -0.01;
    }

    if (betType.includes('Handicap') || betType.includes('Victoria')) {
      h2hWeightAdj += isWon ? 0.003 : -0.005;
    }

    if (bet.riskLevel === 'SAFE') {
      // Un pick "seguro" que falla significa que el umbral era laxo.
      safeThresholdAdj += isWon ? -0.1 : 0.5;
    } else if (bet.riskLevel === 'MEDIUM') {
      mediumThresholdAdj += isWon ? -0.1 : 0.5;
    }

    processed.add(betId(bet));
  });

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  weights.homeAdvantage = clamp(weights.homeAdvantage + homeAdvantageAdj, 1.0, 1.30);
  weights.homeAttackMultiplier = clamp(weights.homeAttackMultiplier + homeAttackAdj, 0.80, 1.20);
  weights.awayAttackMultiplier = clamp(weights.awayAttackMultiplier + awayAttackAdj, 0.80, 1.20);
  weights.h2hBaseWeight = clamp(weights.h2hBaseWeight + h2hWeightAdj, 0.30, 0.90);
  weights.safeThreshold = clamp((weights.safeThreshold || 70) + safeThresholdAdj, 65, 85);
  weights.mediumThreshold = clamp((weights.mediumThreshold || 58) + mediumThresholdAdj, 50, 65);
  weights.marketStats = marketStats;
  weights.processedIds = [...processed].slice(-MAX_PROCESSED_IDS);
  weights.updatedAt = new Date().toISOString();

  saveWeights(weights);
  return weights;
}
