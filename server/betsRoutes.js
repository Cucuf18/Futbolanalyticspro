import express from 'express';
import crypto from 'crypto';
import { probeApiFootball } from './services/apiFootballProbe.js';
import { listBets, addBet, resolveBet, deleteBet, setClosingOdds, setInitialBankroll, settleBets } from './services/bets.js';

/**
 * Rutas de "Mis apuestas reales".
 * Son datos personales (tu banca), asi que van protegidas con una clave:
 * variable BETS_TOKEN en Render. Sin ella las rutas estan desactivadas.
 * La clave viaja en la cabecera x-bets-token.
 */
export const betsRouter = express.Router();

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const failures = new Map(); // ip -> { count, resetAt }
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export function requireToken(req, res, next) {
  const expected = process.env.BETS_TOKEN;
  if (!expected) {
    return res.status(503).json({
      success: false,
      error: 'Esta funcion esta desactivada: falta configurar BETS_TOKEN en el servidor.',
    });
  }
  const ip = req.ip || 'desconocida';
  const f = failures.get(ip);
  if (f && f.resetAt > Date.now() && f.count >= MAX_FAILS) {
    return res.status(429).json({ success: false, error: 'Demasiados intentos. Espera unos minutos.' });
  }
  const given = req.get('x-bets-token') || '';
  if (!crypto.timingSafeEqual(sha(given), sha(expected))) {
    const cur = f && f.resetAt > Date.now() ? f : { count: 0, resetAt: Date.now() + WINDOW_MS };
    cur.count++;
    failures.set(ip, cur);
    return res.status(401).json({ success: false, error: 'Clave incorrecta.' });
  }
  failures.delete(ip);
  next();
}

betsRouter.use(requireToken);

const fail = (res, r) => res.status(r.notFound ? 404 : 400).json({ success: false, error: r.error });

betsRouter.get('/', (req, res) => res.json({ success: true, ...listBets() }));

betsRouter.post('/', (req, res) => {
  const r = addBet(req.body);
  if (r.error) return fail(res, r);
  res.status(201).json({ success: true, bet: r.bet });
});

betsRouter.put('/settings', (req, res) => {
  const r = setInitialBankroll(req.body?.initialBankroll);
  if (r.error) return fail(res, r);
  res.json({ success: true, ...listBets() });
});

betsRouter.post('/settle', async (req, res) => {
  try {
    res.json({ success: true, ...(await settleBets()), ...listBets() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

betsRouter.post('/:id/resolve', (req, res) => {
  const r = resolveBet(req.params.id, req.body?.status, req.body?.payout ?? null);
  if (r.error) return fail(res, r);
  res.json({ success: true, bet: r.bet, ...listBets() });
});

betsRouter.post('/:id/closing', (req, res) => {
  const r = setClosingOdds(req.params.id, req.body?.odds ?? null);
  if (r.error) return fail(res, r);
  res.json({ success: true, bet: r.bet, ...listBets() });
});

betsRouter.delete('/:id', (req, res) => {
  const r = deleteBet(req.params.id);
  if (r.error) return fail(res, r);
  res.json({ success: true, ...listBets() });
});

/**
 * Sondeo del plan gratuito de API-Football (protegido con la misma clave).
 * Sirve para saber que datos extra (lesiones, arbitros, cuotas) se pueden
 * usar de verdad antes de construir nada sobre ellos.
 */
export const diagRouter = express.Router();
diagRouter.use(requireToken);
diagRouter.get('/api-football', async (req, res) => {
  try {
    const season = Number.parseInt(req.query.season, 10) || new Date().getFullYear();
    res.json({ success: true, ...(await probeApiFootball(process.env.APIFOOTBALL_KEY, { season })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
