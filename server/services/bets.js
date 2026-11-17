import crypto from 'crypto';
import { fetchFromApi } from './footballDataClient.js';
import { readBlob, writeBlob } from './persistence.js';
import { gradePick, findMatchForPrediction, wilsonInterval, confidenceLevel } from './backtest.js';

/**
 * MIS APUESTAS REALES
 * ------------------------------------------------------------------
 * Libro de apuestas guardado en el servidor (Postgres en Render). Mide lo
 * que de verdad importa: si ganas DINERO con la cuota real de tu casa.
 * No toca el modelo ni sus pesos: es solo contabilidad.
 *
 * Cada apuesta es simple (1 seleccion) o combinada (varias). Las
 * selecciones se resuelven solas contra el resultado real cuando el
 * mercado es verificable (1X2, goles, BTTS, handicap...). Corners y
 * tarjetas no se pueden verificar con las APIs gratuitas: esas se
 * resuelven a mano.
 */

const MAX_BETS = 5000;
const KINDS = new Set(['RESULT', 'DOUBLE_CHANCE', 'HANDICAP', 'GOALS_TOTAL', 'TEAM_SCORES', 'TEAM_GOALS', 'BTTS']);

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round2 = (n) => Math.round(n * 100) / 100;

/* ─────────────── validacion ─────────────── */

function cleanSettle(s) {
  if (!s || typeof s !== 'object' || !KINDS.has(s.kind)) return null;
  const out = { kind: s.kind };
  if (typeof s.side === 'string') out.side = s.side.slice(0, 8);
  if (num(s.line) !== null) out.line = s.line;
  if (typeof s.over === 'boolean') out.over = s.over;
  return out;
}

export function validateBetInput(body) {
  const stake = num(body?.stake);
  const odds = num(body?.odds);
  if (stake === null || stake < 0.1 || stake > 1e6) return { error: 'El monto debe estar entre 0.10 y 1,000,000.' };
  if (odds === null || odds < 1.01 || odds > 1000) return { error: 'La cuota total debe estar entre 1.01 y 1000.' };
  if (!Array.isArray(body.legs) || body.legs.length < 1 || body.legs.length > 12) {
    return { error: 'Una apuesta lleva entre 1 y 12 selecciones.' };
  }
  const legs = [];
  for (const l of body.legs) {
    const label = str(l?.label, 140);
    if (!label) return { error: 'Cada seleccion necesita una descripcion.' };
    const settle = cleanSettle(l.settle);
    const hid = Number.isInteger(l.homeTeamId) ? l.homeTeamId : null;
    const aid = Number.isInteger(l.awayTeamId) ? l.awayTeamId : null;
    const leagueId = str(l.leagueId, 10);
    legs.push({
      matchLabel: str(l.matchLabel, 140),
      label,
      marketType: str(l.marketType, 30) || 'OTRO',
      probability: num(l.probability) !== null ? Math.min(100, Math.max(0, l.probability)) : null,
      odds: num(l.odds) !== null && l.odds > 1 ? l.odds : null,
      leagueId,
      homeTeamId: hid,
      awayTeamId: aid,
      settle,
      // Solo se puede resolver sola si se conoce todo lo necesario.
      auto: Boolean(settle && hid && aid && leagueId),
      result: null, // true | false | 'void' | null (sin resolver)
    });
  }
  return { bet: { stake: round2(stake), odds: round2(odds), legs, note: str(body.note, 200) } };
}

/* ─────────────── estado y pagos ─────────────── */

/** Estado de la apuesta segun el resultado de cada seleccion. */
export function computeStatus(legs) {
  if (legs.some((l) => l.result === false)) return { status: 'LOST', needsManual: false };
  if (legs.every((l) => l.result === true)) return { status: 'WON', needsManual: false };
  if (legs.some((l) => l.result === null)) {
    // Si lo unico que falta son selecciones que no se verifican solas,
    // se avisa para que las marques a mano.
    const pendingAuto = legs.some((l) => l.result === null && l.auto);
    return { status: 'PENDING', needsManual: !pendingAuto };
  }
  // Sin perdidas, sin pendientes, pero alguna "void" (push): la casa
  // recalcula la cuota, asi que lo confirmas tu.
  if (legs.every((l) => l.result === 'void')) return { status: 'VOID', needsManual: false };
  return { status: 'PENDING', needsManual: true };
}

