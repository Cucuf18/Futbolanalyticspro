/**
 * SONDEO DE API-FOOTBALL (plan gratuito)
 * ------------------------------------------------------------------
 * Antes de construir lesiones, arbitros o cuotas reales hay que saber
 * QUE devuelve de verdad el plan gratis con tu clave: el plan limita las
 * temporadas disponibles y no se puede asumir que incluya la actual.
 *
 * Gasta pocas consultas (de las 100 diarias) y NO guarda nada: solo
 * informa que funciona y que no. La clave va en APIFOOTBALL_KEY (Render).
 */

const BASE = 'https://v3.football.api-sports.io';

async function call(key, endpoint, params = {}) {
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { 'x-apisports-key': key } });
  let body = {};
  try {
    body = await res.json();
  } catch {
    /* sin cuerpo */
  }
  // La API devuelve los fallos de plan/temporada dentro de "errors".
  const errors = Array.isArray(body.errors) ? body.errors : Object.values(body.errors || {});
  return { http: res.status, results: body.results ?? 0, errors, response: body.response || [] };
}

const summarize = (r, sample) => ({
  ok: r.http === 200 && r.errors.length === 0 && r.results > 0,
  http: r.http,
  results: r.results,
  errors: r.errors,
  sample: r.results > 0 ? sample : null,
});

export async function probeApiFootball(key, { league = 39, season = new Date().getFullYear() } = {}) {
  if (!key) return { configured: false, mensaje: 'Falta la variable APIFOOTBALL_KEY en el servidor.' };
  const out = { configured: true, liga: league, temporada: season, consultasUsadas: 0, pruebas: {} };
  const run = async (name, endpoint, params, pick, { alwaysSample = false } = {}) => {
    try {
      const r = await call(key, endpoint, params);
      out.consultasUsadas++;
      out.pruebas[name] = summarize(r, pick ? pick(r.response) : null);
      if (alwaysSample) {
        // /status devuelve un objeto y no siempre informa "results".
        out.pruebas[name].ok = r.http === 200 && r.errors.length === 0;
        out.pruebas[name].sample = pick ? pick(r.response) : null;
      }
      return r;
    } catch (err) {
      out.pruebas[name] = { ok: false, errors: [err.message] };
      return null;
    }
  };

  await run('cuenta', 'status', {}, (r) => ({
    plan: r?.subscription?.plan ?? r?.[0]?.subscription?.plan,
    usadasHoy: r?.requests?.current ?? r?.[0]?.requests?.current,
    limiteDia: r?.requests?.limit_day ?? r?.[0]?.requests?.limit_day,
  }), { alwaysSample: true });

  const fixtures = await run('proximos_partidos', 'fixtures', { league, season, next: 5 }, (r) =>
    r.slice(0, 2).map((f) => ({
      id: f.fixture?.id,
      partido: `${f.teams?.home?.name} vs ${f.teams?.away?.name}`,
      fecha: f.fixture?.date,
      arbitro: f.fixture?.referee ?? null,
    }))
  );
  const fixtureId = fixtures?.response?.[0]?.fixture?.id;

  await run('lesiones', 'injuries', { league, season }, (r) =>
    r.slice(0, 3).map((i) => ({ jugador: i.player?.name, equipo: i.team?.name, motivo: i.player?.reason }))
  );
  if (fixtureId) {
    await run('cuotas_reales', 'odds', { fixture: fixtureId }, (r) =>
      (r[0]?.bookmakers || []).slice(0, 5).map((b) => b.name)
    );
    await run('alineaciones', 'fixtures/lineups', { fixture: fixtureId }, (r) => r.length);
  }
  const p = out.pruebas;
  out.resumen = {
    temporadaActualDisponible: Boolean(p.proximos_partidos?.ok),
    arbitroEnPartidos: Boolean(p.proximos_partidos?.sample?.some((x) => x.arbitro)),
    lesiones: Boolean(p.lesiones?.ok),
    cuotasReales: Boolean(p.cuotas_reales?.ok),
    bookmakersConCuota: p.cuotas_reales?.sample || [],
  };
  return out;
}
