import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { config } from './config.js';
import { getLeagueStandings, getH2HHistory, getMatchPredictionDetails } from './services/sportsApi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// ─────────────────────────────────────────────────────────
// Serve Frontend in Production
// ─────────────────────────────────────────────────────────
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(` FutbolAnalytics API Server running on port ${config.port}`);
  console.log(` Environment: ${config.env}`);
  console.log(` API Key: ${config.footballApiKey ? 'Configured (live data)' : 'Not set (simulated data)'}`);
  console.log(` Health: http://localhost:${config.port}/api/health`);
  console.log(`=======================================================`);
});
