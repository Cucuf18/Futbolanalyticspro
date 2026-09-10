/**
 * PERFILES ESTADISTICOS POR LIGA
 * ------------------------------------------------------------------
 * Cada liga tiene una "personalidad" estadistica propia. Usar un unico
 * promedio generico (1.38 goles, 10.2 corners, 4.2 tarjetas) para todas
 * las competiciones era la principal fuente de error del motor.
 *
 * Todos los valores marcados como *PerTeam son promedios POR EQUIPO POR
 * PARTIDO (el total del partido es aproximadamente el doble).
 *
 * `dispersion` = varianza / media. El futbol real esta sobre-disperso:
 * los corners, faltas y tarjetas tienen mucha mas varianza que una
 * Poisson pura. Si se ignora, el modelo se vuelve demasiado confiado y
 * las lineas Over/Under parecen mucho mas seguras de lo que son.
 *
 * `rho` es el parametro de Dixon-Coles: corrige la independencia falsa
 * entre los goles de los dos equipos. Cuanto mas negativo, mas empates
 * bajos (0-0 y 1-1) respecto a lo que predeciria una Poisson pura.
 *
 * `signatureMarkets` son las tendencias "fijas" de cada liga: mercados
 * donde esa competicion se desvia sistematicamente de la media europea.
 * NO inflan la probabilidad mostrada (eso seria mentir); afectan la
 * media esperada (efecto real y honesto) y sirven de desempate al
 * momento de elegir que 3 picks mostrar.
 */

const BASE_DISPERSION = {
  goals: 1.05,
  corners: 1.35,
  cards: 1.30,
  fouls: 1.25,
  shots: 1.30,
  sot: 1.22,
  offsides: 1.20,
};

