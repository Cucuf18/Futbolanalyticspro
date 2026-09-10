import { getLeagueProfile, getSignatureBonus, getSignatureNote } from './leagueProfiles.js';

/* ══════════════════════════════════════════════════════════════════
   1. DISTRIBUCIONES
   ══════════════════════════════════════════════════════════════════ */

// log-Gamma (Lanczos) para poder usar Binomial Negativa con r no entero
function logGamma(z) {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

export function poisson(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(lambda) - lambda - logGamma(k + 1));
}

export function poissonCDF(k, lambda) {
  let sum = 0;
  for (let i = 0; i <= Math.floor(k); i++) sum += poisson(i, lambda);
  return Math.min(1, sum);
}

/**
 * Binomial Negativa parametrizada por media y dispersion (varianza/media).
 * Es la distribucion correcta para corners, tarjetas, faltas y remates:
 * su varianza es mayor que la media, igual que en los datos reales.
 * Con dispersion <= 1 degenera correctamente en Poisson.
 */
function negBinPmf(k, mean, dispersion) {
  if (dispersion <= 1.001) return poisson(k, mean);
  const r = mean / (dispersion - 1);
  const p = 1 / dispersion; // P(exito)
  return Math.exp(
    logGamma(k + r) - logGamma(r) - logGamma(k + 1) +
    r * Math.log(p) + k * Math.log(1 - p)
  );
}

function negBinCDF(k, mean, dispersion) {
  let sum = 0;
  for (let i = 0; i <= Math.floor(k); i++) sum += negBinPmf(i, mean, dispersion);
  return Math.min(1, sum);
}

/**
 * Probabilidad Over/Under de una linea para un mercado de conteo.
 * @param {number} mean       media esperada para ESTE partido
 * @param {number} line       linea (2.5, 9.5, ...)
 * @param {number} dispersion varianza/media (1 = Poisson)
 * @returns {{overProb:number, underProb:number}} en fraccion 0-1
 */
export function lineProbability(mean, line, dispersion = 1) {
  const isHalf = line % 1 !== 0;
  const underK = isHalf ? Math.floor(line) : line - 1;
  const underProb = dispersion > 1.001
    ? negBinCDF(underK, mean, dispersion)
    : poissonCDF(underK, mean);
  return { overProb: 1 - underProb, underProb };
}

/* ══════════════════════════════════════════════════════════════════
   2. CALIBRACION Y CUOTAS
   ══════════════════════════════════════════════════════════════════ */

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Margen del operador. Una cuota "justa" (100/prob) NO existe en ningun
 * sitio de apuestas: la casa aplica un overround del 5-8% por seleccion.
 * Mostrar 1.05 cuando la casa paga 1.01 es lo que hacia que las cuotas
 * de la pagina no coincidieran con la realidad.
 */
export const BOOKMAKER_MARGIN = 0.06;

// Por debajo de esta cuota el pick no vale la pena aunque acierte.
export const MIN_USEFUL_ODDS = 1.20;

export function fairOddsFrom(probPct) {
  return Number((100 / clamp(probPct, 1, 99)).toFixed(2));
}

export function marketOddsFrom(probPct) {
  const fair = 100 / clamp(probPct, 1, 99);
  return Number(Math.max(1.01, fair / (1 + BOOKMAKER_MARGIN)).toFixed(2));
}

/**
 * Precio y valor de una seleccion.
 *
 * Hay que separar DOS numeros que antes se confundian en uno:
 *  - cuotaEstimada: lo que la casa va a pagar de verdad. Se calcula con
 *    la probabilidad CRUDA (la casa no aplica nuestra prudencia) menos
 *    su margen. Es la unica cifra comparable con Betano.
 *  - cuotaMinima: la cuota a partir de la cual la apuesta tiene valor
 *    segun NUESTRA probabilidad calibrada (1/p). Por debajo, se pierde
 *    dinero a largo plazo aunque el pick acierte a menudo.
 *
 * Mostrar 100/prob como si fuera la cuota real era lo que hacia que las
 * cuotas de la pagina no cuadraran con ninguna casa de apuestas.
 */
