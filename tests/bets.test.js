import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import path from 'path';
import fs from 'fs';
import http from 'http';
import express from 'express';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fap-bets-'));
delete process.env.DATABASE_URL;
delete process.env.FOOTBALL_API_KEY;
process.env.BETS_TOKEN = 'clave-secreta-de-prueba';

const B = await import('../server/services/bets.js');
const { betsRouter } = await import('../server/betsRoutes.js');
const { _resetForTests } = await import('../server/services/persistence.js');

const leg = (over = {}) => ({
  matchLabel: 'A vs B', label: 'Mas de 1.5 Goles', marketType: 'GOLES', probability: 75, odds: 1.3,
  leagueId: 'PL', homeTeamId: 1, awayTeamId: 2, settle: { kind: 'GOALS_TOTAL', side: 'OVER', line: 1.5 }, ...over,
});

test('validacion: rechaza montos, cuotas y selecciones fuera de rango', () => {
  assert.ok(B.validateBetInput({ stake: 0, odds: 2, legs: [leg()] }).error);
  assert.ok(B.validateBetInput({ stake: 10, odds: 1, legs: [leg()] }).error);
  assert.ok(B.validateBetInput({ stake: 10, odds: 2, legs: [] }).error);
  assert.ok(B.validateBetInput({ stake: 10, odds: 2, legs: Array(13).fill(leg()) }).error);
  assert.ok(B.validateBetInput({ stake: 10, odds: 2, legs: [{ label: '' }] }).error);
  assert.ok(B.validateBetInput({ stake: 'diez', odds: 2, legs: [leg()] }).error);
});

test('validacion: limpia datos raros y marca si se puede resolver sola', () => {
  const ok = B.validateBetInput({
    stake: 10.456, odds: 2.5, legs: [leg({ settle: { kind: 'GOALS_TOTAL', side: 'OVER', line: 1.5, evil: '<script>' } })],
  });
  assert.equal(ok.bet.stake, 10.46);
  assert.equal(ok.bet.legs[0].auto, true);
  assert.equal('evil' in ok.bet.legs[0].settle, false);
  const manual = B.validateBetInput({ stake: 5, odds: 2, legs: [leg({ settle: { kind: 'CORNERS' }, marketType: 'CORNERS' })] });
  assert.equal(manual.bet.legs[0].auto, false); // mercado no verificable
  assert.equal(manual.bet.legs[0].settle, null);
});

test('estado: una combinada pierde si cualquier seleccion pierde', () => {
  assert.equal(B.computeStatus([{ result: true }, { result: false }, { result: null, auto: true }]).status, 'LOST');
  assert.equal(B.computeStatus([{ result: true }, { result: true }]).status, 'WON');
  assert.equal(B.computeStatus([{ result: true }, { result: null, auto: true }]).status, 'PENDING');
  assert.equal(B.computeStatus([{ result: true }, { result: null, auto: false }]).needsManual, true);
  assert.equal(B.computeStatus([{ result: 'void' }]).status, 'VOID');
  assert.equal(B.computeStatus([{ result: true }, { result: 'void' }]).needsManual, true);
});

test('pagos: gana = stake*cuota, pierde = 0, devuelta = stake', () => {
  const b = { stake: 10, odds: 2.5 };
  assert.equal(B.payoutFor(b, 'WON'), 25);
  assert.equal(B.payoutFor(b, 'LOST'), 0);
  assert.equal(B.payoutFor(b, 'VOID'), 10);
  assert.equal(B.payoutFor(b, 'WON', 21.5), 21.5);
  assert.equal(B.payoutFor(b, 'PENDING'), null);
});

const settledBet = (stake, odds, status, at, legs = 1, marketType = 'GOLES') => ({
  stake, odds, status, settledAt: at, payout: status === 'WON' ? stake * odds : status === 'VOID' ? stake : 0,
  legs: Array.from({ length: legs }, () => ({ marketType })),
});

test('resumen: yield, ganancia y banca con numeros simples', () => {
  const bets = [
    settledBet(10, 2, 'WON', '2026-11-01T10:00:00Z'),  // +10
    settledBet(10, 2, 'LOST', '2026-11-02T10:00:00Z'), // -10
    settledBet(10, 2, 'LOST', '2026-11-03T10:00:00Z'), // -10
    settledBet(10, 2, 'VOID', '2026-11-04T10:00:00Z'), // no cuenta
    { stake: 20, odds: 3, status: 'PENDING', legs: [{ marketType: 'GOLES' }] },
  ];
  const s = B.summarize(bets, { initialBankroll: 100 });
  assert.equal(s.liquidadas, 3);
  assert.equal(s.ganancia, -10);
  assert.equal(s.apostadoLiquidado, 30);
  assert.equal(s.yield, -33.33);
  assert.equal(s.bancaActual, 70); // 100 - 10 - 20 en juego
  assert.equal(s.pendientes, 1);
  assert.equal(s.devueltas, 1);
  assert.equal(s.racha.tipo, 'LOST');
  assert.equal(s.racha.cantidad, 2);
  assert.equal(s.maxDrawdown, 20); // pico +10, valle -10
  assert.equal(s.confianza, 'muy baja');
  assert.match(s.aviso, /100 apuestas/);
});

