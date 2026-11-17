import test from 'node:test';
import assert from 'node:assert/strict';
import { probeApiFootball } from '../server/services/apiFootballProbe.js';
import { normalizeDatabaseUrl } from '../server/services/persistence.js';

test('sin clave el sondeo avisa en vez de fallar', async () => {
  const r = await probeApiFootball('');
  assert.equal(r.configured, false);
});

test('el sondeo interpreta una cuenta gratis SIN acceso a la temporada actual', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    const body = u.includes('/status')
      ? { errors: [], results: 1, response: { subscription: { plan: 'Free' }, requests: { current: 3, limit_day: 100 } } }
      : { errors: { plan: 'Free plans do not have access to this season, try from 2022 to 2024.' }, results: 0, response: [] };
    return { status: 200, json: async () => body };
  };
  try {
    const r = await probeApiFootball('k', { season: 2026 });
    assert.equal(r.pruebas.cuenta.sample.plan, 'Free');
    assert.equal(r.pruebas.cuenta.sample.limiteDia, 100);
    assert.equal(r.resumen.temporadaActualDisponible, false);
    assert.equal(r.resumen.lesiones, false);
    assert.match(r.pruebas.proximos_partidos.errors[0], /season/);
  } finally {
    globalThis.fetch = saved;
  }
});

test('el sondeo detecta arbitro, lesiones y cuotas cuando el plan los da', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    let response = [];
    if (u.includes('/status')) response = { subscription: { plan: 'Free' }, requests: { current: 1, limit_day: 100 } };
    else if (u.includes('/fixtures/lineups')) response = [{}];
    else if (u.includes('/fixtures')) response = [{ fixture: { id: 7, date: 'x', referee: 'M. Oliver' }, teams: { home: { name: 'A' }, away: { name: 'B' } } }];
    else if (u.includes('/injuries')) response = [{ player: { name: 'J', reason: 'Knee' }, team: { name: 'A' } }];
    else if (u.includes('/odds')) response = [{ bookmakers: [{ name: 'Bet365' }] }];
    return { status: 200, json: async () => ({ errors: [], results: Array.isArray(response) ? response.length : 1, response }) };
  };
  try {
    const r = await probeApiFootball('k', { season: 2026 });
    assert.equal(r.resumen.temporadaActualDisponible, true);
    assert.equal(r.resumen.arbitroEnPartidos, true);
    assert.equal(r.resumen.lesiones, true);
    assert.equal(r.resumen.cuotasReales, true);
    assert.deepEqual(r.resumen.bookmakersConCuota, ['Bet365']);
  } finally {
    globalThis.fetch = saved;
  }
});

test('normalizeDatabaseUrl quita sslmode y conserva el resto', () => {
  const out = normalizeDatabaseUrl('postgresql://u:p@ep-x.aws.neon.tech/neondb?sslmode=require&channel_binding=require');
  assert.equal(out.includes('sslmode'), false);
  assert.ok(out.includes('channel_binding=require'));
  assert.ok(out.startsWith('postgresql://u:p@ep-x.aws.neon.tech/neondb'));
  assert.equal(normalizeDatabaseUrl('no-es-una-url'), 'no-es-una-url');
});