export function priceSelection(rawPct, calibratedPct) {
  const marketOdds = marketOddsFrom(rawPct);       // lo que paga la casa
  const breakEvenOdds = fairOddsFrom(calibratedPct); // minimo para tener valor
  return {
    marketOdds,
    breakEvenOdds,
    fairOdds: breakEvenOdds,
    hasValue: marketOdds > breakEvenOdds,
    edge: Number(((marketOdds / breakEvenOdds - 1) * 100).toFixed(1)),
  };
}

/**
 * Calibracion: el modelo es estructuralmente sobre-confiado (asume
 * independencia, datos perfectos y una muestra grande). Encogemos la
 * probabilidad hacia el 50% en funcion de la calidad real de los datos.
 * Techo duro en 93%: en futbol nada es seguro al 99%.
 *
 * @param {number} rawPct      probabilidad cruda 0-100
 * @param {number} dataQuality 0 (datos simulados, 1 partido jugado) a 1
 */
export function calibrate(rawPct, dataQuality = 0.5) {
  const k = 0.80 + 0.15 * clamp(dataQuality, 0, 1); // 0.80 .. 0.95
  const shrunk = 50 + (rawPct - 50) * k;
  return Math.round(clamp(shrunk, 3, 93));
}

/**
 * Calidad de datos del partido: cuanto podemos fiarnos de las cifras.
 */
export function computeDataQuality({ played = 0, h2hCount = 0, hasExternalStats = false, isLiveData = false }) {
  const sample = clamp(played / 15, 0, 1) * 0.45;
  const h2h = clamp(h2hCount / 6, 0, 1) * 0.20;
  const ext = hasExternalStats ? 0.20 : 0;
  const live = isLiveData ? 0.15 : 0;
  return clamp(sample + h2h + ext + live, 0.05, 1);
}

/* ══════════════════════════════════════════════════════════════════
   3. PERFIL DEL ENFRENTAMIENTO (media esperada acorde a los rivales)
   ══════════════════════════════════════════════════════════════════ */

/**
 * Media esperada de un mercado de conteo para ESTE cruce concreto.
 *
 * Se usa el mismo esquema ataque x defensa que para los goles:
 *   media = baseLiga * (tendencia del equipo) * (permisividad del rival)
 *
 * Asi un Manchester City vs un recien ascendido nunca comparte linea de
 * corners con un Getafe vs Cadiz, aunque sean la misma liga.
 */
export function matchupMean(leagueBase, teamRatio, opponentRatio, extraFactor = 1) {
  // Raiz cuadrada sobre el factor rival: un equipo que encaja el doble de
  // goles no concede el doble de corners ni el doble de remates. Sin este
  // amortiguador los cruces desiguales producian medias imposibles.
  const dampedOpponent = Math.sqrt(clamp(opponentRatio, 0.70, 1.45));
  return leagueBase
    * clamp(teamRatio, 0.60, 1.55)
    * dampedOpponent
    * extraFactor;
}

/**
 * Construye el perfil estadistico completo del partido a partir de los
 * datos de ambos equipos, el perfil de la liga y la asimetria de nivel.
 */
