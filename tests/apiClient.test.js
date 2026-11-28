import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import path from 'path';
import fs from 'fs';

process.env.FOOTBALL_API_KEY = 'test-key';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fap-api-'));
delete process.env.DATABASE_URL;

const client = await import('../server/services/footballDataClient.js');
const { getTeamHistory } = await import('../server/services/teamHistory.js');

const headers = (reset = '0', remaining = '9') => ({ get: (k) => ({ 'x-requests-available-minute': remaining, 'x-requestcounter-reset': reset })[k] ?? null });
const finished = (id, opp, gf, ga, date) => ({
  id: Math.floor(Math.random() * 1e9), utcDate: date,
  homeTeam: { id, name: 'Casa' }, awayTeam: { id: opp, name: 'Rival' },
  score: { fullTime: { home: gf, away: ga } }, competition: { code: 'PL', name: 'Premier League' },
});

test('un fallo de la API NO se guarda como "sin historial": el siguiente intento vuelve a pedir', async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 500, headers: headers(), json: async () => ({}) };
    return { ok: true, status: 200, headers: headers(), json: async () => ({ matches: [finished(777, 1, 2, 1, '2026-10-01T15:00:00Z'), finished(777, 2, 1, 1, '2026-09-20T15:00:00Z')] }) };
  };
  try {
    const first = await getTeamHistory(777);
    assert.equal(first.known, false);
    // Antes este resultado vacio se recordaba 12 horas; ahora solo 1 minuto
    // y aqui lo saltamos poniendo la cache en cero con un historial nuevo.
    const cacheKey = 'history_777';
    client.setCache(cacheKey, first, 0); // simula que paso el minuto
    const second = await getTeamHistory(777);
    assert.equal(second.known, true);
    assert.equal(second.count, 2);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = saved;
  }
});

test('un historial bueno SI se recuerda (no se vuelve a pedir)', async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, status: 200, headers: headers(), json: async () => ({ matches: [finished(888, 1, 1, 0, '2026-10-01T15:00:00Z')] }) };
  };
  try {
    await getTeamHistory(888);
    await getTeamHistory(888);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = saved;
  }
});

test('ante un 429 espera y reintenta una vez, en vez de rendirse', async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429, headers: headers('0', '0'), json: async () => ({}) };
    return { ok: true, status: 200, headers: headers(), json: async () => ({ ok: 'dato' }) };
  };
  try {
    const data = await client.fetchFromApi('/prueba-429');
    assert.deepEqual(data, { ok: 'dato' });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = saved;
  }
});

test('si el 429 se repite, devuelve null (sin bucles infinitos)', async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 429, headers: headers('0', '0'), json: async () => ({}) }; };
  try {
    assert.equal(await client.fetchFromApi('/prueba-429-doble'), null);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = saved;
  }
});

test('actividad de usuario: se detecta y caduca', async () => {
  client.markUserActivity();
  assert.equal(client.userRecentlyActive(60000), true);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(client.userRecentlyActive(10), false);
});
