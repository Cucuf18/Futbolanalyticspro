import { config } from '../config.js';

/**
 * DIAGNOSTICO DE football-data.org
 * ------------------------------------------------------------------
 * Lanza las mismas consultas que usa la pagina y devuelve, para cada una,
 * lo que RESPONDE la API (codigo, mensaje, cuantos partidos, cuota por
 * minuto restante). Sirve para saber con certeza por que un equipo se
 * queda "sin historial", en vez de adivinar. No guarda nada.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

export async function probeFootballData(teamId = 86, { spacingMs = 1200 } = {}) {
  if (!config.footballApiKey) return { configured: false, mensaje: 'Falta la clave de football-data.org en el servidor.' };
  const now = Date.now();
  const tests = [
    ['Tabla de La Liga (la que ya funciona)', '/competitions/PD/standings'],
    ['Equipo: ultimos 5 partidos terminados', `/teams/${teamId}/matches?status=FINISHED&limit=5`],
    ['Equipo: 420 dias, limite 60 (el valor antiguo)', `/teams/${teamId}/matches?status=FINISHED&dateFrom=${day(now - 420 * 86400000)}&dateTo=${day(now)}&limit=60`],
    ['Equipo: 720 dias, limite 100 (el del H2H)', `/teams/${teamId}/matches?status=FINISHED&dateFrom=${day(now - 720 * 86400000)}&dateTo=${day(now)}&limit=100`],
    ['Equipo: 760 dias, limite 100 (el del modelo nuevo)', `/teams/${teamId}/matches?status=FINISHED&dateFrom=${day(now - 760 * 86400000)}&dateTo=${day(now)}&limit=100`],
  ];
  const out = { configured: true, equipo: teamId, pruebas: [] };
  for (const [name, path] of tests) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${config.footballApiBaseUrl}${path}`, { headers: { 'X-Auth-Token': config.footballApiKey } });
      let body = {};
      try { body = await res.json(); } catch { /* sin cuerpo */ }
      out.pruebas.push({
        prueba: name,
        codigo: res.status,
        ok: res.ok,
        partidos: Array.isArray(body.matches) ? body.matches.length : null,
        mensaje: body.message || body.error || null,
        consultasRestantesMinuto: res.headers.get('x-requests-available-minute'),
        ms: Date.now() - t0,
      });
    } catch (err) {
      out.pruebas.push({ prueba: name, ok: false, mensaje: `error de red: ${err.message}` });
    }
    await sleep(spacingMs);
  }
  const hist = out.pruebas.filter((p) => p.prueba.startsWith('Equipo'));
  out.resumen = {
    historialFunciona: hist.some((p) => p.ok && p.partidos > 0),
    cualesFuncionan: hist.filter((p) => p.ok && p.partidos > 0).map((p) => p.prueba),
    cualesFallan: hist.filter((p) => !p.ok || !(p.partidos > 0)).map((p) => `${p.prueba} -> ${p.codigo ?? 'sin respuesta'} ${p.mensaje ?? ''}`.trim()),
  };
  return out;
}