export function buildMatchProfile({
  leagueId,
  homeStats,
  awayStats,
  homeExt,
  awayExt,
  xGHome,
  xGAway,
  h2hCount = 0,
}) {
  const profile = getLeagueProfile(leagueId);
  const teams = profile.teamsCount || 20;

  // Indices de ataque/defensa relativos a la liga (1.0 = promedio)
  const ratio = (value, base) => (base > 0 ? value / base : 1);

  const homePlayed = Math.max(homeStats.played || 1, 1);
  const awayPlayed = Math.max(awayStats.played || 1, 1);

  const homeGFr = ratio(homeStats.goalsFor / homePlayed, profile.goalsPerTeam);
  const homeGAr = ratio(homeStats.goalsAgainst / homePlayed, profile.goalsPerTeam);
  const awayGFr = ratio(awayStats.goalsFor / awayPlayed, profile.goalsPerTeam);
  const awayGAr = ratio(awayStats.goalsAgainst / awayPlayed, profile.goalsPerTeam);

  // Fuerza normalizada por posicion (0 = colista, 1 = lider)
  const homeStrength = clamp(1 - (homeStats.position - 1) / Math.max(teams - 1, 1), 0, 1);
  const awayStrength = clamp(1 - (awayStats.position - 1) / Math.max(teams - 1, 1), 0, 1);
  const gap = Math.abs(homeStrength - awayStrength);

  // Dominancia: un favorito claro contra un rival replegado dispara
  // corners y remates.
  const dominance = 1 + gap * 0.22;

  // Derbi / rivalidad: mas historial directo => partido mas caliente.
  const isDerby = h2hCount >= 6;
  const derbyCards = isDerby ? 1.12 : 1.0;
  const derbyFouls = isDerby ? 1.08 : 1.0;

  // --- CORNERS ---
  const homeCornerRatio = homeExt?.avgCorners
    ? ratio(homeExt.avgCorners, profile.cornersPerTeam)
    : 0.80 + homeGFr * 0.20 + homeStrength * 0.20;
  const awayCornerRatio = awayExt?.avgCorners
    ? ratio(awayExt.avgCorners, profile.cornersPerTeam)
    : 0.80 + awayGFr * 0.20 + awayStrength * 0.20;
  const homeCorners = matchupMean(profile.cornersPerTeam, homeCornerRatio, awayGAr, dominance * profile.homeAdvantage * 0.98);
  const awayCorners = matchupMean(profile.cornersPerTeam, awayCornerRatio, homeGAr, dominance * 0.96);

  // --- TARJETAS ---
  // La brecha de nivel sube las tarjetas del equipo debil (mas faltas
  // tacticas), y el perfil disciplinario de la liga marca la base.
  // El margen era demasiado estrecho (solo un 15% de recorrido por la
  // fuerza del equipo), asi que la linea de tarjetas salia casi identica
  // en todos los partidos. Se amplia y se mete la solidez defensiva: un
  // equipo al que le hacen muchos goles defiende mal y corta con falta.
  const homeCardRatio = homeExt?.avgYellowCards
    ? ratio(homeExt.avgYellowCards, profile.cardsPerTeam)
    : 0.85 + (1 - homeStrength) * 0.35 + (homeGAr - 1) * 0.18;
  const awayCardRatio = awayExt?.avgYellowCards
    ? ratio(awayExt.avgYellowCards, profile.cardsPerTeam)
    : 0.90 + (1 - awayStrength) * 0.35 + (awayGAr - 1) * 0.18;
  const homeCards = matchupMean(profile.cardsPerTeam, homeCardRatio, 1 + gap * 0.30, derbyCards);
  const awayCards = matchupMean(profile.cardsPerTeam, awayCardRatio, 1 + gap * 0.38, derbyCards * 1.05);

  // --- FALTAS ---
  const homeFoulRatio = homeExt?.avgFouls ? ratio(homeExt.avgFouls, profile.foulsPerTeam) : 1.02 - homeStrength * 0.10;
  const awayFoulRatio = awayExt?.avgFouls ? ratio(awayExt.avgFouls, profile.foulsPerTeam) : 1.05 - awayStrength * 0.10;
  const homeFouls = matchupMean(profile.foulsPerTeam, homeFoulRatio, 1, derbyFouls);
  const awayFouls = matchupMean(profile.foulsPerTeam, awayFoulRatio, 1, derbyFouls);

  // --- REMATES Y TIROS A PUERTA ---
  const homeShotRatio = homeExt?.avgTotalShots ? ratio(homeExt.avgTotalShots, profile.shotsPerTeam) : 0.78 + homeStrength * 0.42;
  const awayShotRatio = awayExt?.avgTotalShots ? ratio(awayExt.avgTotalShots, profile.shotsPerTeam) : 0.78 + awayStrength * 0.42;
  const homeShots = matchupMean(profile.shotsPerTeam, homeShotRatio, awayGAr, dominance * profile.homeAdvantage * 0.97);
  const awayShots = matchupMean(profile.shotsPerTeam, awayShotRatio, homeGAr, dominance * 0.95);

  // Los tiros a puerta se anclan a DOS referencias para que el modelo no
  // se contradiga consigo mismo: el xG del partido (3 tiros a puerta por
  // gol esperado) y el volumen de remates (un tercio acaba entre palos).
  // Antes solo miraba el xG y se producian cuadros imposibles como 31
  // remates totales con apenas 6 tiros a puerta.
  const sotFromXG = (xg) => xg * 3.0;
  const sotFromShots = (shots) => shots * 0.34;

  const homeSotBase = (sotFromXG(xGHome) + sotFromShots(homeShots)) / 2;
  const awaySotBase = (sotFromXG(xGAway) + sotFromShots(awayShots)) / 2;

  const homeSot = homeExt?.avgShotsOnTarget
    ? (matchupMean(profile.sotPerTeam, ratio(homeExt.avgShotsOnTarget, profile.sotPerTeam), awayGAr) + homeSotBase) / 2
    : homeSotBase;
  const awaySot = awayExt?.avgShotsOnTarget
    ? (matchupMean(profile.sotPerTeam, ratio(awayExt.avgShotsOnTarget, profile.sotPerTeam), homeGAr) + awaySotBase) / 2
    : awaySotBase;

  // --- OFFSIDES ---
  // El factor rival estaba puesto a 1 fijo y no habia ni dominancia ni
  // ventaja de campo: el resultado solo dependia de los goles propios y
  // salia practicamente el mismo numero en todos los partidos.
  //
  // Un fuera de juego lo provoca la linea defensiva del RIVAL: contra un
  // equipo fuerte, que presiona arriba y adelanta la linea, se cae mucho
  // mas en fuera de juego que contra uno replegado en su area.
  const homeOffsides = matchupMean(
    profile.offsidesPerTeam,
    0.75 + homeGFr * 0.35,
    0.70 + awayStrength * 0.60,
    dominance * profile.homeAdvantage * 0.98
  );
  const awayOffsides = matchupMean(
    profile.offsidesPerTeam,
    0.75 + awayGFr * 0.35,
    0.70 + homeStrength * 0.60,
    dominance * 0.96
  );

  /**
   * Techos y suelos de realidad.
   * Sin esto, un City vs colista producia 12.7 corners de un solo equipo
   * (record historico de la Premier ~15 en TODO el partido) y 27 remates,
   * y las lineas resultantes eran inapostables.
   */
  const bounded = (home, away, min, max, totalMax) => {
    const h = clamp(home, min, max);
    const a = clamp(away, min, max);
    const total = Math.min(h + a, totalMax);
    return { home: Number(h.toFixed(2)), away: Number(a.toFixed(2)), total: Number(total.toFixed(2)) };
  };

  return {
    profile,
    homeStrength,
    awayStrength,
    gap,
    isDerby,
    corners: bounded(homeCorners, awayCorners, 1.8, 8.5, 15.0),
    cards: bounded(homeCards, awayCards, 0.8, 4.5, 8.0),
    fouls: bounded(homeFouls, awayFouls, 7.0, 18.0, 32.0),
    shots: bounded(homeShots, awayShots, 5.5, 19.5, 31.0),
    sot: bounded(homeSot, awaySot, 1.2, 9.0, 15.0),
    offsides: bounded(homeOffsides, awayOffsides, 0.5, 5.0, 8.0),
  };
}

