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

test('el historial dice POR QUE fallo (codigo de la API) y expone los partidos crudos', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 403, headers: headers(), json: async () => ({ message: 'restringido' }) });
  try {
    const bad = await getTeamHistory(901);
    assert.equal(bad.known, false);
    assert.equal(bad.failure, '403');
  } finally {
    globalThis.fetch = saved;
  }
  globalThis.fetch = async () => ({ ok: true, status: 200, headers: headers(), json: async () => ({ matches: [] }) });
  try {
    const empty = await getTeamHistory(902);
    assert.equal(empty.known, false);
    assert.equal(empty.failure, 'sin-partidos');
  } finally {
    globalThis.fetch = saved;
  }
  globalThis.fetch = async () => ({ ok: true, status: 200, headers: headers(), json: async () => ({ matches: [finished(903, 1, 2, 0, '2026-10-01T15:00:00Z')] }) });
  try {
    const good = await getTeamHistory(903);
    assert.equal(good.known, true);
    assert.equal(good.rawMatches.length, 1); // el H2H reutiliza esto en vez de pedirlo otra vez
    assert.equal(good.failure, undefined);
  } finally {
    globalThis.fetch = saved;
  }
});

test('reasonText explica cada codigo en palabras', async () => {
  const { reasonText } = await import('../server/services/sportsApi.js');
  assert.match(reasonText('429'), /10 consultas por minuto/);
  assert.match(reasonText('403'), /restringido/);
  assert.match(reasonText('sin-partidos'), /sin partidos/);
  assert.match(reasonText(undefined), /sin respuesta/);
  assert.match(reasonText('500'), /500/);
});

test('el diagnostico de football-data.org informa codigo, partidos y cuales funcionan', async () => {
  const { probeFootballData } = await import('../server/services/footballDataProbe.js');
  const saved = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('limit=100') && u.includes('dateFrom')) {
      // la consulta de 760 dias falla, la de 720 funciona
      const days = (Date.now() - new Date(u.match(/dateFrom=([\d-]+)/)[1]).getTime()) / 86400000;
      if (days > 740) return { ok: false, status: 400, headers: headers('0', '3'), json: async () => ({ message: 'rango demasiado amplio' }) };
    }
    return { ok: true, status: 200, headers: headers('0', '7'), json: async () => ({ matches: u.includes('standings') ? undefined : [{ id: 1 }, { id: 2 }] }) };
  };
  try {
    const r = await probeFootballData(86, { spacingMs: 0 });
    assert.equal(r.pruebas.length, 5);
    assert.equal(r.resumen.historialFunciona, true);
    assert.equal(r.resumen.cualesFallan.length, 1);
    assert.match(r.resumen.cualesFallan[0], /760 dias.*400.*rango demasiado amplio/);
    assert.equal(r.pruebas[1].partidos, 2);
  } finally {
    globalThis.fetch = saved;
  }
});

test('si la API rechaza el rango largo (400), el historial reintenta con rangos mas cortos', async () => {
  const saved = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    const days = Math.round((Date.now() - new Date(u.match(/dateFrom=([\d-]+)/)[1]).getTime()) / 86400000);
    seen.push(days);
    if (days > 740) return { ok: false, status: 400, headers: headers(), json: async () => ({ message: 'rango' }) };
    return { ok: true, status: 200, headers: headers(), json: async () => ({ matches: [finished(950, 1, 1, 0, '2026-10-01T15:00:00Z')] }) };
  };
  try {
    const h = await getTeamHistory(950);
    assert.equal(h.known, true);
    assert.equal(seen.length, 2); // 760 falla, 720 funciona
    assert.ok(seen[0] > 740 && seen[1] < 740);
  } finally {
    globalThis.fetch = saved;
  }
});

test('con 429 o 403 NO se prueban otros rangos (no ayudaria y gastaria cupo)', async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 403, headers: headers(), json: async () => ({}) }; };
  try {
    const h = await getTeamHistory(951);
    assert.equal(h.known, false);
    assert.equal(calls, 1);
    assert.equal(h.failure, '403');
  } finally {
    globalThis.fetch = saved;
  }
});
