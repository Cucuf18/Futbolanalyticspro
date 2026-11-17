import test from 'node:test';
import assert from 'node:assert/strict';

// Con API key pero sin conexion util, el H2H debe quedar VACIO y marcado
// como no disponible: nunca partidos inventados. (Antes una variable sin
// definir hacia caer siempre en generateH2H, con goles al azar.)
process.env.FOOTBALL_API_KEY = 'test-key';
process.env.DATA_DIR = (await import('fs')).mkdtempSync((await import('path')).join((await import('os')).tmpdir(), 'fap-h2h-'));
delete process.env.DATABASE_URL;
globalThis.fetch = async () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) });

const { getH2HHistory, emptyH2H } = await import('../server/services/sportsApi.js');

test('con API key y sin datos reales, el H2H es vacio y no aleatorio', async () => {
  const h = await getH2HHistory(1, 2, 'PL');
  assert.deepEqual(h.matches, []);
  assert.equal(h.source, 'unavailable');
  assert.equal(h.synthetic, false);
  assert.equal(h.summary.totalMatches, 0);
});

test('emptyH2H mantiene la forma que espera el frontend', () => {
  const h = emptyH2H({ id: 1, name: 'A', shortName: 'A' }, { id: 2, name: 'B', shortName: 'B' });
  assert.equal(h.homeTeam.id, 1);
  assert.equal(h.awayTeam.id, 2);
  assert.equal(h.summary.homeWinPct, 0);
});