/* ══════════════════════════════════════════════════════════════════
   4. SELECCION DINAMICA DE LINEA
   ══════════════════════════════════════════════════════════════════ */

/**
 * Genera las medias-lineas alrededor de la media esperada.
 * Nada de lineas fijas: si el cruce espera 12.4 corners, se evaluan
 * 8.5/9.5/10.5/11.5/... alrededor de ESE valor, no un 8.5 universal.
 */
function candidateLines(mean, span = 5) {
  const center = Math.floor(mean);
  const lines = [];
  for (let d = -span; d <= span; d++) {
    const line = center + d + 0.5;
    if (line >= 0.5) lines.push(line);
  }
  return lines;
}

/**
 * Encuentra la mejor linea Over/Under para un mercado.
 *
 * @param {object} opts
 * @param {number} opts.mean        media esperada del cruce
 * @param {number} opts.dispersion  varianza/media
 * @param {number} opts.dataQuality 0-1
 * @param {[number,number]} opts.band banda de probabilidad calibrada aceptable
 * @param {number} opts.minOdds     cuota minima util
 * @returns {object|null} { side, line, probability, fairOdds, marketOdds }
 */
export function findBestLine({ mean, dispersion = 1, dataQuality = 0.5, band = [62, 90], minOdds = MIN_USEFUL_ODDS, directionalHint = null }) {
  if (!Number.isFinite(mean) || mean <= 0) return null;

  let best = null;
  let bestScore = -Infinity;
  for (const line of candidateLines(mean)) {
    const { overProb, underProb } = lineProbability(mean, line, dispersion);
    for (const side of ['OVER', 'UNDER']) {
      const raw = (side === 'OVER' ? overProb : underProb) * 100;
      const probability = calibrate(raw, dataQuality);
      if (probability < band[0] || probability > band[1]) continue;

      const price = priceSelection(raw, probability);
      // Filtro clave: si la casa paga menos de minOdds, el pick no sirve
      // aunque acierte el 90% de las veces. Esto elimina solo los
      // "Mas de 0.5 goles" y demas lineas sin recorrido.
      if (price.marketOdds < minOdds) continue;

      // Entre las lineas validas nos quedamos con la mas probable, con un
      // pequeno empujon al lado que sigue la senal del cruce: si el
      // partido apunta a muchos corners, es mas natural recomendar un
      // Over que un Under lejanisimo con la misma probabilidad.
      const directionBonus = directionalHint && side === directionalHint ? 3 : 0;
      const score = probability + directionBonus;
      if (score > bestScore) {
        bestScore = score;
        best = {
          side,
          line,
          probability,
          rawProbability: Math.round(raw),
          mean: Number(mean.toFixed(2)),
          ...price,
        };
      }
    }
  }
  return best;
}