export function payoutFor(bet, status, customPayout = null) {
  if (status === 'LOST') return 0;
  if (status === 'VOID') return bet.stake;
  if (status === 'WON') return customPayout !== null ? round2(customPayout) : round2(bet.stake * bet.odds);
  return null;
}

function finalize(bet, status, customPayout = null) {
  bet.status = status;
  bet.payout = payoutFor(bet, status, customPayout);
  bet.settledAt = new Date().toISOString();
  bet.needsManual = false;
}

/* ─────────────── resumen ─────────────── */

export function summarize(bets, settings = {}) {
  const initial = num(settings.initialBankroll) ?? 0;
  const settled = bets.filter((b) => ['WON', 'LOST', 'VOID'].includes(b.status));
  const pending = bets.filter((b) => b.status === 'PENDING');
  const graded = settled.filter((b) => b.status !== 'VOID'); // las devueltas no cuentan para el yield

  const staked = graded.reduce((a, b) => a + b.stake, 0);
  const returned = graded.reduce((a, b) => a + (b.payout || 0), 0);
  const profit = round2(returned - staked);
  const won = graded.filter((b) => b.status === 'WON').length;
  const pendingStake = round2(pending.reduce((a, b) => a + b.stake, 0));

  // Peor racha de perdidas en dinero (de pico a valle) y racha actual.
  const ordered = [...graded].sort((a, b) => new Date(a.settledAt) - new Date(b.settledAt));
  let run = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const b of ordered) {
    run += (b.payout || 0) - b.stake;
    peak = Math.max(peak, run);
    maxDrawdown = Math.max(maxDrawdown, peak - run);
  }
  let streak = 0;
  let streakType = null;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (streakType === null) streakType = ordered[i].status;
    if (ordered[i].status !== streakType) break;
    streak++;
  }

  const group = (list, keyFn) => {
    const map = new Map();
    for (const b of list) {
      const k = keyFn(b);
      const g = map.get(k) || { key: k, apuestas: 0, ganadas: 0, apostado: 0, ganancia: 0 };
      g.apuestas++;
      if (b.status === 'WON') g.ganadas++;
      g.apostado += b.stake;
      g.ganancia += (b.payout || 0) - b.stake;
      map.set(k, g);
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        apostado: round2(g.apostado),
        ganancia: round2(g.ganancia),
        yield: g.apostado > 0 ? round2((g.ganancia / g.apostado) * 100) : null,
      }))
      .sort((a, b) => b.apuestas - a.apuestas);
  };

  const n = graded.length;
  return {
    bancaInicial: initial,
    // Banca disponible = inicial + ganancia - lo que esta en juego.
    bancaActual: round2(initial + profit - pendingStake),
    ganancia: profit,
    apostadoLiquidado: round2(staked),
    yield: staked > 0 ? round2((profit / staked) * 100) : null,
    liquidadas: n,
    ganadas: won,
    perdidas: n - won,
    devueltas: settled.length - n,
    pendientes: pending.length,
    montoPendiente: pendingStake,
    porRevisar: pending.filter((b) => b.needsManual).length,
    hitRate: n ? round2((won / n) * 100) : null,
    ic95: wilsonInterval(won, n),
    maxDrawdown: round2(maxDrawdown),
    racha: streakType ? { tipo: streakType, cantidad: streak } : null,
    porTipo: group(graded, (b) => (b.legs.length === 1 ? 'Simple' : 'Combinada')),
    // Por mercado solo cuentan las simples: en una combinada no se sabe
    // a que mercado atribuir el resultado.
    porMercado: group(graded.filter((b) => b.legs.length === 1), (b) => b.legs[0].marketType),
    confianza: confidenceLevel(n),
    aviso:
      n < 100
        ? 'Con menos de 100 apuestas liquidadas el yield no significa casi nada: unas pocas cuotas altas que entren o fallen lo cambian por completo. Es normal ver porcentajes muy buenos o muy malos al principio.'
        : n < 300
          ? 'Todavia es una muestra corta. El yield de apuestas necesita cientos de apuestas para ser fiable.'
          : null,
  };
}

/* ─────────────── almacenamiento ─────────────── */

