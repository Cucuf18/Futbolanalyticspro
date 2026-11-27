/**
 * MODELO DE GOLES v2
 * ------------------------------------------------------------------
 * Resultado del laboratorio (docs/LABORATORIO_MODELO.md): una estimacion
 * de la fuerza de cada equipo mucho mas simple que la anterior reduce casi
 * 40% la distancia con el mercado en 1X2 (de +0.030 a +0.018 de error en
 * una temporada no usada al ajustar). Sigue siendo PEOR que el mercado y no
 * da ventaja apostando: es una mejora de precision, no de rentabilidad.
 *
 * Idea:
 *   - Ataque y defensa de cada equipo = media de goles a favor / en contra
 *     con decaimiento exponencial (vida media 240 dias), mezclada con la
 *     media de la liga como "prior" equivalente a K=4 partidos.
 *   - Goles esperados = media de la liga (local o visitante) x ataque del
 *     equipo x defensa del rival, cada uno relativo a la media de la liga.
 *   - Nada mas: sin Elo, sin racha, sin fatiga, sin encogimiento manual.
 *     Todo eso se probo y no aporto frente a este esquema.
 *
 * Las medias de goles por liga salen de 3 temporadas completas
 * (football-data.co.uk, 2023/24-2025/26).
 */

export const GOALS_V2 = {
  HALF_LIFE_DAYS: 240,
  PRIOR_MATCHES: 4,
  GAMMA: 1.0,
  MIN_HISTORY: 8,
  MAX_MATCHES: 110,
  MIN_SAME_LEAGUE: 12,
  LAMBDA_MIN: 0.2,
  LAMBDA_MAX: 4.5,
};

// Goles por partido: [local, visitante]
export const LEAGUE_GOALS = {
  PL: { home: 1.613, away: 1.375 },
  ELC: { home: 1.439, away: 1.14 },
  PD: { home: 1.504, away: 1.149 },
  SA: { home: 1.35, away: 1.182 },
  BL1: { home: 1.739, away: 1.458 },
  FL1: { home: 1.546, away: 1.286 },
  DED: { home: 1.755, away: 1.38 },
  PPL: { home: 1.495, away: 1.211 },
};

/** Medias de la liga; si no hay datos propios se reparte la media por equipo con la proporcion tipica local/visita. */
export function leagueGoalMeans(leagueId, goalsPerTeam = 1.4) {
  if (LEAGUE_GOALS[leagueId]) return LEAGUE_GOALS[leagueId];
  const ratio = 1.22; // en las 8 ligas medidas el local marca ~22% mas que el visitante
  return { home: (2 * goalsPerTeam * ratio) / (1 + ratio), away: (2 * goalsPerTeam) / (1 + ratio) };
}

/** Ataque y defensa relativos a la media (1.0 = promedio) con decaimiento y prior. */
export function teamRatios(matches, mu, nowMs, cfg = GOALS_V2) {
  let wSum = 0;
  let gfSum = 0;
  let gaSum = 0;
  for (const m of matches) {
    const days = Math.max(0, (nowMs - new Date(m.date).getTime()) / 86400000);
    const w = Math.pow(0.5, days / cfg.HALF_LIFE_DAYS);
    wSum += w;
    gfSum += w * m.gf;
    gaSum += w * m.ga;
  }
  const att = (gfSum + cfg.PRIOR_MATCHES * mu) / (wSum + cfg.PRIOR_MATCHES);
  const def = (gaSum + cfg.PRIOR_MATCHES * mu) / (wSum + cfg.PRIOR_MATCHES);
  return { attack: att / mu, defense: def / mu };
}

/** Partidos a usar: los de la propia liga si hay suficientes (los de copas mezclan niveles). */
export function selectMatches(history, leagueId, cfg = GOALS_V2) {
  const all = [...(history?.matches || [])]
    .filter((m) => m && m.date && Number.isFinite(m.gf) && Number.isFinite(m.ga))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const same = all.filter((m) => m.competition === leagueId);
  const used = same.length >= cfg.MIN_SAME_LEAGUE ? same : all;
  return used.slice(-cfg.MAX_MATCHES);
}

/** Calculo puro de los goles esperados (lo que se verifica contra la version de Python). */
export function computeLambdas(homeMatches, awayMatches, means, nowMs, cfg = GOALS_V2) {
  const mu = (means.home + means.away) / 2;
  const h = teamRatios(homeMatches, mu, nowMs, cfg);
  const a = teamRatios(awayMatches, mu, nowMs, cfg);
  const clamp = (v) => Math.min(Math.max(v, cfg.LAMBDA_MIN), cfg.LAMBDA_MAX);
  return {
    lh: clamp(means.home * Math.pow(h.attack * a.defense, cfg.GAMMA)),
    la: clamp(means.away * Math.pow(a.attack * h.defense, cfg.GAMMA)),
  };
}

/**
 * Punto de entrada para el motor. Devuelve null si no hay historial
 * suficiente de alguno de los dos equipos: en ese caso el motor usa su
 * camino anterior en vez de inventar.
 */
export function goalsModelV2({ homeHistory, awayHistory, leagueId, goalsPerTeam, now = Date.now(), cfg = GOALS_V2 }) {
  const hm = selectMatches(homeHistory, leagueId, cfg);
  const am = selectMatches(awayHistory, leagueId, cfg);
  if (hm.length < cfg.MIN_HISTORY || am.length < cfg.MIN_HISTORY) return null;
  const means = leagueGoalMeans(leagueId, goalsPerTeam);
  return { ...computeLambdas(hm, am, means, now, cfg), homeSample: hm.length, awaySample: am.length, source: 'v2' };
}
