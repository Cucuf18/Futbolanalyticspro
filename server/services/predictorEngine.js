/**
 * Statistical Football Prediction Engine using Poisson Distribution,
 * Dixon-Coles expected goals (xG) matrix, form weighting decay,
 * and Monte Carlo simulation with match event modeling.
 */

// Helper to calculate factorial k!
function factorial(n) {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

// Calculate Poisson probability P(X = k) for parameter lambda
function poisson(k, lambda) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// Generate random number from Poisson distribution (Knuth algorithm)
function generatePoissonRandom(lambda) {
  const L = Math.exp(-lambda);
  let p = 1.0;
  let k = 0;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

/**
 * Calculate Form multiplier based on 5-match sequence
 * @param {Array<string>} formArray Array of 'W', 'D', 'L'
 */
function calculateFormMultiplier(formArray = []) {
  if (!formArray || formArray.length === 0) return 1.0;
  
  const weights = [0.35, 0.25, 0.20, 0.12, 0.08];
  let points = 0;
  let totalWeight = 0;

  formArray.slice(0, 5).forEach((result, idx) => {
    const w = weights[idx] || 0.1;
    totalWeight += w;
    if (result === 'W') points += 3 * w;
    else if (result === 'D') points += 1 * w;
  });

  const maxPoints = 3 * totalWeight;
  const ratio = points / maxPoints;
  return 0.82 + ratio * 0.36;
}

/**
 * Run Monte Carlo simulation with full match event modeling.
 * Simulates goals, cards, offsides, shots on target, and corners.
 */
function runMonteCarloSimulation(xG_Home, xG_Away, homeStrength, awayStrength, iterations = 10000) {
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let bttsCount = 0;

  const scoreFrequencies = {};
  
  // Accumulators for match events
  let totalGoals = 0;
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  let totalYellowCards = 0;
  let totalOffsides = 0;
  let totalShotsOnTarget = 0;
  let totalCorners = 0;

  // League average parameters for Poisson event modeling
  // These are per-match averages from top European leagues
  const avgYellowCards = 4.2;   // ~4.2 yellows per match
  const avgOffsides = 3.8;      // ~3.8 offsides per match
  const avgShotsOnTarget = 9.5; // ~9.5 shots on target per match
  const avgCorners = 10.2;      // ~10.2 corners per match

  // Adjust event rates based on team strength differential
  // Stronger attacking teams generate more shots/corners, weaker teams commit more fouls
  const homeAttackFactor = 0.7 + homeStrength * 0.6;  // 0.7 to 1.3
  const awayAttackFactor = 0.7 + awayStrength * 0.6;
  const combinedIntensity = (homeAttackFactor + awayAttackFactor) / 2;

  // Cards increase when there's a big strength gap (weaker team fouls more)
  const strengthGap = Math.abs(homeStrength - awayStrength);
  const cardsFactor = 1.0 + strengthGap * 0.3;

  for (let i = 0; i < iterations; i++) {
    const hGoals = generatePoissonRandom(xG_Home);
    const aGoals = generatePoissonRandom(xG_Away);

    if (hGoals > aGoals) homeWins++;
    else if (hGoals === aGoals) draws++;
    else awayWins++;

    if (hGoals > 0 && aGoals > 0) bttsCount++;

    totalGoals += hGoals + aGoals;
    totalHomeGoals += hGoals;
    totalAwayGoals += aGoals;

    const scoreStr = `${hGoals}-${aGoals}`;
    scoreFrequencies[scoreStr] = (scoreFrequencies[scoreStr] || 0) + 1;

    // Simulate match events using Poisson with adjusted parameters
    totalYellowCards += generatePoissonRandom(avgYellowCards * cardsFactor);
    totalOffsides += generatePoissonRandom(avgOffsides * combinedIntensity);
    totalShotsOnTarget += generatePoissonRandom(avgShotsOnTarget * combinedIntensity);
    totalCorners += generatePoissonRandom(avgCorners * combinedIntensity);
  }

  // Find top 3 most common scores
  const topScores = Object.entries(scoreFrequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([score, count]) => ({ score, count, percentage: Math.round((count / iterations) * 100) }));

  return {
    iterations,
    results: {
      homeWins,
      draws,
      awayWins,
      homeWinPct: Math.round((homeWins / iterations) * 100),
      drawPct: Math.round((draws / iterations) * 100),
      awayWinPct: Math.round((awayWins / iterations) * 100),
    },
    topScores,
    matchSummary: {
      avgTotalGoals: Number((totalGoals / iterations).toFixed(1)),
      avgHomeGoals: Number((totalHomeGoals / iterations).toFixed(1)),
      avgAwayGoals: Number((totalAwayGoals / iterations).toFixed(1)),
      bttsPct: Math.round((bttsCount / iterations) * 100),
      avgYellowCards: Number((totalYellowCards / iterations).toFixed(1)),
      avgOffsides: Number((totalOffsides / iterations).toFixed(1)),
      avgShotsOnTarget: Number((totalShotsOnTarget / iterations).toFixed(1)),
      avgCorners: Number((totalCorners / iterations).toFixed(1)),
    },
  };
}

/**
 * Main function to predict match probabilities and metrics
 */
export function calculateMatchPrediction(homeStats, awayStats, h2hHistory = []) {
  const leagueAvgGoals = 1.38;
  const homeAdvantage = 1.14;

  const homeFormMultiplier = calculateFormMultiplier(homeStats.form);
  const awayFormMultiplier = calculateFormMultiplier(awayStats.form);

  // ==============================================================
  // 1. SUAVIZADO DE LAPLACE (Regresión a la Media)
  // Añadimos partidos ficticios con promedios de liga si N < 5
  // ==============================================================
  const smoothingMatches = Math.max(0, 5 - homeStats.played);
  const smoothedHomePlayed = Math.max(homeStats.played, 1) + smoothingMatches;
  const smoothedAwayPlayed = Math.max(awayStats.played, 1) + smoothingMatches;

  const smoothedHomeGF = homeStats.goalsFor + (leagueAvgGoals * smoothingMatches);
  const smoothedHomeGA = homeStats.goalsAgainst + (leagueAvgGoals * smoothingMatches);
  
  const smoothedAwayGF = awayStats.goalsFor + (leagueAvgGoals * smoothingMatches);
  const smoothedAwayGA = awayStats.goalsAgainst + (leagueAvgGoals * smoothingMatches);

  const homeAttack = ((smoothedHomeGF / smoothedHomePlayed) / leagueAvgGoals) * homeFormMultiplier;
  const homeDefense = ((smoothedHomeGA / smoothedHomePlayed) / leagueAvgGoals);

  const awayAttack = ((smoothedAwayGF / smoothedAwayPlayed) / leagueAvgGoals) * awayFormMultiplier;
  const awayDefense = ((smoothedAwayGA / smoothedAwayPlayed) / leagueAvgGoals);

  let base_xG_Home = homeAttack * awayDefense * leagueAvgGoals * homeAdvantage;
  let base_xG_Away = awayAttack * homeDefense * leagueAvgGoals;

  // ==============================================================
  // 2. PONDERACIÓN DEL HISTORIAL DIRECTO (H2H)
  // El H2H pesa más a inicio de temporada (hasta 70%) y baja progresivamente
  // ==============================================================
  if (h2hHistory && h2hHistory.length > 0) {
    let h2hGoalsHome = 0;
    let h2hGoalsAway = 0;
    let totalWeight = 0;
    
    const now = new Date();
    const twoYearsAgo = new Date(now.getTime() - (2 * 365 * 24 * 60 * 60 * 1000));

    h2hHistory.forEach(m => {
      // Aplicar Factor de Decaimiento (Time Decay)
      const matchDate = new Date(m.date);
      const isRecent = matchDate >= twoYearsAgo;
      const decayWeight = isRecent ? 0.70 : 0.30;

      // Aplicar Peso de Competición (Competition Weight)
      const primaryLeagues = ['Primera Division', 'Premier League', 'Serie A', 'La Liga'];
      const isPrimaryLeague = m.competition ? primaryLeagues.some(l => m.competition.includes(l)) : true;
      const compWeight = isPrimaryLeague ? 1.0 : 0.6;

      const finalWeight = decayWeight * compWeight;

      h2hGoalsHome += m.homeScore * finalWeight;
      h2hGoalsAway += m.awayScore * finalWeight;
      totalWeight += finalWeight;
    });

    const avgH2H_Home = totalWeight > 0 ? h2hGoalsHome / totalWeight : 0;
    const avgH2H_Away = totalWeight > 0 ? h2hGoalsAway / totalWeight : 0;

    // Peso global del H2H: 70% si N=0, decrece 5% por cada partido jugado (mínimo 20%)
    const h2hWeight = Math.max(0.20, 0.70 - (homeStats.played * 0.05)); 
    const formWeight = 1.0 - h2hWeight;

    base_xG_Home = (base_xG_Home * formWeight) + (avgH2H_Home * h2hWeight);
    base_xG_Away = (base_xG_Away * formWeight) + (avgH2H_Away * h2hWeight);
  }

  // Pisos estadísticos
  let xG_Home = Math.max(0.35, base_xG_Home);
  let xG_Away = Math.max(0.25, base_xG_Away);

  // ==============================================================
  // 3. LÍMITE DE CONFIANZA (CLIPPING)
  // Evitar xG irreales (ej. > 3.0) si la muestra de la temporada es pequeña (<10)
  // ==============================================================
  const maxSafe_xG = homeStats.played >= 10 ? 4.5 : 3.0;
  xG_Home = Math.min(xG_Home, maxSafe_xG);
  xG_Away = Math.min(xG_Away, maxSafe_xG);

  // Fuerza de equipo (0 a 1) para Monte Carlo
  const homeStrength = 1 - (homeStats.position - 1) / 20;
  const awayStrength = 1 - (awayStats.position - 1) / 20;

  // Construir Matriz de Poisson 6x6
  let probHomeWin = 0;
  let probDraw = 0;
  let probAwayWin = 0;
  let probOver25 = 0;
  let probBTTS = 0;

  let maxScoreProb = -1;
  let mostLikelyScore = { home: 1, away: 0 };

  for (let h = 0; h <= 6; h++) {
    const pHome = poisson(h, xG_Home);
    for (let a = 0; a <= 6; a++) {
      const pAway = poisson(a, xG_Away);
      const cellProb = pHome * pAway;

      if (h > a) probHomeWin += cellProb;
      else if (h === a) probDraw += cellProb;
      else probAwayWin += cellProb;

      if (h + a > 2.5) probOver25 += cellProb;
      if (h > 0 && a > 0) probBTTS += cellProb;

      if (cellProb > maxScoreProb) {
        maxScoreProb = cellProb;
        mostLikelyScore = { home: h, away: a };
      }
    }
  }

  // Normalizar
  const totalProb = probHomeWin + probDraw + probAwayWin;
  const pctHomeWin = Math.round((probHomeWin / totalProb) * 100);
  const pctDraw = Math.round((probDraw / totalProb) * 100);
  const pctAwayWin = 100 - pctHomeWin - pctDraw;

  const pctOver25 = Math.round(probOver25 * 100);
  const pctBTTS = Math.round(probBTTS * 100);

  // ==============================================================
  // 4. AJUSTE DEL VALUE BET
  // Regresamos cuotas extremas a un límite conservador (máximo 70% prob) en jornadas tempranas
  // ==============================================================
  let displayHomeWin = pctHomeWin;
  let displayAwayWin = pctAwayWin;
  
  if (homeStats.played < 5) {
     displayHomeWin = Math.min(pctHomeWin, 70); // Tope 70% (Cuota min @1.42)
     displayAwayWin = Math.min(pctAwayWin, 70);
  }

  let recommendation = 'Partido Equilibrado - Sin Apuesta de Alto Valor';
  let valueBetType = 'NONE';
  let recommendedOdds = '1.85';

  if (displayHomeWin >= 60) {
    recommendation = `Victoria Local (${homeStats.name}) con Alta Probabilidad`;
    valueBetType = 'HOME_WIN';
    recommendedOdds = (100 / displayHomeWin).toFixed(2);
  } else if (displayAwayWin >= 55) {
    recommendation = `Victoria Visitante (${awayStats.name}) con Valor Estadístico`;
    valueBetType = 'AWAY_WIN';
    recommendedOdds = (100 / displayAwayWin).toFixed(2);
  } else if (pctOver25 >= 68) {
    recommendation = `Más de 2.5 Goles en el Partido (xG Combinado: ${(xG_Home + xG_Away).toFixed(2)})`;
    valueBetType = 'OVER_25';
    recommendedOdds = (100 / pctOver25).toFixed(2);
  } else if (pctBTTS >= 65) {
    recommendation = 'Ambos Equipos Anotan (BTTS Si)';
    valueBetType = 'BTTS';
    recommendedOdds = (100 / pctBTTS).toFixed(2);
  }

  const confidenceScore = Math.min(95, Math.max(62, Math.round(50 + Math.abs(pctHomeWin - pctAwayWin) * 0.5 + (h2hHistory.length * 3))));

  // Correr Monte Carlo con la nueva data ajustada
  const monteCarlo = runMonteCarloSimulation(xG_Home, xG_Away, homeStrength, awayStrength, 10000);

  return {
    probabilities: {
      homeWin: pctHomeWin, // Mandamos la real a los gráficos
      draw: pctDraw,
      awayWin: pctAwayWin,
    },
    expectedGoals: {
      home: Number(xG_Home.toFixed(2)),
      away: Number(xG_Away.toFixed(2)),
      total: Number((xG_Home + xG_Away).toFixed(2)),
    },
    probabilitiesSecondary: {
      over25: pctOver25,
      under25: 100 - pctOver25,
      btts: pctBTTS,
    },
    mostLikelyScore: `${mostLikelyScore.home} - ${mostLikelyScore.away}`,
    mostLikelyScoreProb: Math.round(maxScoreProb * 100),
    confidenceScore,
    recommendation,
    valueBetType,
    recommendedOdds,
    monteCarlo,
    calculatedAt: new Date().toISOString(),
  };
}