/* ══════════════════════════════════════════════════════════════════
   5. CONSTRUCCION DE PICKS
   ══════════════════════════════════════════════════════════════════ */

/**
 * Valor esperado con la cuota realista del mercado.
 * EV = p * cuota - 1. Positivo = apuesta con valor a largo plazo.
 */
export function expectedValue(probPct, odds) {
  return Number(((probPct / 100) * odds - 1).toFixed(3));
}

/**
 * Cuanto se sale ESTE partido de la norma de su liga, de 0 a 12 puntos.
 *
 * Sin esto el motor elegia siempre el mercado con mayor probabilidad
 * absoluta, y esos son justamente los que valen para cualquier partido
 * ("no hay empate" sale ~75% en todos lados). El resultado eran los
 * mismos tres picks con los mismos numeros en cruces distintos.
 *
 * Ahora se premia que el partido se desvie de su liga: si aqui se esperan
 * 14 corners y la media de la competicion son 10.4, ese pick dice algo
 * de ESTE partido y sube. Si coincide con la media, no aporta y baja.
 */
export function distinctiveness(mean, leagueBaseline) {
  if (!Number.isFinite(mean) || !Number.isFinite(leagueBaseline) || leagueBaseline <= 0) return 0;
  return clamp(Math.abs(mean / leagueBaseline - 1) * 40, 0, 12);
}

/** Version para mercados que no son de conteo: se compara la probabilidad
 *  con la tasa base tipica de ese mercado en el futbol. */
export function distinctivenessFromProb(probPct, baselinePct) {
  if (!Number.isFinite(probPct) || !Number.isFinite(baselinePct)) return 0;
  return clamp(Math.abs(probPct - baselinePct) * 0.45, 0, 12);
}

export function buildCountPick({
  marketType,
  typePrefix,
  labelFor,
  found,
  profile,
  reasons = [],
  correlationGroup,
  leagueBaseline = null,
}) {
  if (!found) return null;
  const note = getSignatureNote(profile, marketType);
  const allReasons = [...reasons];
  if (note) allReasons.push(`Tendencia de liga: ${note}`);

  const distinct = leagueBaseline ? distinctiveness(found.mean, leagueBaseline) : 0;
  if (distinct >= 6 && leagueBaseline) {
    const pct = Math.round((found.mean / leagueBaseline - 1) * 100);
    allReasons.push(
      `Este cruce se desvia un ${Math.abs(pct)}% ${pct > 0 ? 'por encima' : 'por debajo'} de la media de la competicion en este mercado.`
    );
  }

  return {
    type: `${typePrefix}_${found.side}_${String(found.line).replace('.', '')}`,
    label: labelFor(found),
    probability: found.probability,
    rawProbability: found.rawProbability,
    fairOdds: found.fairOdds,
    marketOdds: found.marketOdds,
    breakEvenOdds: found.breakEvenOdds,
    hasValue: found.hasValue,
    edge: found.edge,
    expectedMean: found.mean,
    line: found.line,
    side: found.side,
    marketType,
    correlationGroup: correlationGroup || marketType,
    distinctiveness: Number(distinct.toFixed(1)),
    selectionScore: found.probability + getSignatureBonus(profile, marketType) + distinct,
    evThreshold: 'Estadistico',
    reasons: allReasons.filter(Boolean),
  };
}

export { clamp };