test('resumen: separa simples de combinadas y por mercado solo cuenta simples', () => {
  const s = B.summarize([
    settledBet(10, 2, 'WON', '2026-11-01T10:00:00Z', 1, 'GOLES'),
    settledBet(10, 4, 'LOST', '2026-11-02T10:00:00Z', 3),
  ]);
  assert.deepEqual(s.porTipo.map((t) => t.key).sort(), ['Combinada', 'Simple']);
  assert.equal(s.porMercado.length, 1);
  assert.equal(s.porMercado[0].key, 'GOLES');
});

test('resumen vacio no revienta', () => {
  const s = B.summarize([]);
  assert.equal(s.yield, null);
  assert.equal(s.hitRate, null);
  assert.equal(s.racha, null);
});

test('flujo completo: registrar, resolver sola contra resultado real, y consultar', () => {
  _resetForTests();
  const { bet } = B.addBet({ stake: 10, odds: 1.3, legs: [leg()] });
  assert.equal(bet.status, 'PENDING');
  const created = new Date(bet.createdAt).getTime();
  // Partido que empieza DESPUES de registrar la apuesta, terminado 2-1.
  const finished = [{
    homeTeam: { id: 1 }, awayTeam: { id: 2 }, utcDate: new Date(created + 3600e3).toISOString(),
    score: { fullTime: { home: 2, away: 1 } },
  }];
  const data = B.listBets().bets;
  const mine = data.find((b) => b.id === bet.id);
  B.applyResults([mine], { PL: finished });
  assert.equal(mine.status, 'WON');
  assert.equal(mine.payout, 13);
});

test('una apuesta hecha con el partido ya empezado NO se resuelve con ese resultado', () => {
  _resetForTests();
  const { bet } = B.addBet({ stake: 10, odds: 1.3, legs: [leg()] });
  const created = new Date(bet.createdAt).getTime();
  const started = [{
    homeTeam: { id: 1 }, awayTeam: { id: 2 }, utcDate: new Date(created - 3600e3).toISOString(),
    score: { fullTime: { home: 3, away: 0 } },
  }];
  const mine = B.listBets().bets.find((b) => b.id === bet.id);
  assert.equal(B.applyResults([mine], { PL: started }), 0);
  assert.equal(mine.status, 'PENDING');
});

test('combinada: pierde en cuanto falla una seleccion, aunque otras esten pendientes', () => {
  _resetForTests();
  const { bet } = B.addBet({
    stake: 10, odds: 3,
    legs: [leg(), leg({ homeTeamId: 3, awayTeamId: 4, label: 'Mas de 2.5', settle: { kind: 'GOALS_TOTAL', side: 'OVER', line: 2.5 } })],
  });
  const created = new Date(bet.createdAt).getTime();
  const mine = B.listBets().bets.find((b) => b.id === bet.id);
  B.applyResults([mine], { PL: [{
    homeTeam: { id: 1 }, awayTeam: { id: 2 }, utcDate: new Date(created + 3600e3).toISOString(),
    score: { fullTime: { home: 0, away: 0 } },
  }] });
  assert.equal(mine.status, 'LOST');
  assert.equal(mine.payout, 0);
});

test('resolver a mano y borrar', () => {
  _resetForTests();
  const { bet } = B.addBet({ stake: 10, odds: 2, legs: [leg({ settle: { kind: 'CORNERS' }, marketType: 'CORNERS' })] });
  assert.equal(B.resolveBet(bet.id, 'WON').bet.payout, 20);
  assert.equal(B.resolveBet(bet.id, 'WON', 17.5).bet.payout, 17.5);
  assert.ok(B.resolveBet(bet.id, 'XX').error);
  assert.equal(B.resolveBet('no-existe', 'WON').notFound, true);
  assert.equal(B.deleteBet(bet.id).ok, true);
  assert.equal(B.listBets().bets.some((b) => b.id === bet.id), false);
});

