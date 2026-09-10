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
};

// Promedio europeo, usado cuando la liga no esta perfilada.
const DEFAULT_PROFILE = {
  id: 'DEFAULT',
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
