import { config } from '../config.js';
import { calculateMatchPrediction } from './predictorEngine.js';
import { getTeamStats, currentSeason } from './externalDataAggregator.js';
import { fetchFromApi, getCached, setCache, DEFAULT_TTL } from './footballDataClient.js';
import { getTeamHistory, compareByCommonOpponents } from './teamHistory.js';
import { ingestMatches, getRating } from './ratingPool.js';
import { recordPrediction } from './backtest.js';

/* ──────────────────────────────────────────────────────
   In-memory cache with TTL (Time To Live)
   Standings refresh every 60 min, H2H every 30 min
   ────────────────────────────────────────────────────── */
const STANDINGS_TTL = DEFAULT_TTL; // 1 hora

// Codigo de competicion en api-football (v3)
const API_FOOTBALL_LEAGUE_IDS = {
  PL: '39',   // Premier League
  PD: '140',  // La Liga
  SA: '135',  // Serie A
  BL1: '78',  // Bundesliga
  FL1: '61',  // Ligue 1
  DED: '88',  // Eredivisie
  PPL: '94',  // Primeira Liga
  ELC: '40',  // Championship
  BSA: '71',  // Brasileirao Serie A
  CL: '2',    // UEFA Champions League
};

/**
 * Fecha del ultimo partido para el calculo de fatiga.
 *
 * Antes esto devolvia una fecha ALEATORIA entre 2 y 7 dias atras, y se
 * usaba tambien con datos en vivo: la penalizacion por fatiga (-10% de
 * xG cuando hay menos de 4 dias de descanso) se aplicaba o no al azar en
 * cada recarga, metiendo ruido puro en la prediccion.
 *
 * Sin un calendario real es preferible no ajustar nada: devolvemos null
 * y el motor deja el multiplicador de fatiga en 1.0.
 */
function unknownLastMatchDate() {
  return null;
}


/* ──────────────────────────────────────────────────────
   Football-Data.org API Integration
   Free tier: 10 req/min – covers PL, PD, SA, BL1, CL
   Rate-limit aware: reads X-Requests-Available-Minute
   and X-RequestCounter-Reset response headers.
   ────────────────────────────────────────────────────── */
