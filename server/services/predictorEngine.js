import { getWeights, getMarketReliability } from './weightOptimizer.js';
import { getLeagueProfile, getSignatureBonus, getSignatureNote } from './leagueProfiles.js';
import {
  poisson,
  lineProbability,
  buildMatchProfile,
  findBestLine,
  computeDataQuality,
  calibrate,
  fairOddsFrom,
  marketOddsFrom,
  priceSelection,
  buildCountPick,
  distinctivenessFromProb,
  MIN_USEFUL_ODDS,
  clamp,
} from './marketEngine.js';

// Generate random number from Poisson distribution (Knuth algorithm)
function generatePoissonRandom(lambda) {
  if (lambda <= 0) return 0;
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
 * EMA Momentum (Media Movil Exponencial) para los ultimos 3 partidos
 */
function calculateEMAMomentum(formArray = []) {
  if (!formArray || formArray.length === 0) return 1.0;

  const weights = [0.50, 0.30, 0.20];
  let emaPoints = 0;
  let totalWeight = 0;

  formArray.slice(0, 3).forEach((result, idx) => {
    const w = weights[idx];
    totalWeight += w;
    if (result === 'W') emaPoints += 3 * w;
    else if (result === 'D') emaPoints += 1 * w;
  });

  if (totalWeight === 0) return 1.0;
  const ratio = emaPoints / (3 * totalWeight); // 0.0 a 1.0
  return 0.85 + ratio * 0.40;
}

/**
 * Penalizacion por Fatiga basada en dias de descanso
 */
function calculateFatiguePenalty(lastMatchDateStr) {
  if (!lastMatchDateStr) return 1.0;
  const lastMatch = new Date(lastMatchDateStr);
  const today = new Date();
  const diffDays = Math.ceil(Math.abs(today - lastMatch) / (1000 * 60 * 60 * 24));
  if (diffDays < 4) return 0.90;
  return 1.0;
}

/**
 * Power Index (Elo-style Rating). El numero de equipos ya no esta
 * cableado a 20: la Bundesliga tiene 18 y la Champions 36, y usar 20
 * para todas deformaba la jerarquia.
 */
function calculatePowerIndex(position, totalTeams = 20) {
  const n = Math.max(totalTeams, 2);
  const baseRating = 100 - ((position - 1) / (n - 1)) * 95;
  const championsBoost = position <= 4 ? 8 : 0;
  const europaBoost = position >= 5 && position <= 7 ? 3 : 0;
  const relegationPenalty = position >= n - 2 ? -5 : 0;
  return clamp(baseRating + championsBoost + europaBoost + relegationPenalty, 5, 100);
}

function calculatePowerDifferential(teamPI, rivalPI) {
  const diff = teamPI - rivalPI; // -95 a +95
  return 1.0 + (diff / 95) * 0.15; // 0.85 a 1.15
}

/**
 * Monte Carlo. Los eventos (corners, tarjetas, remates, offsides) ya no
 * usan constantes genericas europeas: se alimentan del perfil real del
 * cruce, por lo que el resumen coincide con los picks que se muestran.
 */
function runMonteCarloSimulation(xG_Home, xG_Away, matchProfile, iterations = 10000) {
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let bttsCount = 0;

  const scoreFrequencies = {};

  let totalGoals = 0;
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  let totalYellowCards = 0;
  let totalOffsides = 0;
  let totalShotsOnTarget = 0;
  let totalCorners = 0;

  const lambdaCards = matchProfile.cards.total;
  const lambdaOffsides = matchProfile.offsides.total;
  const lambdaSot = matchProfile.sot.total;
  const lambdaCorners = matchProfile.corners.total;

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

    totalYellowCards += generatePoissonRandom(lambdaCards);
    totalOffsides += generatePoissonRandom(lambdaOffsides);
    totalShotsOnTarget += generatePoissonRandom(lambdaSot);
    totalCorners += generatePoissonRandom(lambdaCorners);
  }

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
 * Asian Handicap Engine: busca la linea que deja la probabilidad de
 * cubrir mas cerca del 50%.
 */
function calculateAsianHandicap(xG_Home, xG_Away) {
  const lines = [-2.5, -2.0, -1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0, 2.5];
  let bestLine = 0;
  let minDiff = 100;
  let finalHomeProb = 0;
  let finalAwayProb = 0;

  for (const line of lines) {
    let homeCoverProb = 0;
    let awayCoverProb = 0;

    for (let h = 0; h <= 10; h++) {
      const pHome = poisson(h, xG_Home);
      for (let a = 0; a <= 10; a++) {
        const prob = pHome * poisson(a, xG_Away);
        const adjustedHomeScore = h + line;
        if (adjustedHomeScore > a) homeCoverProb += prob;
        else if (adjustedHomeScore < a) awayCoverProb += prob;
      }
    }

    const totalCoverProb = homeCoverProb + awayCoverProb;
    if (totalCoverProb > 0) {
      const normHome = (homeCoverProb / totalCoverProb) * 100;
      const diff = Math.abs(normHome - 50);
      if (diff < minDiff) {
        minDiff = diff;
        bestLine = line;
        finalHomeProb = Math.round(normHome);
        finalAwayProb = Math.round((awayCoverProb / totalCoverProb) * 100);
      }
    }
  }

  const formatLine = (l) => (l > 0 ? `+${l}` : l === 0 ? '0' : `${l}`);

  return {
    line: bestLine,
    homeLabel: `AH ${formatLine(bestLine)}`,
    awayLabel: `AH ${formatLine(-bestLine)}`,
    homeProb: finalHomeProb,
    awayProb: finalAwayProb,
    homeFairOdds: fairOddsFrom(finalHomeProb),
    awayFairOdds: fairOddsFrom(finalAwayProb),
  };
}

/* ══════════════════════════════════════════════════════════════════
   MOTOR DE PICKS
   ══════════════════════════════════════════════════════════════════ */

const sideWord = (side) => (side === 'OVER' ? 'Mas de' : 'Menos de');

/**
 * Convierte cualquier pick en un objeto homogeneo con cuota realista,
 * valor esperado y grupo de correlacion.
 */
function finalizePick(pick) {
  // Si el pick no trae precio propio (mercados no basados en lineas), se
  // calcula aqui con el mismo modelo dual: cuota estimada de la casa a
  // partir de la probabilidad cruda, cuota minima desde la calibrada.
  const price = pick.marketOdds
    ? {
        marketOdds: pick.marketOdds,
        breakEvenOdds: pick.breakEvenOdds ?? fairOddsFrom(pick.probability),
        hasValue: pick.hasValue,
        edge: pick.edge,
      }
    : priceSelection(pick.rawProbability ?? pick.probability, pick.probability);

  return {
    ...pick,
    ...price,
    fairOdds: price.breakEvenOdds,
    selectionScore: pick.selectionScore ?? pick.probability,
    correlationGroup: pick.correlationGroup || pick.marketType,
  };
}

/**
 * Un pick cuya cuota real esta por debajo del minimo util no se muestra,
 * por mucho que su probabilidad sea altisima. Es lo que elimina los
 * "Mas de 0.5 goles" y las victorias del favoritisimo a @1.03.
 */
function isUsable(pick) {
  return pick && pick.marketOdds >= MIN_USEFUL_ODDS;
}

/**
 * Genera TODOS los picks candidatos del partido.
 *
 * Regla de oro: ninguna linea es fija. Cada mercado calcula su media a
 * partir de los dos contrincantes concretos y del perfil de la liga, y
 * despues se busca la linea que mejor equilibra seguridad y cuota util.
 */
function buildCandidatePicks(ctx) {
  const {
    homeStats, awayStats, matchProfile, dataQuality, leagueProfile,
    xG_Home, xG_Away, asianHandicap, probs, h2hCount,
  } = ctx;

  const disp = leagueProfile.dispersion;
  const picks = [];
  const push = (p) => {
    if (!p) return;
    const finalized = finalizePick(p);
    if (isUsable(finalized)) picks.push(finalized);
  };

  const homeName = homeStats.shortName || homeStats.name;
  const awayName = awayStats.shortName || awayStats.name;
  const band = [58, 93];

  /**
   * Tasas base del futbol para los mercados que no son de conteo. Sirven
   * para medir si un pick dice algo de ESTE partido o si saldria igual en
   * cualquier otro (un "no hay empate" ronda el 74% en todas las ligas y
   * por eso aparecia en la mitad de los partidos).
   */
  const BASE_RATES = { HOME_WIN: 44, AWAY_WIN: 29, DC_1X: 71, DC_X2: 55, DC_12: 74, BTTS: 51, AH: 50, SCORES: 76 };

  /**
   * Senal direccional del cruce: se compara la media esperada con la
   * base de la liga. Si este partido promete mas corners que la media de
   * su competicion, se prioriza el Over; si promete menos, el Under.
   */
  const hint = (mean, leagueBaseTotal) => (mean >= leagueBaseTotal ? 'OVER' : 'UNDER');

  /* ─── 1X2 ─────────────────────────────────────────────────────── */
  const pHome = calibrate(probs.homeWin, dataQuality);
  const pDraw = calibrate(probs.draw, dataQuality);
  const pAway = calibrate(probs.awayWin, dataQuality);

  if (pHome >= 55) {
    push({
      type: 'HOME_WIN',
      label: `Victoria Local (${homeStats.name})`,
      probability: pHome,
      rawProbability: probs.homeWin,
      distinctiveness: distinctivenessFromProb(pHome, BASE_RATES.HOME_WIN),
      selectionScore: pHome + distinctivenessFromProb(pHome, BASE_RATES.HOME_WIN),
      marketType: 'RESULTADO',
      correlationGroup: 'RESULTADO',
      evThreshold: 'EV+',
      reasons: [
        `xG esperado ${xG_Home.toFixed(2)} - ${xG_Away.toFixed(2)} a favor de ${homeName}.`,
        `${homeName} llega ${homeStats.position}o y ${awayName} ${awayStats.position}o en la tabla.`,
      ],
    });
  }
  if (pAway >= 52) {
    push({
      type: 'AWAY_WIN',
      label: `Victoria Visitante (${awayStats.name})`,
      probability: pAway,
      rawProbability: probs.awayWin,
      distinctiveness: distinctivenessFromProb(pAway, BASE_RATES.AWAY_WIN),
      selectionScore: pAway + distinctivenessFromProb(pAway, BASE_RATES.AWAY_WIN),
      marketType: 'RESULTADO',
      correlationGroup: 'RESULTADO',
      evThreshold: 'EV+',
      reasons: [
        `xG esperado ${xG_Home.toFixed(2)} - ${xG_Away.toFixed(2)}, con ventaja para ${awayName} pese a jugar fuera.`,
      ],
    });
  }

  /* ─── DOBLE OPORTUNIDAD ───────────────────────────────────────────
     El mercado mas util para un pick realmente seguro y el que faltaba
     por completo: cubre dos de los tres resultados posibles.          */
  const dc = [
    { key: '1X', prob: pHome + pDraw, raw: probs.homeWin + probs.draw, label: `Doble Oportunidad: ${homeName} o Empate (1X)`, why: `${homeName} evita la derrota en el ${Math.min(93, Math.round(pHome + pDraw))}% de las simulaciones.` },
    { key: 'X2', prob: pDraw + pAway, raw: probs.draw + probs.awayWin, label: `Doble Oportunidad: Empate o ${awayName} (X2)`, why: `${awayName} evita la derrota en el ${Math.min(93, Math.round(pDraw + pAway))}% de las simulaciones.` },
    { key: '12', prob: pHome + pAway, raw: probs.homeWin + probs.awayWin, label: 'Doble Oportunidad: No hay empate (12)', why: `El empate solo aparece en el ${pDraw}% de las simulaciones.` },
  ];
  dc.forEach((o) => {
    const prob = Math.min(93, Math.round(o.prob));
    if (prob >= 60) {
      push({
        type: `DC_${o.key}`,
        label: o.label,
        probability: prob,
        rawProbability: Math.min(97, Math.round(o.raw)),
        distinctiveness: distinctivenessFromProb(prob, BASE_RATES['DC_' + o.key]),
        selectionScore: prob + distinctivenessFromProb(prob, BASE_RATES['DC_' + o.key]),
        marketType: 'DOBLE',
        correlationGroup: 'RESULTADO',
        evThreshold: 'Seguro',
        reasons: [o.why, `Cruce ${homeStats.position}o vs ${awayStats.position}o: la diferencia de nivel sostiene esta cobertura.`],
      });
    }
  });

  /* ─── HANDICAP ASIATICO ───────────────────────────────────────── */
  if (asianHandicap.homeProb >= 55 || asianHandicap.awayProb >= 55) {
    const isHome = asianHandicap.homeProb >= asianHandicap.awayProb;
    const prob = calibrate(isHome ? asianHandicap.homeProb : asianHandicap.awayProb, dataQuality);
    if (prob >= 55) {
      push({
        type: `AH_${isHome ? 'HOME' : 'AWAY'}_${isHome ? asianHandicap.line : -asianHandicap.line}`,
        label: `Handicap Asiatico ${isHome ? homeName : awayName}: ${isHome ? asianHandicap.homeLabel : asianHandicap.awayLabel}`,
        probability: prob,
        rawProbability: isHome ? asianHandicap.homeProb : asianHandicap.awayProb,
        distinctiveness: distinctivenessFromProb(prob, BASE_RATES.AH),
        selectionScore: prob + distinctivenessFromProb(prob, BASE_RATES.AH),
        marketType: 'HANDICAP',
        correlationGroup: 'RESULTADO',
        evThreshold: 'EV+',
        reasons: [`Linea equilibrada por el modelo para este cruce concreto (${prob}% de cubrir).`],
      });
    }
  }

  /* ─── GOLES TOTALES (linea dinamica) ──────────────────────────── */
  const totalXG = xG_Home + xG_Away;
  const goalsFound = findBestLine({ mean: totalXG, dispersion: disp.goals, dataQuality, band, directionalHint: hint(totalXG, leagueProfile.goalsPerTeam * 2) });
  push(buildCountPick({
    marketType: 'GOLES',
    typePrefix: 'GOALS',
    found: goalsFound,
    leagueBaseline: leagueProfile.goalsPerTeam * 2,
    profile: leagueProfile,
    labelFor: (f) => `${sideWord(f.side)} ${f.line} Goles en el Partido`,
    reasons: goalsFound ? [`Goles esperados en este cruce: ${totalXG.toFixed(2)} (${homeName} ${xG_Home.toFixed(2)} - ${xG_Away.toFixed(2)} ${awayName}).`] : [],
  }));

  /* ─── EQUIPO MARCA ────────────────────────────────────────────── */
  [
    { name: homeName, xg: xG_Home, key: 'HOME' },
    { name: awayName, xg: xG_Away, key: 'AWAY' },
  ].forEach((t) => {
    const raw = (1 - poisson(0, t.xg)) * 100;
    const prob = calibrate(raw, dataQuality);
    if (prob >= 62) {
      push({
        type: `${t.key}_SCORES`,
        label: `${t.name} marca al menos 1 gol`,
        probability: prob,
        rawProbability: Math.round(raw),
        distinctiveness: distinctivenessFromProb(prob, BASE_RATES.SCORES),
        selectionScore: prob + distinctivenessFromProb(prob, BASE_RATES.SCORES),
        marketType: 'GOLES',
        correlationGroup: 'GOLES',
        evThreshold: 'Estadistico',
        reasons: [`xG de ${t.name} en este partido: ${t.xg.toFixed(2)}.`],
      });
    }
  });

  /* ─── BTTS ────────────────────────────────────────────────────── */
  const bttsProb = calibrate(probs.btts, dataQuality);
  const bttsNoProb = calibrate(100 - probs.btts, dataQuality);
  const bttsSide = bttsProb >= bttsNoProb
    ? { prob: bttsProb, raw: probs.btts, label: 'Ambos Equipos Anotan: SI', why: `Ambos ataques superan el gol esperado (${xG_Home.toFixed(2)} y ${xG_Away.toFixed(2)}).` }
    : { prob: bttsNoProb, raw: 100 - probs.btts, label: 'Ambos Equipos Anotan: NO', why: `Al menos uno de los dos ataques se queda corto (${xG_Home.toFixed(2)} y ${xG_Away.toFixed(2)} de xG).` };
  if (bttsSide.prob >= 60) {
    push({
      type: bttsProb >= bttsNoProb ? 'BTTS_YES' : 'BTTS_NO',
      label: bttsSide.label,
      probability: bttsSide.prob,
      rawProbability: bttsSide.raw,
      marketType: 'BTTS',
      correlationGroup: 'GOLES',
      distinctiveness: distinctivenessFromProb(bttsSide.prob, BASE_RATES.BTTS),
      selectionScore: bttsSide.prob + getSignatureBonus(leagueProfile, 'BTTS') + distinctivenessFromProb(bttsSide.prob, BASE_RATES.BTTS),
      evThreshold: 'EV+',
      reasons: [bttsSide.why, getSignatureNote(leagueProfile, 'BTTS')].filter(Boolean),
    });
  }

  /* ─── CORNERS ─────────────────────────────────────────────────── */
  const cornersFound = findBestLine({ mean: matchProfile.corners.total, dispersion: disp.corners, dataQuality, band, directionalHint: hint(matchProfile.corners.total, leagueProfile.cornersPerTeam * 2) });
  push(buildCountPick({
    marketType: 'CORNERS',
    typePrefix: 'CORNERS',
    found: cornersFound,
    leagueBaseline: leagueProfile.cornersPerTeam * 2,
    profile: leagueProfile,
    labelFor: (f) => `${sideWord(f.side)} ${f.line} Corners`,
    reasons: cornersFound ? [
      `Corners esperados: ${matchProfile.corners.total.toFixed(1)} (${homeName} ${matchProfile.corners.home.toFixed(1)} / ${awayName} ${matchProfile.corners.away.toFixed(1)}).`,
      matchProfile.gap > 0.35 ? 'Diferencia de nivel amplia: el favorito acumula corners contra un rival replegado.' : '',
    ].filter(Boolean) : [],
  }));

  // Corners del equipo dominante (mercado propio, muy usado en Betano)
  const dominant = matchProfile.corners.home >= matchProfile.corners.away
    ? { name: homeName, mean: matchProfile.corners.home, key: 'HOME' }
    : { name: awayName, mean: matchProfile.corners.away, key: 'AWAY' };
  const domCorners = findBestLine({ mean: dominant.mean, dispersion: disp.corners, dataQuality, band, directionalHint: hint(dominant.mean, leagueProfile.cornersPerTeam) });
  push(buildCountPick({
    marketType: 'CORNERS',
    typePrefix: `CORNERS_${dominant.key}`,
    found: domCorners,
    leagueBaseline: leagueProfile.cornersPerTeam,
    profile: leagueProfile,
    correlationGroup: 'CORNERS',
    labelFor: (f) => `${dominant.name}: ${sideWord(f.side)} ${f.line} Corners`,
    reasons: domCorners ? [`Corners esperados solo de ${dominant.name}: ${dominant.mean.toFixed(1)}.`] : [],
  }));

  /* ─── TARJETAS ────────────────────────────────────────────────── */
  const cardsFound = findBestLine({ mean: matchProfile.cards.total, dispersion: disp.cards, dataQuality, band, directionalHint: hint(matchProfile.cards.total, leagueProfile.cardsPerTeam * 2) });
  push(buildCountPick({
    marketType: 'TARJETAS',
    typePrefix: 'CARDS',
    found: cardsFound,
    leagueBaseline: leagueProfile.cardsPerTeam * 2,
    profile: leagueProfile,
    labelFor: (f) => `${sideWord(f.side)} ${f.line} Tarjetas Amarillas`,
    reasons: cardsFound ? [
      `Tarjetas esperadas: ${matchProfile.cards.total.toFixed(1)} segun el perfil disciplinario de ambos equipos.`,
      matchProfile.isDerby ? `Rivalidad marcada (${h2hCount} enfrentamientos directos registrados): la linea sube.` : '',
      leagueProfile.disciplineNote,
    ].filter(Boolean) : [],
  }));

  /* ─── FALTAS ──────────────────────────────────────────────────── */
  const foulsFound = findBestLine({ mean: matchProfile.fouls.total, dispersion: disp.fouls, dataQuality, band, directionalHint: hint(matchProfile.fouls.total, leagueProfile.foulsPerTeam * 2) });
  push(buildCountPick({
    marketType: 'FALTAS',
    typePrefix: 'FOULS',
    found: foulsFound,
    leagueBaseline: leagueProfile.foulsPerTeam * 2,
    profile: leagueProfile,
    labelFor: (f) => `${sideWord(f.side)} ${f.line} Faltas`,
    reasons: foulsFound ? [`Faltas esperadas en el cruce: ${matchProfile.fouls.total.toFixed(1)}.`] : [],
  }));

  /* ─── REMATES TOTALES ─────────────────────────────────────────── */
  const shotsFound = findBestLine({ mean: matchProfile.shots.total, dispersion: disp.shots, dataQuality, band, directionalHint: hint(matchProfile.shots.total, leagueProfile.shotsPerTeam * 2) });
  push(buildCountPick({
    marketType: 'TIROS',
    typePrefix: 'SHOTS',
    found: shotsFound,
    leagueBaseline: leagueProfile.shotsPerTeam * 2,
    profile: leagueProfile,
    labelFor: (f) => `${sideWord(f.side)} ${f.line} Remates Totales`,
    reasons: shotsFound ? [`Remates esperados: ${matchProfile.shots.total.toFixed(1)} (${homeName} ${matchProfile.shots.home.toFixed(1)} / ${awayName} ${matchProfile.shots.away.toFixed(1)}).`] : [],
  }));

  /* ─── TIROS A PUERTA POR EQUIPO ───────────────────────────────── */
  [
    { name: homeName, mean: matchProfile.sot.home, key: 'HOME_SOT' },
    { name: awayName, mean: matchProfile.sot.away, key: 'AWAY_SOT' },
  ].forEach((t) => {
    const found = findBestLine({ mean: t.mean, dispersion: disp.sot, dataQuality, band, directionalHint: hint(t.mean, leagueProfile.sotPerTeam) });
    push(buildCountPick({
      marketType: 'TIROS',
      typePrefix: t.key,
      found,
      profile: leagueProfile,
      correlationGroup: 'TIROS',
      leagueBaseline: leagueProfile.sotPerTeam,
      labelFor: (f) => `${t.name}: ${sideWord(f.side)} ${f.line} Tiros a Puerta`,
      reasons: found ? [`Tiros a puerta esperados de ${t.name}: ${t.mean.toFixed(1)}.`] : [],
    }));
  });

  /* ─── OFFSIDES ────────────────────────────────────────────────── */
  const offsidesFound = findBestLine({ mean: matchProfile.offsides.total, dispersion: disp.offsides, dataQuality, band, directionalHint: hint(matchProfile.offsides.total, leagueProfile.offsidesPerTeam * 2) });
  push(buildCountPick({
    marketType: 'OFFSIDES',
    typePrefix: 'OFFSIDES',
    found: offsidesFound,
    leagueBaseline: leagueProfile.offsidesPerTeam * 2,
    profile: leagueProfile,
    labelFor: (f) => `${sideWord(f.side)} ${f.line} Fueras de Juego`,
    reasons: offsidesFound ? [`Fueras de juego esperados: ${matchProfile.offsides.total.toFixed(1)}.`] : [],
  }));

  return picks;
}

/**
 * Reparte los candidatos en los tres niveles de riesgo y garantiza
 * exactamente 3 picks seguros DIVERSOS (nunca dos del mismo grupo
 * correlacionado) y siempre derivados de este cruce concreto.
 */
function organizePicks(candidates, weights) {
  const safeMin = weights.safeThreshold ?? 70;
  const mediumMin = weights.mediumThreshold ?? 58;

  // El motor aprende de sus propios resultados: los mercados que
  // historicamente aciertan suben en el orden de seleccion, los que
  // fallan bajan. Solo afecta al ORDEN, nunca a la probabilidad.
  const scored = candidates.map((p) => ({
    ...p,
    reliability: getMarketReliability(p.marketType),
    selectionScore: p.selectionScore + getMarketReliability(p.marketType),
  }));

  // Deduplicar por tipo, quedandonos con el de mejor score
  const byType = new Map();
  scored.forEach((p) => {
    const prev = byType.get(p.type);
    if (!prev || p.selectionScore > prev.selectionScore) byType.set(p.type, p);
  });
  const all = [...byType.values()].sort((a, b) => b.selectionScore - a.selectionScore);

  const usedGroups = new Set();
  const safe = [];

  // Pasada 1: el mejor pick de cada grupo que supere el umbral seguro
  for (const p of all) {
    if (safe.length >= 3) break;
    if (p.probability < safeMin) continue;
    if (usedGroups.has(p.correlationGroup)) continue;
    safe.push(p);
    usedGroups.add(p.correlationGroup);
  }

  // Pasada 2: si faltan, se relaja el umbral progresivamente pero SIEMPRE
  // con picks calculados para este partido (nunca lineas genericas).
  for (const relaxed of [mediumMin, 50]) {
    for (const p of all) {
      if (safe.length >= 3) break;
      if (safe.includes(p)) continue;
      if (p.probability < relaxed) continue;
      if (usedGroups.has(p.correlationGroup)) continue;
      safe.push(p);
      usedGroups.add(p.correlationGroup);
    }
  }

  // Pasada 3 (extrema): completar aunque se repita grupo.
  for (const p of all) {
    if (safe.length >= 3) break;
    if (!safe.includes(p)) safe.push(p);
  }

  safe.sort((a, b) => b.probability - a.probability);
  const safeSet = new Set(safe);

  const rest = all.filter((p) => !safeSet.has(p));
  const medium = rest.filter((p) => p.probability >= mediumMin).sort((a, b) => b.probability - a.probability);
  const risky = rest.filter((p) => p.probability < mediumMin).sort((a, b) => b.edge - a.edge || b.probability - a.probability);

  return {
    safe: safe.slice(0, 3),
    medium: medium.slice(0, 6),
    risky: risky.slice(0, 6),
  };
}

/* ══════════════════════════════════════════════════════════════════
   PREDICCION PRINCIPAL
   ══════════════════════════════════════════════════════════════════ */

export function calculateMatchPrediction(
  homeStats,
  awayStats,
  h2hHistory = [],
  homeExt = null,
  awayExt = null,
  options = {}
) {
  const weights = getWeights();
  const leagueId = options.leagueId || 'PL';
  const leagueProfile = getLeagueProfile(leagueId);
  const totalTeams = leagueProfile.teamsCount;

  // Media goleadora REAL de la liga en lugar de un 1.38 universal.
  const leagueAvgGoals = leagueProfile.goalsPerTeam;
  // La ventaja de campo tambien es especifica de cada competicion.
  const homeAdvantage = leagueProfile.homeAdvantage * (weights.homeAdvantage / 1.14);

  const homeFormRaw = calculateEMAMomentum(homeStats.form);
  const awayFormRaw = calculateEMAMomentum(awayStats.form);
  const homeFormMultiplier = 1.0 + (homeFormRaw - 1.0) * weights.emaWeight;
  const awayFormMultiplier = 1.0 + (awayFormRaw - 1.0) * weights.emaWeight;

  const homeFatigueRaw = calculateFatiguePenalty(homeStats.lastMatchDate);
  const awayFatigueRaw = calculateFatiguePenalty(awayStats.lastMatchDate);
  const homeFatigue = homeFatigueRaw < 1.0 ? 1.0 - (1.0 - homeFatigueRaw) * weights.fatigueMultiplier : 1.0;
  const awayFatigue = awayFatigueRaw < 1.0 ? 1.0 - (1.0 - awayFatigueRaw) * weights.fatigueMultiplier : 1.0;

  // ── 1. SUAVIZADO DE LAPLACE (por equipo, no compartido) ──
  const homeSmoothing = Math.max(0, 5 - (homeStats.played || 0));
  const awaySmoothing = Math.max(0, 5 - (awayStats.played || 0));
  const smoothedHomePlayed = Math.max(homeStats.played, 1) + homeSmoothing;
  const smoothedAwayPlayed = Math.max(awayStats.played, 1) + awaySmoothing;

  const smoothedHomeGF = homeStats.goalsFor + leagueAvgGoals * homeSmoothing;
  const smoothedHomeGA = homeStats.goalsAgainst + leagueAvgGoals * homeSmoothing;
  const smoothedAwayGF = awayStats.goalsFor + leagueAvgGoals * awaySmoothing;
  const smoothedAwayGA = awayStats.goalsAgainst + leagueAvgGoals * awaySmoothing;

  const homeAttack = ((smoothedHomeGF / smoothedHomePlayed) / leagueAvgGoals) * homeFormMultiplier * homeFatigue * weights.homeAttackMultiplier;
  const homeDefense = (smoothedHomeGA / smoothedHomePlayed) / leagueAvgGoals;
  const awayAttack = ((smoothedAwayGF / smoothedAwayPlayed) / leagueAvgGoals) * awayFormMultiplier * awayFatigue * weights.awayAttackMultiplier;
  const awayDefense = (smoothedAwayGA / smoothedAwayPlayed) / leagueAvgGoals;

  let base_xG_Home = homeAttack * awayDefense * leagueAvgGoals * homeAdvantage;
  let base_xG_Away = awayAttack * homeDefense * leagueAvgGoals;

  // ── 2. H2H PONDERADO ──
  if (h2hHistory && h2hHistory.length > 0) {
    let h2hGoalsHome = 0;
    let h2hGoalsAway = 0;
    let totalWeight = 0;

    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);

    h2hHistory.forEach((m) => {
      const isRecent = new Date(m.date) >= twoYearsAgo;
      const decayWeight = isRecent ? 0.70 : 0.30;
      const primaryLeagues = ['Primera Division', 'Premier League', 'Serie A', 'La Liga', 'Bundesliga', 'Champions League'];
      const isPrimaryLeague = m.competition ? primaryLeagues.some((l) => m.competition.includes(l)) : true;
      const compWeight = isPrimaryLeague ? 1.0 : 0.6;
      const finalWeight = decayWeight * compWeight;

      h2hGoalsHome += m.homeScore * finalWeight;
      h2hGoalsAway += m.awayScore * finalWeight;
      totalWeight += finalWeight;
    });

    const avgH2H_Home = totalWeight > 0 ? h2hGoalsHome / totalWeight : 0;
    const avgH2H_Away = totalWeight > 0 ? h2hGoalsAway / totalWeight : 0;

    const h2hWeight = Math.max(0.20, weights.h2hBaseWeight - homeStats.played * 0.05);
    const formWeight = 1.0 - h2hWeight;

    base_xG_Home = base_xG_Home * formWeight + avgH2H_Home * h2hWeight;
    base_xG_Away = base_xG_Away * formWeight + avgH2H_Away * h2hWeight;
  }

  // ── 3. POWER INDEX ──
  const homePI = calculatePowerIndex(homeStats.position, totalTeams);
  const awayPI = calculatePowerIndex(awayStats.position, totalTeams);
  base_xG_Home *= calculatePowerDifferential(homePI, awayPI);
  base_xG_Away *= calculatePowerDifferential(awayPI, homePI);

  let xG_Home = Math.max(0.35, base_xG_Home);
  let xG_Away = Math.max(0.25, base_xG_Away);

  // ── 4. CLIPPING DE CONFIANZA ──
  const maxSafe_xG = homeStats.played >= 10 ? 4.5 : 3.0;
  xG_Home = Math.min(xG_Home, maxSafe_xG);
  xG_Away = Math.min(xG_Away, maxSafe_xG);

  // ── 5. MATRIZ DE POISSON ──
  let probHomeWin = 0;
  let probDraw = 0;
  let probAwayWin = 0;
  let probOver25 = 0;
  let probBTTS = 0;
  let maxScoreProb = -1;
  let mostLikelyScore = { home: 1, away: 0 };

  for (let h = 0; h <= 8; h++) {
    const pHome = poisson(h, xG_Home);
    for (let a = 0; a <= 8; a++) {
      const cellProb = pHome * poisson(a, xG_Away);

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

  const totalProb = probHomeWin + probDraw + probAwayWin;
  const pctHomeWin = Math.round((probHomeWin / totalProb) * 100);
  const pctDraw = Math.round((probDraw / totalProb) * 100);
  const pctAwayWin = 100 - pctHomeWin - pctDraw;
  const pctOver25 = Math.round(probOver25 * 100);
  const pctBTTS = Math.round(probBTTS * 100);

  // ── 6. CALIDAD DE DATOS Y PERFIL DEL CRUCE ──
  const dataQuality = computeDataQuality({
    played: Math.min(homeStats.played || 0, awayStats.played || 0),
    h2hCount: h2hHistory.length,
    hasExternalStats: Boolean(homeExt && awayExt),
    isLiveData: options.isLiveData === true,
  });

  const matchProfile = buildMatchProfile({
    leagueId,
    homeStats,
    awayStats,
    homeExt,
    awayExt,
    xGHome: xG_Home,
    xGAway: xG_Away,
    h2hCount: h2hHistory.length,
  });

  const asianHandicap = calculateAsianHandicap(xG_Home, xG_Away);
  const monteCarlo = runMonteCarloSimulation(xG_Home, xG_Away, matchProfile, 10000);

  // ── 7. PICKS ──
  const candidates = buildCandidatePicks({
    homeStats,
    awayStats,
    matchProfile,
    dataQuality,
    leagueProfile,
    xG_Home,
    xG_Away,
    asianHandicap,
    probs: { homeWin: pctHomeWin, draw: pctDraw, awayWin: pctAwayWin, over25: pctOver25, btts: pctBTTS },
    h2hCount: h2hHistory.length,
  });

  const matchPicks = organizePicks(candidates, weights);
  const topPredictions = matchPicks.safe;

  // Cuotas justas y de mercado del 1X2 principal
  const fairOdds = {
    homeWin: fairOddsFrom(pctHomeWin),
    draw: fairOddsFrom(pctDraw),
    awayWin: fairOddsFrom(pctAwayWin),
    over25: fairOddsFrom(pctOver25),
    under25: fairOddsFrom(100 - pctOver25),
    bttsYes: fairOddsFrom(pctBTTS),
    bttsNo: fairOddsFrom(100 - pctBTTS),
  };
  const marketOdds = {
    homeWin: marketOddsFrom(pctHomeWin),
    draw: marketOddsFrom(pctDraw),
    awayWin: marketOddsFrom(pctAwayWin),
    over25: marketOddsFrom(pctOver25),
    under25: marketOddsFrom(100 - pctOver25),
    bttsYes: marketOddsFrom(pctBTTS),
    bttsNo: marketOddsFrom(100 - pctBTTS),
  };

  // La confianza ahora depende de la CALIDAD DE DATOS, no solo de la
  // diferencia entre equipos: con datos pobres no puede dispararse.
  const separation = Math.abs(pctHomeWin - pctAwayWin) * 0.35;
  const confidenceScore = Math.round(clamp(45 + separation + dataQuality * 35, 40, 92));

  return {
    league: { id: leagueProfile.id, name: leagueProfile.name },
    probabilities: { homeWin: pctHomeWin, draw: pctDraw, awayWin: pctAwayWin },
    expectedGoals: {
      home: Number(xG_Home.toFixed(2)),
      away: Number(xG_Away.toFixed(2)),
      total: Number((xG_Home + xG_Away).toFixed(2)),
    },
    probabilitiesSecondary: { over25: pctOver25, under25: 100 - pctOver25, btts: pctBTTS },
    mostLikelyScore: `${mostLikelyScore.home} - ${mostLikelyScore.away}`,
    mostLikelyScoreProb: Math.round(maxScoreProb * 100),
    confidenceScore,
    dataQuality: Number(dataQuality.toFixed(2)),
    expectedEvents: {
      corners: Number(matchProfile.corners.total.toFixed(1)),
      cards: Number(matchProfile.cards.total.toFixed(1)),
      fouls: Number(matchProfile.fouls.total.toFixed(1)),
      shots: Number(matchProfile.shots.total.toFixed(1)),
      shotsOnTarget: Number(matchProfile.sot.total.toFixed(1)),
      offsides: Number(matchProfile.offsides.total.toFixed(1)),
    },
    // Desglose por equipo, para que la ficha de metricas muestre lo que
    // se espera EN ESTE PARTIDO y no solo el promedio de temporada.
    expectedEventsByTeam: {
      home: {
        corners: matchProfile.corners.home,
        cards: matchProfile.cards.home,
        fouls: matchProfile.fouls.home,
        shots: matchProfile.shots.home,
        shotsOnTarget: matchProfile.sot.home,
        offsides: matchProfile.offsides.home,
      },
      away: {
        corners: matchProfile.corners.away,
        cards: matchProfile.cards.away,
        fouls: matchProfile.fouls.away,
        shots: matchProfile.shots.away,
        shotsOnTarget: matchProfile.sot.away,
        offsides: matchProfile.offsides.away,
      },
    },
    leagueTendencies: leagueProfile.signatureMarkets,
    fairOdds,
    marketOdds,
    topPredictions,
    asianHandicap,
    matchPicks,
    monteCarlo,
    calculatedAt: new Date().toISOString(),
  };
}
