import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { config } from './config.js';
import { getLeagueStandings, getH2HHistory, getMatchPredictionDetails } from './services/sportsApi.js';
import { learn, getWeights, getMarketReport } from './services/weightOptimizer.js';
import { getPoolStats } from './services/ratingPool.js';
import { settlePending, getReport, getPending } from './services/backtest.js';
import { getTeamStats } from './services/externalDataAggregator.js';

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

// Get team external stats from api-football
app.get('/api/team-stats/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const leagueId = req.query.leagueId || '39'; // Default PL
    const stats = await getTeamStats(teamId, leagueId, '2024');
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Learn feedback loop
app.post('/api/learn', (req, res) => {
  try {
    const { history } = req.body;
    const updatedWeights = learn(history);
    res.json({ success: true, weights: updatedWeights });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── BACKTEST AUTOMATICO ──
// Informe de rendimiento real del modelo, con curva de calibracion.
app.get('/api/backtest/report', (req, res) => {
  try {
    res.json({ success: true, report: getReport() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Predicciones guardadas todavia sin resolver.
app.get('/api/backtest/pending', (req, res) => {
  try {
    res.json({ success: true, pending: getPending() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resuelve contra los resultados reales las predicciones ya jugadas.
app.post('/api/backtest/settle', async (req, res) => {
  try {
    res.json({ success: true, result: await settlePending() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Estado de la bolsa de ratings Elo
app.get('/api/ratings', (req, res) => {
  try {
    res.json({ success: true, pool: getPoolStats() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rendimiento historico por mercado (que mercados aciertan de verdad)
app.get('/api/market-report', (req, res) => {
  try {
    res.json({ success: true, markets: getMarketReport() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get current engine weights
app.get('/api/weights', (req, res) => {
  try {
    const currentWeights = getWeights();
    res.json({ success: true, weights: currentWeights });
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

/* ─────────────────────────────────────────────────────────
   Resolucion automatica del backtest
   El endpoint /api/backtest/settle existia pero nadie lo llamaba, asi
   que las predicciones se guardaban y no se resolvian nunca. Ahora el
   propio servidor lo hace solo: no hace falta tocar la terminal.
   ───────────────────────────────────────────────────────── */
const SETTLE_INTERVAL_MS = 6 * 60 * 60 * 1000; // cada 6 horas

async function autoSettle() {
  try {
    const result = await settlePending();
    if (result.settled > 0) {
      console.log(`[Backtest] Resueltas ${result.settled} predicciones contra resultados reales.`);
    }
  } catch (err) {
    console.warn('[Backtest] Fallo la resolucion automatica:', err.message);
  }
}

// Un primer pase al arrancar (con margen para no competir con el
// arranque) y despues cada 6 horas.
setTimeout(autoSettle, 60 * 1000).unref?.();
setInterval(autoSettle, SETTLE_INTERVAL_MS).unref?.();

app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(` FutbolAnalytics API Server running on port ${config.port}`);
  console.log(` Environment: ${config.env}`);
  console.log(` API Key: ${config.footballApiKey ? 'Configured (live data)' : 'Not set (simulated data)'}`);
  console.log(` Health: http://localhost:${config.port}/api/health`);
  console.log(`=======================================================`);
});