function parseApiStandings(apiData, leagueId) {
  try {
    const table = apiData.standings?.[0]?.table || [];
    const teams = table.map((row) => ({
      id: row.team.id,
      name: row.team.name,
      shortName: row.team.tla || row.team.shortName || row.team.name.slice(0, 12),
      crest: row.team.crest || '',
      position: row.position,
      played: row.playedGames,
      won: row.won,
      drawn: row.draw,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      points: row.points,
      form: row.form ? row.form.split(',') : [],
      lastMatchDate: unknownLastMatchDate(),
      xG: Number((1.0 + (row.goalsFor / Math.max(row.playedGames, 1)) * 0.45).toFixed(2)),
      avgShots: Number((10 + (row.goalsFor / Math.max(row.playedGames, 1)) * 2).toFixed(1)),
      avgSOT: Number((3 + (row.goalsFor / Math.max(row.playedGames, 1)) * 1.5).toFixed(1)),
      avgFouls: Number((12 + (row.goalsAgainst / Math.max(row.playedGames, 1))).toFixed(1)),
    }));
    return {
      league: {
        id: leagueId,
        name: apiData.competition?.name || leagueId,
        country: apiData.competition?.area?.name || '',
        season: apiData.season?.startDate?.slice(0, 4) + '/' + apiData.season?.endDate?.slice(0, 4),
      },
      teams,
      dataSource: 'live',
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    return null;
  }
}

/* ──────────────────────────────────────────────────────
   Helper: generate realistic stats from position & tier
   ────────────────────────────────────────────────────── */
function genStats(name, shortName, pos, totalTeams, played) {
  const strength = 1 - (pos - 1) / totalTeams;
  const won = Math.round(played * (0.12 + strength * 0.52));
  const lost = Math.round(played * (0.05 + (1 - strength) * 0.38));
  const drawn = played - won - lost;
  const gfPer = 0.7 + strength * 1.6;
  const gaPer = 0.5 + (1 - strength) * 1.3;
  const goalsFor = Math.round(gfPer * played);
  const goalsAgainst = Math.round(gaPer * played);
  const formOptions = ['W', 'D', 'L'];
  const form = Array.from({ length: 5 }, () => {
    const r = Math.random();
    if (r < 0.15 + strength * 0.45) return 'W';
    if (r < 0.45 + strength * 0.2) return 'D';
    return 'L';
  });

  return {
    id: Math.abs(hashCode(name)),
    name,
    shortName,
    crest: '',
    position: pos,
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points: won * 3 + drawn,
    form,
    lastMatchDate: unknownLastMatchDate(),
    xG: Number((gfPer * 0.92).toFixed(2)),
    avgShots: Number((9 + strength * 6).toFixed(1)), // 9 to 15
    avgSOT: Number((3 + strength * 4).toFixed(1)), // 3 to 7
    avgFouls: Number((14 - strength * 4).toFixed(1)), // 10 to 14 (weaker teams foul more)
  };
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

/* ──────────────────────────────────────────────────────
   Complete team rosters per league (fallback data)
   ────────────────────────────────────────────────────── */
const LEAGUE_ROSTERS = {
  PL: [
    ['Arsenal FC', 'ARS'], ['Manchester City', 'MCI'], ['Liverpool FC', 'LIV'],
    ['Aston Villa', 'AVL'], ['Tottenham Hotspur', 'TOT'], ['Chelsea FC', 'CHE'],
    ['Manchester United', 'MUN'], ['Newcastle United', 'NEW'], ['West Ham United', 'WHU'],
    ['Brighton & Hove Albion', 'BHA'], ['Crystal Palace', 'CRY'], ['AFC Bournemouth', 'BOU'],
    ['Fulham FC', 'FUL'], ['Wolverhampton Wanderers', 'WOL'], ['Brentford FC', 'BRE'],
    ['Nottingham Forest', 'NFO'], ['Everton FC', 'EVE'], ['Leicester City', 'LEI'],
    ['Ipswich Town', 'IPS'], ['Southampton FC', 'SOU'],
  ],
  PD: [
    ['Real Madrid', 'RMA'], ['FC Barcelona', 'BAR'], ['Atletico de Madrid', 'ATM'],
    ['Girona FC', 'GIR'], ['Athletic Club', 'ATH'], ['Real Sociedad', 'RSO'],
    ['Real Betis', 'BET'], ['Villarreal CF', 'VIL'], ['Valencia CF', 'VAL'],
    ['Sevilla FC', 'SEV'], ['RC Celta de Vigo', 'CEL'], ['CA Osasuna', 'OSA'],
    ['Getafe CF', 'GET'], ['Rayo Vallecano', 'RAY'], ['RCD Mallorca', 'MLL'],
    ['UD Las Palmas', 'LPA'], ['Deportivo Alaves', 'ALA'], ['Cadiz CF', 'CAD'],
    ['Granada CF', 'GRA'], ['RCD Espanyol', 'ESP'],
  ],
  SA: [
    ['Inter Milan', 'INT'], ['Juventus FC', 'JUV'], ['AC Milan', 'MIL'],
    ['Atalanta BC', 'ATA'], ['AS Roma', 'ROM'], ['SS Lazio', 'LAZ'],
    ['SSC Napoli', 'NAP'], ['ACF Fiorentina', 'FIO'], ['Bologna FC', 'BOL'],
    ['Torino FC', 'TOR'], ['AC Monza', 'MON'], ['Genoa CFC', 'GEN'],
    ['US Lecce', 'LEC'], ['Cagliari Calcio', 'CAG'], ['Hellas Verona', 'VER'],
    ['Udinese Calcio', 'UDI'], ['Empoli FC', 'EMP'], ['US Sassuolo', 'SAS'],
    ['Frosinone Calcio', 'FRO'], ['US Salernitana', 'SAL'],
  ],
  BL1: [
    ['Bayer 04 Leverkusen', 'B04'], ['Bayern Munich', 'FCB'], ['VfB Stuttgart', 'VFB'],
    ['Borussia Dortmund', 'BVB'], ['RB Leipzig', 'RBL'], ['Eintracht Frankfurt', 'SGE'],
    ['SC Freiburg', 'SCF'], ['TSG Hoffenheim', 'TSG'], ['1. FC Heidenheim', 'HDH'],
    ['Werder Bremen', 'SVW'], ['VfL Wolfsburg', 'WOB'], ['FC Augsburg', 'FCA'],
    ['1. FSV Mainz 05', 'M05'], ['Borussia Monchengladbach', 'BMG'],
    ['1. FC Union Berlin', 'FCU'], ['VfL Bochum', 'BOC'],
    ['FC Koln', 'KOE'], ['SV Darmstadt 98', 'DAR'],
  ],
  CL: [
    ['Real Madrid', 'RMA'], ['FC Barcelona', 'BAR'], ['Bayern Munich', 'FCB'],
    ['Manchester City', 'MCI'], ['Arsenal FC', 'ARS'], ['Liverpool FC', 'LIV'],
    ['Inter Milan', 'INT'], ['AC Milan', 'MIL'], ['Juventus FC', 'JUV'],
    ['Atletico de Madrid', 'ATM'], ['Paris Saint-Germain', 'PSG'],
    ['Borussia Dortmund', 'BVB'], ['RB Leipzig', 'RBL'], ['SL Benfica', 'BEN'],
    ['FC Porto', 'POR'], ['Sporting CP', 'SCP'], ['Feyenoord', 'FEY'],
    ['PSV Eindhoven', 'PSV'], ['Club Brugge', 'CLB'], ['Celtic FC', 'CEL'],
    ['Shakhtar Donetsk', 'SHA'], ['Red Bull Salzburg', 'RBS'],
    ['BSC Young Boys', 'YBB'], ['FK Crvena Zvezda', 'CZV'],
    ['GNK Dinamo Zagreb', 'DIN'], ['Atalanta BC', 'ATA'], ['Bologna FC', 'BOL'],
    ['Aston Villa', 'AVL'], ['Bayer 04 Leverkusen', 'B04'], ['VfB Stuttgart', 'VFB'],
    ['Stade Brestois', 'BRE'], ['LOSC Lille', 'LIL'], ['AS Monaco', 'MON'],
    ['Girona FC', 'GIR'], ['SK Slovan Bratislava', 'SLO'], ['SK Sturm Graz', 'STU'],
  ],
};

const LEAGUE_META = {
  PL: { name: 'Premier League', country: 'Inglaterra', season: '2025/2026', played: 24 },
  PD: { name: 'La Liga', country: 'España', season: '2025/2026', played: 24 },
  SA: { name: 'Serie A', country: 'Italia', season: '2025/2026', played: 24 },
  BL1: { name: 'Bundesliga', country: 'Alemania', season: '2025/2026', played: 22 },
  FL1: { name: 'Ligue 1', country: 'Francia', season: '2025/2026', played: 22 },
  DED: { name: 'Eredivisie', country: 'Paises Bajos', season: '2025/2026', played: 22 },
  PPL: { name: 'Primeira Liga', country: 'Portugal', season: '2025/2026', played: 22 },
  ELC: { name: 'Championship', country: 'Inglaterra', season: '2025/2026', played: 30 },
  BSA: { name: 'Brasileirao', country: 'Brasil', season: '2026', played: 24 },
  CL: { name: 'Champions League', country: 'Europa', season: '2025/2026', played: 8 },
};

function buildFallbackStandings(leagueId) {
  const roster = LEAGUE_ROSTERS[leagueId] || LEAGUE_ROSTERS.PL;
  const meta = LEAGUE_META[leagueId] || LEAGUE_META.PL;
  const teams = roster.map(([name, shortName], idx) =>
    genStats(name, shortName, idx + 1, roster.length, meta.played)
  );
  // Sort by points descending, then goal difference
  teams.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);
  teams.forEach((t, i) => (t.position = i + 1));

  return {
    league: { id: leagueId, ...meta },
    teams,
    dataSource: 'simulated',
    updatedAt: new Date().toISOString(),
  };
}

/* ──────────────────────────────────────────────────────
   Public API: Standings
   ────────────────────────────────────────────────────── */
export async function getLeagueStandings(leagueId = 'PL') {
  const cacheKey = `standings_${leagueId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Try live API first
  const apiData = await fetchFromApi(`/competitions/${leagueId}/standings`);
  if (apiData) {
    const parsed = parseApiStandings(apiData, leagueId);
    if (parsed) {
      setCache(cacheKey, parsed);
      return parsed;
    }
  }

  // Fallback to complete simulated data
  const fallback = buildFallbackStandings(leagueId);
  setCache(cacheKey, fallback);
  return fallback;
}

/* ──────────────────────────────────────────────────────
   Public API: Head-to-Head
   ────────────────────────────────────────────────────── */
export async function getH2HHistory(homeTeamId, awayTeamId, leagueId = 'PL') {
  const cacheKey = `h2h_${homeTeamId}_${awayTeamId}_${leagueId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const standings = await getLeagueStandings(leagueId);
  const homeTeam = standings.teams.find((t) => t.id === Number(homeTeamId)) || standings.teams[0];
  const awayTeam = standings.teams.find((t) => t.id === Number(awayTeamId)) || standings.teams[1];

  let h2hResult = null;

  // Try fetching REAL matches if API key is present
  if (config.footballApiKey) {
    try {
      const matchCacheKey = `team_matches_${homeTeam.id}`;
      let apiData = getCached(matchCacheKey);
      
      if (!apiData) {
        if (inFlightRequests.has(matchCacheKey)) {
           apiData = await inFlightRequests.get(matchCacheKey);
        } else {
           const today = new Date();
           const dateTo = today.toISOString().split('T')[0];
           const dateFrom = new Date(today.getTime() - 720 * 86400000).toISOString().split('T')[0];
           
           const reqPromise = fetchFromApi(`/teams/${homeTeam.id}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}&limit=100`);
           inFlightRequests.set(matchCacheKey, reqPromise);
           apiData = await reqPromise;
           inFlightRequests.delete(matchCacheKey);
           if (apiData) setCache(matchCacheKey, apiData, 24 * 60 * 60 * 1000); // 24h
        }
      }

      if (apiData?.matches?.length) {
        // Step 1: Find any match between these two teams to get a valid matchId
        const sharedMatch = apiData.matches.find((m) =>
          (m.homeTeam.id === homeTeam.id && m.awayTeam.id === awayTeam.id) ||
          (m.homeTeam.id === awayTeam.id && m.awayTeam.id === homeTeam.id)
        );

        if (sharedMatch) {
          try {
            // Step 2: Use the matchId to query the explicit head2head endpoint
            const h2hData = await fetchFromApi(`/matches/${sharedMatch.id}/head2head?limit=15`);
            if (h2hData && h2hData.matches && h2hData.matches.length > 0) {
              ingestMatches(h2hData.matches);
              h2hResult = formatApiH2H(homeTeam, awayTeam, h2hData.matches);
            }
          } catch (err) {
            console.warn(`[API] Failed to fetch explicit H2H for match ${sharedMatch.id}`, err.message);
          }
        }
        
        // Step 3: Fallback si el endpoint falla o no devuelve matches
        if (!h2hResult) {
          const recentH2H = apiData.matches
            .filter((m) =>
              (m.homeTeam.id === homeTeam.id && m.awayTeam.id === awayTeam.id) ||
              (m.homeTeam.id === awayTeam.id && m.awayTeam.id === homeTeam.id)
            )
            .slice(0, 10);
            
          if (recentH2H.length > 0) {
            h2hResult = formatApiH2H(homeTeam, awayTeam, recentH2H);
          }
        }
      }
    } catch (e) {
      console.warn(`[API] Failed to fetch real H2H, falling back to generated:`, e.message);
    }
  }

  // Fallback if no real H2H found or API rate limited
  if (!h2hResult) {
    h2hResult = generateH2H(homeTeam, awayTeam);
  }

  setCache(cacheKey, h2hResult);
  return h2hResult;
}

function generateH2H(homeTeam, awayTeam) {
  const homeStr = 1 - (homeTeam.position - 1) / 20;
  const awayStr = 1 - (awayTeam.position - 1) / 20;
  const dates = ['2025-10-22', '2025-04-14', '2024-11-03', '2024-03-31', '2023-10-08'];

  const matches = dates.map((date, i) => {
    const homeAdv = i % 2 === 0 ? 0.15 : -0.1;
    const hGoals = Math.round(0.5 + (homeStr + homeAdv) * 2 * Math.random());
    const aGoals = Math.round(0.3 + awayStr * 2 * Math.random());
    const winner = hGoals > aGoals ? homeTeam.name : aGoals > hGoals ? awayTeam.name : 'Empate';
    return { date, homeScore: hGoals, awayScore: aGoals, winner, venue: i % 2 === 0 ? `Estadio ${homeTeam.shortName}` : `Estadio ${awayTeam.shortName}` };
  });

  let homeWins = 0, awayWins = 0, draws = 0;
  matches.forEach((m) => {
    if (m.winner === homeTeam.name) homeWins++;
    else if (m.winner === awayTeam.name) awayWins++;
    else draws++;
  });

  return {
    homeTeam: { id: homeTeam.id, name: homeTeam.name, shortName: homeTeam.shortName },
    awayTeam: { id: awayTeam.id, name: awayTeam.name, shortName: awayTeam.shortName },
    summary: {
      totalMatches: matches.length,
      homeWins, draws, awayWins,
      homeWinPct: matches.length > 0 ? Math.round((homeWins / matches.length) * 100) : 0,
      drawPct: matches.length > 0 ? Math.round((draws / matches.length) * 100) : 0,
      awayWinPct: matches.length > 0 ? Math.round((awayWins / matches.length) * 100) : 0,
    },
    matches,
  };
}

function formatApiH2H(homeTeam, awayTeam, apiMatches) {
  const matches = apiMatches.map((m) => {
    const actualHomeScore = m.score?.fullTime?.home ?? 0;
    const actualAwayScore = m.score?.fullTime?.away ?? 0;
    
    // Determine the winner name
    const winnerName = m.score?.winner === 'HOME_TEAM' ? m.homeTeam.name 
                     : m.score?.winner === 'AWAY_TEAM' ? m.awayTeam.name 
                     : 'Empate';
    
    const h2hHomeWasActualHome = m.homeTeam.id === homeTeam.id;
    
    return {
      date: m.utcDate?.slice(0, 10),
      homeScore: h2hHomeWasActualHome ? actualHomeScore : actualAwayScore,
      awayScore: h2hHomeWasActualHome ? actualAwayScore : actualHomeScore,
      winner: winnerName,
      venue: m.homeTeam.name,
      competition: m.competition?.name || m.competition?.code || 'Unknown',
    };
  });

  let homeWins = 0, awayWins = 0, draws = 0;
  matches.forEach((m) => {
    if (m.winner === homeTeam.name) homeWins++;
    else if (m.winner === awayTeam.name) awayWins++;
    else draws++;
  });
  return {
    homeTeam: { id: homeTeam.id, name: homeTeam.name, shortName: homeTeam.shortName },
    awayTeam: { id: awayTeam.id, name: awayTeam.name, shortName: awayTeam.shortName },
    summary: {
      totalMatches: matches.length,
      homeWins, draws, awayWins,
      homeWinPct: matches.length > 0 ? Math.round((homeWins / matches.length) * 100) : 0,
      drawPct: matches.length > 0 ? Math.round((draws / matches.length) * 100) : 0,
      awayWinPct: matches.length > 0 ? Math.round((awayWins / matches.length) * 100) : 0,
    },
    matches,
  };
}

/* ──────────────────────────────────────────────────────
   Refuerzo con forma domestica
   ────────────────────────────────────────────────────── */

// Ligas domesticas que ya sabemos consultar, de mayor a menor nivel medio.
const DOMESTIC_LEAGUES = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'PPL', 'DED', 'ELC', 'BSA'];

/**
 * En la fase de liga de la Champions, en la jornada 1 TODOS los equipos
 * llegan con 0 partidos, 0 goles y la misma posicion (empatados a cero).
 * El motor recibia entonces cifras identicas para el Bayern y para el
 * Sabah FK, asi que era matematicamente imposible que diera picks
 * distintos: salian los mismos tres mercados con los mismos numeros en
 * todos los partidos.
 *
 * Los equipos SI han jugado en su liga. football-data.org usa el mismo id
 * de equipo en todas las competiciones, asi que se puede recuperar su
 * rendimiento domestico y usarlo como base.
 *
 * Devuelve el equipo enriquecido y marca de donde salen los datos, para
 * que la interfaz pueda avisar cuando no hemos encontrado nada.
 */
async function enrichWithDomesticForm(team, leagueId) {
  if (!team) return team;
  // Con 3 o mas partidos en la propia competicion ya hay senal suficiente.
  if (leagueId !== 'CL' || team.played >= 3) {
    return { ...team, statsSource: 'competition' };
  }

  for (const domestic of DOMESTIC_LEAGUES) {
    let standings;
    try {
      standings = await getLeagueStandings(domestic);
    } catch {
      continue;
    }
    if (standings.dataSource !== 'live') continue;

    const row = standings.teams.find((t) => t.id === team.id);
    if (!row || !row.played) continue;

    const domesticTeams = standings.teams.length || 20;
    // La posicion domestica se traslada a la escala de la Champions. Se
    // comprime al tramo alto porque cualquier equipo clasificado para
    // esta competicion esta, por definicion, por encima de la media.
    const percentile = (row.position - 1) / Math.max(domesticTeams - 1, 1);
    const clTeams = 36;
    const mappedPosition = Math.max(1, Math.round(1 + percentile * (clTeams - 1) * 0.70));

    return {
      ...team,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      position: mappedPosition,
      form: row.form && row.form.length ? row.form : team.form,
      statsSource: 'domestic',
      statsSourceLeague: domestic,
      domesticPosition: row.position,
      domesticTeams,
    };
  }

  // No lo encontramos en ninguna liga soportada: se queda como esta, pero
  // marcado para que no se presente como si tuviera respaldo estadistico.
  return { ...team, statsSource: team.played > 0 ? 'competition' : 'none' };
}

/* ──────────────────────────────────────────────────────
   Public API: Match Prediction
   ────────────────────────────────────────────────────── */
export async function getMatchPredictionDetails(homeTeamId, awayTeamId, leagueId = 'PL') {
  const standings = await getLeagueStandings(leagueId);
  const rawHome = standings.teams.find((t) => t.id === Number(homeTeamId)) || standings.teams[0];
  const rawAway = standings.teams.find((t) => t.id === Number(awayTeamId)) || standings.teams[1];

  // Si el equipo no tiene partidos en esta competicion, se recupera su
  // rendimiento en su liga domestica antes de predecir nada.
  const [homeTeam, awayTeam] = await Promise.all([
    enrichWithDomesticForm(rawHome, leagueId),
    enrichWithDomesticForm(rawAway, leagueId),
  ]);

  // Historial completo de ambos equipos en TODAS las competiciones.
  // Es la fuente principal del modelo: la tabla de clasificacion solo se
  // usa como respaldo cuando un equipo no tiene historial descargable.
  const [homeHistory, awayHistory] = await Promise.all([
    getTeamHistory(homeTeam.id).catch(() => null),
    getTeamHistory(awayTeam.id).catch(() => null),
  ]);

  // Rivales en comun: aunque no se hayan enfrentado entre ellos, si han
  // jugado contra los mismos equipos se pueden comparar por ahi.
  const commonOpponents = compareByCommonOpponents(homeHistory, awayHistory);

  const h2h = await getH2HHistory(homeTeamId, awayTeamId, leagueId);
  
  // Mapeo football-data.org -> api-football (ids de competicion distintos)
  const externalLeagueId = API_FOOTBALL_LEAGUE_IDS[leagueId] || API_FOOTBALL_LEAGUE_IDS.PL;
  const season = currentSeason();

  // Se resuelve por NOMBRE, no por id: las dos APIs numeran los equipos
  // de forma independiente.
  const [homeExternalStats, awayExternalStats] = await Promise.all([
    getTeamStats(homeTeam.name, externalLeagueId, season),
    getTeamStats(awayTeam.name, externalLeagueId, season),
  ]);

  const prediction = calculateMatchPrediction(
    homeTeam,
    awayTeam,
    h2h.matches,
    homeExternalStats,
    awayExternalStats,
    {
      leagueId,
      isLiveData: standings.dataSource === 'live',
      homeHistory,
      awayHistory,
      commonOpponents,
    }
  );

  // Toda prediccion queda registrada para poder medir despues cuanto
  // acierta de verdad. Sin esto no hay forma de saber si el modelo
  // mejora o empeora con los cambios.
  try {
    recordPrediction({ leagueId, homeTeam, awayTeam, prediction });
  } catch (err) {
    console.warn('[Backtest] No se pudo registrar la prediccion:', err.message);
  }

  // Avisos honestos sobre de donde salen los datos de cada equipo.
  const warnings = [];
  [[homeTeam, homeHistory], [awayTeam, awayHistory]].forEach(([t, h]) => {
    if (h?.known) {
      // Con historial propio el equipo ya no depende de la tabla.
      if (h.count < 6) {
        warnings.push(`${t.name}: solo ${h.count} partidos en el historial descargable, la estimacion es debil.`);
      }
      return;
    }
    if (!h || !h.known) {
      warnings.push(`${t.name}: sin historial de partidos disponible en la API. El modelo solo puede asumir un equipo promedio.`);
    }
  });

  // El aviso de "sin partidos en esta competicion" solo tiene sentido si
  // ademas no hemos podido recuperar historial: con 50 partidos
  // descargados da igual que la tabla de la competicion este a cero.
  const histFor = (t) => (t.id === homeTeam.id ? homeHistory : awayHistory);
  [homeTeam, awayTeam].forEach((t) => {
    if (histFor(t)?.known && histFor(t).count >= 6) return;
    if (t.statsSource === 'domestic') {
      warnings.push(
        `${t.name}: sin partidos jugados en esta competicion. Se usa su rendimiento en ${t.statsSourceLeague} (${t.domesticPosition}o de ${t.domesticTeams}, ${t.played} partidos).`
      );
    }
  });

  return {
    matchInfo: { league: standings.league, homeTeam, awayTeam },
    h2h,
    prediction,
    commonOpponents,
    ratings: {
      home: getRating(homeTeam.id),
      away: getRating(awayTeam.id),
    },
    dataWarnings: warnings,
    dataSource: standings.dataSource,
  };
}
