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
  starPickMinProbability: 65
};

// Utility to read weights
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

// Utility to save weights
function saveWeights(weights) {
  try {
    const dir = path.dirname(WEIGHTS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(weights, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving optimized weights:', err);
  }
}

// Learn/Optimize weights based on resolved predictions history
export function learn(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return getWeights();
  }

  const weights = getWeights();

  // Keep track of adjustments
  let homeAdvantageAdj = 0;
  let homeAttackAdj = 0;
  let awayAttackAdj = 0;
  let h2hWeightAdj = 0;

  // Scan through prediction history
  history.forEach(bet => {
    const isWon = bet.status === 'WON';
    const betType = bet.valueBetType || '';

    // Victoria Local (Home Win)
    if (betType.includes('Victoria Local')) {
      if (!isWon) {
        // Overestimated home side
        homeAdvantageAdj -= 0.01;
        homeAttackAdj -= 0.01;
      } else {
        // Accurate home win prediction
        homeAdvantageAdj += 0.005;
        homeAttackAdj += 0.005;
      }
    }

    // Victoria Visitante (Away Win)
    if (betType.includes('Victoria Visitante')) {
      if (!isWon) {
        // Overestimated away side
        awayAttackAdj -= 0.01;
      } else {
        // Accurate away win prediction
        awayAttackAdj += 0.005;
      }
    }

    // Direct H2H weight calibration
    // If H2H is high and we are winning predictions early, h2h is good.
    // If we are losing predictions early in the season, h2h weight might be too high or low.
    // Let's adjust slightly based on overall accuracy
    if (betType.includes('Handicap') || betType.includes('Victoria')) {
      if (!isWon) {
        h2hWeightAdj -= 0.005; // Slightly rely less on H2H if failing
      } else {
        h2hWeightAdj += 0.003; // Slightly rely more on H2H if winning
      }
    }
  });

  // Apply adjustments with strict boundaries to avoid wild predictions
  weights.homeAdvantage = Math.max(1.0, Math.min(1.30, weights.homeAdvantage + homeAdvantageAdj));
  weights.homeAttackMultiplier = Math.max(0.80, Math.min(1.20, weights.homeAttackMultiplier + homeAttackAdj));
  weights.awayAttackMultiplier = Math.max(0.80, Math.min(1.20, weights.awayAttackMultiplier + awayAttackAdj));
  weights.h2hBaseWeight = Math.max(0.30, Math.min(0.90, weights.h2hBaseWeight + h2hWeightAdj));

  saveWeights(weights);
  return weights;
}