export const LEAGUE_PROFILES = {
  PL: {
    rho: -0.12,
    id: 'PL',
    name: 'Premier League',
    teamsCount: 20,
    homeAdvantage: 1.10,
    goalsPerTeam: 1.43,
    cornersPerTeam: 5.20,
    cardsPerTeam: 2.00,
    foulsPerTeam: 10.70,
    shotsPerTeam: 12.75,
    sotPerTeam: 4.35,
    offsidesPerTeam: 2.10,
    dispersion: BASE_DISPERSION,
    signatureMarkets: [
      { market: 'CORNERS', bonus: 8, note: 'La Premier League es la liga top con mas corners por partido (ritmo alto y juego directo por bandas).' },
      { market: 'TIROS', bonus: 5, note: 'Volumen de remates muy alto: pocos partidos trabados.' },
    ],
    disciplineNote: 'Arbitraje permisivo: se pitan menos faltas y se sacan menos tarjetas que en las ligas latinas.',
  },
  PD: {
    rho: -0.15,
    id: 'PD',
    name: 'La Liga',
    teamsCount: 20,
    homeAdvantage: 1.14,
    goalsPerTeam: 1.28,
    cornersPerTeam: 4.85,
    cardsPerTeam: 2.70,
    foulsPerTeam: 12.75,
    shotsPerTeam: 11.50,
    sotPerTeam: 3.95,
    offsidesPerTeam: 2.30,
    dispersion: BASE_DISPERSION,
    signatureMarkets: [
      { market: 'TARJETAS', bonus: 8, note: 'La Liga es la competicion top con mas tarjetas amarillas por partido.' },
      { market: 'FALTAS', bonus: 6, note: 'Arbitraje estricto: se corta mucho el juego.' },
    ],
    disciplineNote: 'Arbitraje muy estricto: la linea de tarjetas sube de forma sistematica.',
  },
  SA: {
    rho: -0.15,
    id: 'SA',
    name: 'Serie A',
    teamsCount: 20,
    homeAdvantage: 1.12,
    goalsPerTeam: 1.38,
    cornersPerTeam: 5.05,
    cardsPerTeam: 2.45,
    foulsPerTeam: 13.00,
    shotsPerTeam: 12.75,
    sotPerTeam: 4.20,
    offsidesPerTeam: 2.00,
    dispersion: BASE_DISPERSION,
    signatureMarkets: [
      { market: 'FALTAS', bonus: 7, note: 'La Serie A es la liga con mas faltas por partido: juego tactico y muy cortado.' },
      { market: 'TARJETAS', bonus: 5, note: 'El alto volumen de faltas arrastra la linea de tarjetas hacia arriba.' },
    ],
    disciplineNote: 'Juego tactico e interrumpido: muchas faltas, pero no siempre se traducen en tarjeta.',
  },
  BL1: {
    rho: -0.1,
    id: 'BL1',
    name: 'Bundesliga',
    teamsCount: 18,
    homeAdvantage: 1.13,
    goalsPerTeam: 1.58,
    cornersPerTeam: 4.90,
    cardsPerTeam: 1.90,
    foulsPerTeam: 10.50,
    shotsPerTeam: 12.75,
    sotPerTeam: 4.40,
    offsidesPerTeam: 2.00,
    dispersion: BASE_DISPERSION,
    signatureMarkets: [
      { market: 'GOLES', bonus: 8, note: 'La Bundesliga es la liga mas goleadora de Europa: los Over de goles rinden mejor aqui.' },
      { market: 'BTTS', bonus: 5, note: 'Defensas adelantadas y transiciones rapidas: ambos equipos anotan con mucha frecuencia.' },
    ],
    disciplineNote: 'Liga limpia: pocas faltas y pocas tarjetas por partido.',
  },
  CL: {
    rho: -0.13,
    id: 'CL',
    name: 'Champions League',
    teamsCount: 36,
    homeAdvantage: 1.08,
    goalsPerTeam: 1.48,
    cornersPerTeam: 5.20,
    cardsPerTeam: 1.80,
    foulsPerTeam: 11.00,
    shotsPerTeam: 12.50,
    sotPerTeam: 4.25,
    offsidesPerTeam: 1.80,
    dispersion: {
      ...BASE_DISPERSION,
      // En Champions se cruzan equipos de nivel muy dispar: mas varianza.
      goals: 1.15,
      corners: 1.45,
    },
    signatureMarkets: [
      { market: 'CORNERS', bonus: 6, note: 'Diferencias de nivel grandes: el favorito acumula corners contra rivales replegados.' },
      { market: 'GOLES', bonus: 4, note: 'Media goleadora por encima de las ligas domesticas.' },
    ],
    disciplineNote: 'Arbitraje UEFA mas permisivo que el domestico: menos tarjetas de lo habitual.',
  },
  FL1: {
    rho: -0.13,
    id: 'FL1',
    name: 'Ligue 1',
    teamsCount: 18,
    homeAdvantage: 1.13,
    goalsPerTeam: 1.38,
    cornersPerTeam: 4.90,
    cardsPerTeam: 1.95,
    foulsPerTeam: 12.00,
    shotsPerTeam: 12.00,
    sotPerTeam: 4.10,
    offsidesPerTeam: 2.00,
    dispersion: BASE_DISPERSION,
    signatureMarkets: [
      { market: 'FALTAS', bonus: 5, note: 'Liga fisica: volumen de faltas por encima de la media europea.' },
      { market: 'HANDICAP', bonus: 4, note: 'Diferencia de presupuesto muy marcada entre la cabeza y el resto: los handicaps rinden.' },
    ],
    disciplineNote: 'Muchas faltas pero arbitraje relativamente permisivo con la tarjeta.',
  },
  DED: {
    rho: -0.09,
    id: 'DED',
    name: 'Eredivisie',
    teamsCount: 18,
    homeAdvantage: 1.15,
    goalsPerTeam: 1.58,
    cornersPerTeam: 5.25,
    cardsPerTeam: 1.70,
    foulsPerTeam: 10.50,
    shotsPerTeam: 13.00,
    sotPerTeam: 4.50,
    offsidesPerTeam: 2.20,
    dispersion: { ...BASE_DISPERSION, goals: 1.12 },
    signatureMarkets: [
      { market: 'GOLES', bonus: 9, note: 'La Eredivisie es la liga mas goleadora de Europa: defensas muy adelantadas y partidos abiertos.' },
      { market: 'BTTS', bonus: 6, note: 'Ambos equipos anotan con muchisima frecuencia.' },
    ],
    disciplineNote: 'Liga muy limpia: pocas faltas y pocas tarjetas.',
  },
  PPL: {
    rho: -0.15,
    id: 'PPL',
    name: 'Primeira Liga',
    teamsCount: 18,
    homeAdvantage: 1.16,
    goalsPerTeam: 1.28,
    cornersPerTeam: 4.95,
    cardsPerTeam: 2.30,
    foulsPerTeam: 12.50,
    shotsPerTeam: 11.50,
    sotPerTeam: 3.90,
    offsidesPerTeam: 1.80,
    dispersion: BASE_DISPERSION,
    signatureMarkets: [
      { market: 'TARJETAS', bonus: 6, note: 'Arbitraje estricto y juego cortado: linea de tarjetas alta.' },
      { market: 'HANDICAP', bonus: 5, note: 'Los tres grandes arrasan al resto: mucho partido con favorito claro.' },
    ],
    disciplineNote: 'Juego trabado con bastantes interrupciones.',
  },
  ELC: {
    rho: -0.11,
    id: 'ELC',
    name: 'Championship',
    teamsCount: 24,
    homeAdvantage: 1.12,
    goalsPerTeam: 1.28,
    cornersPerTeam: 5.30,
    cardsPerTeam: 1.80,
    foulsPerTeam: 10.75,
    shotsPerTeam: 12.25,
    sotPerTeam: 4.15,
    offsidesPerTeam: 1.70,
    // Liga con 24 equipos, calendario brutal y muchisima igualdad:
    // los resultados son mas impredecibles que en cualquier liga top.
    dispersion: { ...BASE_DISPERSION, goals: 1.15, corners: 1.40 },
    signatureMarkets: [
      { market: 'CORNERS', bonus: 6, note: 'Juego muy directo y vertical: volumen de corners alto.' },
    ],
    disciplineNote: 'Arbitraje permisivo al estilo ingles: se deja jugar.',
  },
  BSA: {
    rho: -0.16,
    id: 'BSA',
    name: 'Brasileirao Serie A',
    teamsCount: 20,
    homeAdvantage: 1.20,
    goalsPerTeam: 1.18,
    cornersPerTeam: 4.75,
    cardsPerTeam: 2.75,
    foulsPerTeam: 14.00,
    shotsPerTeam: 11.00,
    sotPerTeam: 3.70,
    offsidesPerTeam: 1.70,
    dispersion: BASE_DISPERSION,
    signatureMarkets: [
      { market: 'TARJETAS', bonus: 9, note: 'El Brasileirao es de las competiciones con mas tarjetas del mundo.' },
      { market: 'FALTAS', bonus: 9, note: 'Record de faltas por partido: juego constantemente interrumpido.' },
    ],
    disciplineNote: 'Arbitraje muy severo y juego muy fisico: tarjetas y faltas muy por encima de Europa.',
  },
};