function load() {
  const saved = readBlob('bets');
  return saved && Array.isArray(saved.bets) ? saved : { bets: [] };
}
function save(data) {
  data.bets = data.bets.slice(-MAX_BETS);
  return writeBlob('bets', data);
}
export function getSettings() {
  return { initialBankroll: 0, ...(readBlob('betSettings') || {}) };
}
export function setInitialBankroll(value) {
  const v = num(value);
  if (v === null || v < 0 || v > 1e9) return { error: 'La banca inicial debe ser un numero entre 0 y 1,000,000,000.' };
  writeBlob('betSettings', { ...getSettings(), initialBankroll: round2(v) });
  return { ok: true };
}

export function listBets() {
  const bets = [...load().bets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { bets, summary: summarize(bets, getSettings()), settings: getSettings() };
}

export function addBet(body) {
  const v = validateBetInput(body);
  if (v.error) return v;
  const data = load();
  const bet = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...v.bet,
    status: 'PENDING',
    payout: null,
    settledAt: null,
    needsManual: !v.bet.legs.some((l) => l.auto),
  };
  data.bets.push(bet);
  save(data);
  return { bet };
}

export function resolveBet(id, status, customPayout = null) {
  if (!['WON', 'LOST', 'VOID', 'PENDING'].includes(status)) return { error: 'Estado no valido.' };
  const data = load();
  const bet = data.bets.find((b) => b.id === id);
  if (!bet) return { error: 'No existe esa apuesta.', notFound: true };
  if (status === 'PENDING') {
    bet.status = 'PENDING';
    bet.payout = null;
    bet.settledAt = null;
    bet.needsManual = false;
  } else {
    const p = customPayout === null ? null : num(customPayout);
    if (customPayout !== null && (p === null || p < 0 || p > 1e9)) return { error: 'El cobro debe ser un numero valido.' };
    finalize(bet, status, p);
  }
  save(data);
  return { bet };
}

export function deleteBet(id) {
  const data = load();
  const before = data.bets.length;
  data.bets = data.bets.filter((b) => b.id !== id);
  if (data.bets.length === before) return { error: 'No existe esa apuesta.', notFound: true };
  save(data);
  return { ok: true };
}

/* ─────────────── resolucion automatica ─────────────── */

/** Aplica resultados reales a las selecciones. `matchesByLeague`: {liga: [partidos terminados]}. */
export function applyResults(bets, matchesByLeague) {
  let changed = 0;
  for (const bet of bets) {
    if (bet.status !== 'PENDING') continue;
    for (const leg of bet.legs) {
      if (leg.result !== null || !leg.auto) continue;
      const match = findMatchForPrediction(
        { homeTeamId: leg.homeTeamId, awayTeamId: leg.awayTeamId, createdAt: bet.createdAt },
        matchesByLeague[leg.leagueId] || []
      );
      const hg = match?.score?.fullTime?.home;
      const ag = match?.score?.fullTime?.away;
      if (typeof hg !== 'number' || typeof ag !== 'number') continue;
      const hit = gradePick(leg.settle, hg, ag);
      leg.result = hit === null ? 'void' : hit;
      leg.finalScore = `${hg}-${ag}`;
      changed++;
    }
    const { status, needsManual } = computeStatus(bet.legs);
    bet.needsManual = needsManual;
    if (status !== 'PENDING') finalize(bet, status);
  }
  return changed;
}

export async function settleBets() {
  const data = load();
  const pending = data.bets.filter((b) => b.status === 'PENDING');
  const leagues = [
    ...new Set(pending.flatMap((b) => b.legs.filter((l) => l.result === null && l.auto).map((l) => l.leagueId))),
  ];
  if (leagues.length === 0) return { checked: pending.length, changed: 0 };

  const now = Date.now();
  const dateFrom = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
  const dateTo = new Date(now + 86400000).toISOString().slice(0, 10);
  const matchesByLeague = {};
  for (const leagueId of leagues) {
    const res = await fetchFromApi(`/competitions/${leagueId}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`);
    matchesByLeague[leagueId] = res?.matches || [];
  }
  const changed = applyResults(data.bets, matchesByLeague);
  if (changed > 0) save(data);
  return { checked: pending.length, changed };
}
