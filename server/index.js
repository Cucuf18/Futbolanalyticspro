import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getLeagueStandings, getH2HHistory, getMatchPredictionDetails } from './services/sportsApi.js';

const app = express();

app.use(cors());
app.use(express.json());

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'FutbolAnalytics Predictive Engine API',
    timestamp: new Date().toISOString(),
  });
});

// Get Supported Leagues
app.get('/api/leagues', (req, res) => {
  res.json({ success: true, leagues: config.supportedLeagues });
});

// Get League Standings and Team Stats
app.get('/api/standings/:leagueId', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const standingsData = await getLeagueStandings(leagueId);
    res.json({ success: true, data: standingsData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Head to Head (H2H) between two teams
app.get('/api/h2h/:homeId/:awayId', async (req, res) => {
  try {
    const { homeId, awayId } = req.params;
    const leagueId = req.query.leagueId || 'PL';
    const h2h = await getH2HHistory(homeId, awayId, leagueId);
    res.json({ success: true, data: h2h });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get AI Statistical Match Prediction
app.get('/api/predict/:homeId/:awayId', async (req, res) => {
  try {
    const { homeId, awayId } = req.params;
    const leagueId = req.query.leagueId || 'PL';
    const details = await getMatchPredictionDetails(homeId, awayId, leagueId);
    res.json({ success: true, data: details });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(` ⚽ FutbolAnalytics API Server running on port ${config.port}`);
  console.log(` 🚀 Environment: ${config.env}`);
  console.log(` 📊 Endpoint: http://localhost:${config.port}/api/health`);
  console.log(`=======================================================`);
});