test('banca inicial: valida y guarda', () => {
  _resetForTests();
  assert.ok(B.setInitialBankroll(-5).error);
  assert.ok(B.setInitialBankroll('abc').error);
  assert.equal(B.setInitialBankroll(250.5).ok, true);
  assert.equal(B.listBets().settings.initialBankroll, 250.5);
});

/* ───────── seguridad de las rutas ───────── */
async function withServer(fn) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/bets', betsRouter);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}/api/bets`;
  try { await fn(base); } finally { server.close(); }
}

test('rutas: sin clave o con clave mala = 401; con la clave buena funciona', async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { headers: { 'x-bets-token': 'mala' } })).status, 401);
    const ok = await fetch(base, { headers: { 'x-bets-token': process.env.BETS_TOKEN } });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).success, true);
  });
});

test('rutas: crear apuesta por HTTP y rechazar datos invalidos con 400', async () => {
  await withServer(async (base) => {
    const h = { 'x-bets-token': process.env.BETS_TOKEN, 'content-type': 'application/json' };
    const bad = await fetch(base, { method: 'POST', headers: h, body: JSON.stringify({ stake: -1, odds: 2, legs: [leg()] }) });
    assert.equal(bad.status, 400);
    const good = await fetch(base, { method: 'POST', headers: h, body: JSON.stringify({ stake: 5, odds: 2, legs: [leg()] }) });
    assert.equal(good.status, 201);
  });
});

test('rutas: sin BETS_TOKEN configurado quedan desactivadas (503)', async () => {
  const saved = process.env.BETS_TOKEN;
  delete process.env.BETS_TOKEN;
  try {
    await withServer(async (base) => {
      assert.equal((await fetch(base, { headers: { 'x-bets-token': 'cualquiera' } })).status, 503);
    });
  } finally {
    process.env.BETS_TOKEN = saved;
  }
});

test('apuesta manual de otro deporte: se guarda con deporte y cuota de cierre', () => {
  _resetForTests();
  const v = B.validateBetInput({
    stake: 20, odds: 1.9, sport: 'baloncesto', closingOdds: 1.8,
    legs: [{ label: 'Lakers -3.5', matchLabel: 'Lakers vs Celtics', marketType: 'HANDICAP' }],
  });
  assert.equal(v.bet.sport, 'baloncesto');
  assert.equal(v.bet.closingOdds, 1.8);
  assert.equal(v.bet.legs[0].auto, false); // sin datos para resolver sola
  assert.equal(B.validateBetInput({ stake: 5, odds: 2, sport: 'curling', legs: [leg()] }).bet.sport, 'futbol');
  assert.ok(B.validateBetInput({ stake: 5, odds: 2, closingOdds: 0.5, legs: [leg()] }).error);
});

test('CLV: mejor cuota que el cierre es positivo, peor es negativo, sin dato es null', () => {
  assert.equal(Math.round(B.clvOf({ odds: 2.0, closingOdds: 1.8 }) * 1000) / 1000, 0.111);
  assert.ok(B.clvOf({ odds: 1.7, closingOdds: 1.9 }) < 0);
  assert.equal(B.clvOf({ odds: 2.0 }), null);
  assert.equal(B.clvOf({ odds: 2.0, closingOdds: null }), null);
});

test('resumen: CLV medio y desglose por deporte', () => {
  const bets = [
    { ...settledBet(10, 2.0, 'WON', '2026-11-01T10:00:00Z'), closingOdds: 1.8, sport: 'futbol' },
    { ...settledBet(10, 1.8, 'LOST', '2026-11-02T10:00:00Z'), closingOdds: 2.0, sport: 'baloncesto' },
    settledBet(10, 2.0, 'LOST', '2026-11-03T10:00:00Z'),
  ];
  const s = B.summarize(bets);
  assert.equal(s.clv.apuestas, 2);
  assert.equal(s.clv.positivas, 1);
  assert.equal(s.clv.medio, 0.56); // (+11.1% y -10%) / 2
  assert.deepEqual(s.porDeporte.map((d) => d.key).sort(), ['baloncesto', 'futbol']);
});

test('poner y quitar la cuota de cierre de una apuesta', () => {
  _resetForTests();
  const { bet } = B.addBet({ stake: 10, odds: 2, legs: [leg()] });
  assert.equal(B.setClosingOdds(bet.id, 1.85).bet.closingOdds, 1.85);
  assert.equal(B.setClosingOdds(bet.id, null).bet.closingOdds, null);
  assert.ok(B.setClosingOdds(bet.id, 0.9).error);
  assert.equal(B.setClosingOdds('nope', 2).notFound, true);
});
