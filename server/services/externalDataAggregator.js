import { config } from '../config.js';

// Simple in-memory cache for external data
const cache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function getTeamStats(teamId, leagueId, season = '2024') {
  const cacheKey = `team_stats_${teamId}_${leagueId}_${season}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  if (!config.apiFootballKey) {
    console.warn('[ExternalData] API_FOOTBALL_KEY not configured. Falling back to estimates.');
    return null;
  }

  try {
    console.log(`[ExternalData] Fetching real stats for team ${teamId} from api-football...`);
    const response = await fetch(`${config.apiFootballBaseUrl}/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`, {
      method: 'GET',
      headers: {
        'x-apisports-key': config.apiFootballKey
      }
    });

    if (!response.ok) {
      console.warn(`[ExternalData] HTTP Error: ${response.status}`);
      return null;
    }

    const json = await response.json();
    if (json.errors && Object.keys(json.errors).length > 0) {
      console.warn('[ExternalData] API Error:', json.errors);
      return null;
    }

    const data = json.response;
    if (!data) return null;

    // Parse the data to extract meaningful stats
    const fixtures = data.fixtures || {};
    const played = fixtures.played?.total || 1;
    
    // API-Football returns cards as objects with time intervals, we need to sum them
    const yellowCardsObj = data.cards?.yellow || {};
    const redCardsObj = data.cards?.red || {};
    
    const countCards = (cardObj) => {
      let total = 0;
      for (const key in cardObj) {
        if (cardObj[key].total !== null) {
          total += cardObj[key].total;
        }
      }
      return total;
    };

    const totalYellowCards = countCards(yellowCardsObj);
    const totalRedCards = countCards(redCardsObj);

    // Goal stats
    const goalsFor = data.goals?.for?.total?.total || 0;
    const goalsAgainst = data.goals?.against?.total?.total || 0;

    // In /teams/statistics, corners/shots/fouls might not be available directly in all plans.
    // If they aren't, we will fall back to estimates based on goals/possession.
    // Let's store what we can.
    
    const goalsForAvg = played > 0 ? goalsFor / played : 1.5;
    const goalsAgainstAvg = played > 0 ? goalsAgainst / played : 1.5;

    // Better fallback formulas based on typical football stats and team strength (using goals as proxy)
    // Strong teams (high goalsFor) get more corners/shots, weak teams (high goalsAgainst) get more fouls.
    
    // Corners: Base 4.5 + up to 2.5 based on goals
    const teamCorners = 4.5 + Math.min((goalsForAvg / 2.5) * 2.5, 2.5);
    
    // Shots on Target: Base 3.5 + up to 3.0 based on goals
    const teamSot = 3.5 + Math.min((goalsForAvg / 2.5) * 3.0, 3.0);

    // Total Shots: Base 10.0 + up to 6.0 based on goals
    const teamTotalShots = 10.0 + Math.min((goalsForAvg / 2.5) * 6.0, 6.0);

    // Fouls: Base 10.0 + up to 3.0 based on goalsAgainst (weaker teams foul more)
    const teamFouls = 10.0 + Math.min((goalsAgainstAvg / 2.5) * 3.0, 3.0);

    // Offsides: Base 1.5 + up to 1.0 based on goals
    const teamOffsides = 1.5 + Math.min((goalsForAvg / 2.5) * 1.0, 1.0);

    const stats = {
      played,
      avgGoalsFor: Number(goalsForAvg.toFixed(2)),
      avgGoalsAgainst: Number(goalsAgainstAvg.toFixed(2)),
      avgYellowCards: Number((totalYellowCards / played).toFixed(2)),
      avgRedCards: Number((totalRedCards / played).toFixed(2)),
      // Fallbacks
      avgCorners: Number(teamCorners.toFixed(2)),
      avgShotsOnTarget: Number(teamSot.toFixed(2)),
      avgTotalShots: Number(teamTotalShots.toFixed(2)),
      avgFouls: Number(teamFouls.toFixed(2)),
      avgOffsides: Number(teamOffsides.toFixed(2)),
    };

    cache.set(cacheKey, { data: stats, timestamp: Date.now() });
    return stats;

  } catch (error) {
    console.error('[ExternalData] Fetch error:', error);
    return null;
  }
}