// Promedio europeo, usado cuando la liga no esta perfilada.
const DEFAULT_PROFILE = {
  id: 'DEFAULT',
  rho: -0.13,
  name: 'Liga generica',
  teamsCount: 20,
  homeAdvantage: 1.12,
  goalsPerTeam: 1.40,
  cornersPerTeam: 5.05,
  cardsPerTeam: 2.25,
  foulsPerTeam: 11.80,
  shotsPerTeam: 12.40,
  sotPerTeam: 4.20,
  offsidesPerTeam: 2.05,
  dispersion: BASE_DISPERSION,
  signatureMarkets: [],
  disciplineNote: '',
};

export function getLeagueProfile(leagueId) {
  return LEAGUE_PROFILES[leagueId] || DEFAULT_PROFILE;
}

/**
 * Bonus de seleccion para la tendencia fija de la liga.
 * Solo desempata el orden de los picks, nunca modifica la probabilidad.
 */
export function getSignatureBonus(profile, marketType) {
  const hit = (profile.signatureMarkets || []).find((s) => s.market === marketType);
  return hit ? hit.bonus : 0;
}

export function getSignatureNote(profile, marketType) {
  const hit = (profile.signatureMarkets || []).find((s) => s.market === marketType);
  return hit ? hit.note : null;
}
