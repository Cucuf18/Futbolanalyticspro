import { config } from '../config.js';
import { calculateMatchPrediction } from './predictorEngine.js';

// Realistic mock data store for full out-of-the-box functionality
const LEAGUE_MOCK_DATA = {
  PL: {
    league: { id: 'PL', name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra', season: '2025/2026' },
    teams: [
      { id: 1, name: 'Arsenal FC', shortName: 'Arsenal', logo: '🔴⚪', position: 1, played: 24, won: 17, drawn: 4, lost: 3, goalsFor: 52, goalsAgainst: 18, points: 55, form: ['W', 'W', 'D', 'W', 'W'], xG: 2.15 },
      { id: 2, name: 'Manchester City', shortName: 'Man City', logo: '🩵', position: 2, played: 24, won: 16, drawn: 5, lost: 3, goalsFor: 56, goalsAgainst: 22, points: 53, form: ['W', 'L', 'W', 'W', 'D'], xG: 2.30 },
      { id: 3, name: 'Liverpool FC', shortName: 'Liverpool', logo: '🔴', position: 3, played: 24, won: 15, drawn: 6, lost: 3, goalsFor: 50, goalsAgainst: 24, points: 51, form: ['W', 'D', 'W', 'W', 'W'], xG: 2.05 },
      { id: 4, name: 'Aston Villa', shortName: 'Villa', logo: '🟣🦁', position: 4, played: 24, won: 14, drawn: 4, lost: 6, goalsFor: 44, goalsAgainst: 30, points: 46, form: ['D', 'W', 'L', 'W', 'W'], xG: 1.75 },
      { id: 5, name: 'Tottenham Hotspur', shortName: 'Tottenham', logo: '⚪🐓', position: 5, played: 24, won: 13, drawn: 5, lost: 6, goalsFor: 47, goalsAgainst: 34, points: 44, form: ['L', 'W', 'W', 'D', 'L'], xG: 1.88 },
      { id: 6, name: 'Chelsea FC', shortName: 'Chelsea', logo: '🔵', position: 6, played: 24, won: 11, drawn: 6, lost: 7, goalsFor: 41, goalsAgainst: 32, points: 39, form: ['W', 'D', 'L', 'W', 'D'], xG: 1.65 },
      { id: 7, name: 'Manchester United', shortName: 'Man Utd', logo: '🔴😈', position: 7, played: 24, won: 11, drawn: 4, lost: 9, goalsFor: 36, goalsAgainst: 35, points: 37, form: ['W', 'L', 'D', 'W', 'L'], xG: 1.48 },
      { id: 8, name: 'Newcastle United', shortName: 'Newcastle', logo: '⚫⚪', position: 8, played: 24, won: 10, drawn: 5, lost: 9, goalsFor: 42, goalsAgainst: 36, points: 35, form: ['D', 'W', 'L', 'L', 'W'], xG: 1.60 },
    ],
  },
  PD: {
    league: { id: 'PD', name: 'La Liga', country: '🇪🇸 España', season: '2025/2026' },
    teams: [
      { id: 101, name: 'Real Madrid', shortName: 'Real Madrid', logo: '👑⚪', position: 1, played: 24, won: 18, drawn: 4, lost: 2, goalsFor: 54, goalsAgainst: 16, points: 58, form: ['W', 'W', 'W', 'D', 'W'], xG: 2.25 },
      { id: 102, name: 'FC Barcelona', shortName: 'Barcelona', logo: '🔵🔴', position: 2, played: 24, won: 17, drawn: 3, lost: 4, goalsFor: 58, goalsAgainst: 25, points: 54, form: ['W', 'W', 'L', 'W', 'W'], xG: 2.40 },
      { id: 103, name: 'Atlético de Madrid', shortName: 'Atlético', logo: '🔴⚪', position: 3, played: 24, won: 15, drawn: 5, lost: 4, goalsFor: 42, goalsAgainst: 19, points: 50, form: ['W', 'D', 'W', 'W', 'L'], xG: 1.80 },
      { id: 104, name: 'Girona FC', shortName: 'Girona', logo: '🔴⚪', position: 4, played: 24, won: 14, drawn: 5, lost: 5, goalsFor: 46, goalsAgainst: 31, points: 47, form: ['L', 'W', 'D', 'W', 'W'], xG: 1.85 },
      { id: 105, name: 'Athletic Club', shortName: 'Athletic', logo: '🔴⚪🦁', position: 5, played: 24, won: 12, drawn: 6, lost: 6, goalsFor: 38, goalsAgainst: 23, points: 42, form: ['W', 'D', 'W', 'D', 'W'], xG: 1.55 },
      { id: 106, name: 'Real Sociedad', shortName: 'Real Sociedad', logo: '🔵⚪', position: 6, played: 24, won: 10, drawn: 7, lost: 7, goalsFor: 33, goalsAgainst: 26, points: 37, form: ['D', 'L', 'W', 'D', 'L'], xG: 1.40 },
    ],
  },
  SA: {
    league: { id: 'SA', name: 'Serie A', country: '🇮🇹 Italia', season: '2025/2026' },
    teams: [
      { id: 201, name: 'Inter Milan', shortName: 'Inter', logo: '⚫🔵', position: 1, played: 24, won: 19, drawn: 3, lost: 2, goalsFor: 59, goalsAgainst: 14, points: 60, form: ['W', 'W', 'W', 'W', 'D'], xG: 2.35 },
      { id: 202, name: 'Juventus FC', shortName: 'Juventus', logo: '⚪⚫', position: 2, played: 24, won: 16, drawn: 5, lost: 3, goalsFor: 38, goalsAgainst: 15, points: 53, form: ['W', 'D', 'W', 'L', 'W'], xG: 1.70 },
      { id: 203, name: 'AC Milan', shortName: 'AC Milan', logo: '🔴⚫', position: 3, played: 24, won: 15, drawn: 4, lost: 5, goalsFor: 48, goalsAgainst: 28, points: 49, form: ['W', 'W', 'D', 'W', 'L'], xG: 1.95 },
      { id: 204, name: 'Atalanta BC', shortName: 'Atalanta', logo: '🔵⚫', position: 4, played: 24, won: 13, drawn: 4, lost: 7, goalsFor: 46, goalsAgainst: 29, points: 43, form: ['W', 'L', 'W', 'W', 'W'], xG: 1.90 },
      { id: 205, name: 'AS Roma', shortName: 'Roma', logo: '🟡🔴', position: 5, played: 24, won: 12, drawn: 5, lost: 7, goalsFor: 40, goalsAgainst: 31, points: 41, form: ['D', 'W', 'W', 'L', 'D'], xG: 1.62 },
    ],
  },
  BL1: {
    league: { id: 'BL1', name: 'Bundesliga', country: '🇩🇪 Alemania', season: '2025/2026' },
    teams: [
      { id: 301, name: 'Bayer Leverkusen', shortName: 'Leverkusen', logo: '🔴⚫', position: 1, played: 24, won: 18, drawn: 5, lost: 1, goalsFor: 57, goalsAgainst: 17, points: 59, form: ['W', 'W', 'D', 'W', 'W'], xG: 2.20 },
      { id: 302, name: 'Bayern München', shortName: 'Bayern', logo: '🔴⚪', position: 2, played: 24, won: 17, drawn: 3, lost: 4, goalsFor: 62, goalsAgainst: 26, points: 54, form: ['W', 'L', 'W', 'W', 'D'], xG: 2.50 },
      { id: 303, name: 'VfB Stuttgart', shortName: 'Stuttgart', logo: '⚪🔴', position: 3, played: 24, won: 15, drawn: 3, lost: 6, goalsFor: 51, goalsAgainst: 31, points: 48, form: ['W', 'W', 'W', 'L', 'W'], xG: 1.98 },
      { id: 304, name: 'Borussia Dortmund', shortName: 'Dortmund', logo: '🟡⚫', position: 4, played: 24, won: 12, drawn: 7, lost: 5, goalsFor: 45, goalsAgainst: 30, points: 43, form: ['D', 'W', 'D', 'W', 'D'], xG: 1.78 },
    ],
  },
  CL: {
    league: { id: 'CL', name: 'Champions League', country: '🇪🇺 Europa', season: '2025/2026' },
    teams: [
      { id: 101, name: 'Real Madrid', shortName: 'Real Madrid', logo: '👑⚪', position: 1, played: 8, won: 7, drawn: 0, lost: 1, goalsFor: 21, goalsAgainst: 7, points: 21, form: ['W', 'W', 'W', 'W', 'L'], xG: 2.45 },
      { id: 1, name: 'Arsenal FC', shortName: 'Arsenal', logo: '🔴⚪', position: 2, played: 8, won: 6, drawn: 1, lost: 1, goalsFor: 18, goalsAgainst: 5, points: 19, form: ['W', 'W', 'D', 'W', 'W'], xG: 2.10 },
      { id: 2, name: 'Manchester City', shortName: 'Man City', logo: '🩵', position: 3, played: 8, won: 6, drawn: 1, lost: 1, goalsFor: 20, goalsAgainst: 8, points: 19, form: ['W', 'W', 'W', 'D', 'W'], xG: 2.38 },
      { id: 302, name: 'Bayern München', shortName: 'Bayern', logo: '🔴⚪', position: 4, played: 8, won: 5, drawn: 2, lost: 1, goalsFor: 19, goalsAgainst: 10, points: 17, form: ['W', 'D', 'W', 'L', 'W'], xG: 2.20 },
      { id: 102, name: 'FC Barcelona', shortName: 'Barcelona', logo: '🔵🔴', position: 5, played: 8, won: 5, drawn: 1, lost: 2, goalsFor: 17, goalsAgainst: 11, points: 16, form: ['W', 'W', 'L', 'W', 'W'], xG: 2.15 },
    ],
  },
};

/**
 * Fetch Standings for a league
 */
export async function getLeagueStandings(leagueId = 'PL') {
  if (config.footballApiKey) {
    try {
      const response = await fetch(`${config.footballApiBaseUrl}/competitions/${leagueId}/standings`, {
        headers: { 'X-Auth-Token': config.footballApiKey },
      });
      if (response.ok) {
        const data = await response.json();
        return parseExternalStandings(data, leagueId);
      }
    } catch (err) {
      console.warn(`[SportsAPI] External API error, falling back to simulated data: ${err.message}`);
    }
  }

  // Fallback / Standalone high fidelity data
  return LEAGUE_MOCK_DATA[leagueId] || LEAGUE_MOCK_DATA.PL;
}

/**
 * Fetch Head-to-Head (H2H) match history between two teams
 */
export async function getH2HHistory(homeTeamId, awayTeamId, leagueId = 'PL') {
  const leagueData = LEAGUE_MOCK_DATA[leagueId] || LEAGUE_MOCK_DATA.PL;
  const homeTeam = leagueData.teams.find((t) => t.id === Number(homeTeamId)) || leagueData.teams[0];
  const awayTeam = leagueData.teams.find((t) => t.id === Number(awayTeamId)) || leagueData.teams[1];

  // Generate realistic historical H2H matches between these two teams
  const dates = ['2025-10-22', '2025-04-14', '2024-11-03', '2024-03-31', '2023-10-08'];
  const matches = [
    { date: dates[0], homeScore: 2, awayScore: 1, winner: homeTeam.name, venue: `${homeTeam.name} Stadium` },
    { date: dates[1], homeScore: 1, awayScore: 1, winner: 'Empate', venue: `${awayTeam.name} Stadium` },
    { date: dates[2], homeScore: 0, awayScore: 2, winner: awayTeam.name, venue: `${homeTeam.name} Stadium` },
    { date: dates[3], homeScore: 3, awayScore: 1, winner: homeTeam.name, venue: `${awayTeam.name} Stadium` },
    { date: dates[4], homeScore: 2, awayScore: 2, winner: 'Empate', venue: `${homeTeam.name} Stadium` },
  ];

  let homeWins = 0, awayWins = 0, draws = 0;
  matches.forEach((m) => {
    if (m.winner === homeTeam.name) homeWins++;
    else if (m.winner === awayTeam.name) awayWins++;
    else draws++;
  });

  return {
    homeTeam: { id: homeTeam.id, name: homeTeam.name, shortName: homeTeam.shortName, logo: homeTeam.logo },
    awayTeam: { id: awayTeam.id, name: awayTeam.name, shortName: awayTeam.shortName, logo: awayTeam.logo },
    summary: {
      totalMatches: matches.length,
      homeWins,
      draws,
      awayWins,
      homeWinPct: Math.round((homeWins / matches.length) * 100),
      drawPct: Math.round((draws / matches.length) * 100),
      awayWinPct: Math.round((awayWins / matches.length) * 100),
    },
    matches,
  };
}

/**
 * Get comprehensive match analysis & AI Statistical Prediction
 */
export async function getMatchPredictionDetails(homeTeamId, awayTeamId, leagueId = 'PL') {
  const leagueData = LEAGUE_MOCK_DATA[leagueId] || LEAGUE_MOCK_DATA.PL;
  const homeTeam = leagueData.teams.find((t) => t.id === Number(homeTeamId)) || leagueData.teams[0];
  const awayTeam = leagueData.teams.find((t) => t.id === Number(awayTeamId)) || leagueData.teams[1];

  const h2h = await getH2HHistory(homeTeamId, awayTeamId, leagueId);
  const prediction = calculateMatchPrediction(homeTeam, awayTeam, h2h.matches);

  return {
    matchInfo: {
      league: leagueData.league,
      homeTeam,
      awayTeam,
    },
    h2h,
    prediction,
  };
}

function parseExternalStandings(apiData, leagueId) {
  // Helper if external Football-Data.org API response is parsed
  try {
    const table = apiData.standings?.[0]?.table || [];
    const teams = table.map((item) => ({
      id: item.team.id,
      name: item.team.name,
      shortName: item.team.tla || item.team.shortName || item.team.name,
      logo: '⚽',
      position: item.position,
      played: item.playedGames,
      won: item.won,
      drawn: item.draw,
      lost: item.lost,
      goalsFor: item.goalsFor,
      goalsAgainst: item.goalsAgainst,
      points: item.points,
      form: item.form ? item.form.split(',') : ['W', 'D', 'W', 'W', 'L'],
      xG: Number((1.2 + (item.goalsFor / Math.max(item.playedGames, 1)) * 0.4).toFixed(2)),
    }));

    return {
      league: { id: leagueId, name: apiData.competition?.name || leagueId, season: '2025/2026' },
      teams,
    };
  } catch (err) {
    return LEAGUE_MOCK_DATA[leagueId] || LEAGUE_MOCK_DATA.PL;
  }
}
