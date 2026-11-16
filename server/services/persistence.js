import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

/**
 * PERSISTENCIA
 * ------------------------------------------------------------------
 * En el plan gratuito de Render el disco es efimero: cada redeploy o
 * reinicio borra los archivos escritos en tiempo de ejecucion. Eso
 * destruia el historial de predicciones, que es justo lo que da
 * credibilidad a la pagina.
 *
 * - Con DATABASE_URL (Postgres: Neon, Supabase...) todo se guarda alli,
 *   en una tabla clave-valor `kv`.
 * - Sin DATABASE_URL se usan archivos JSON (desarrollo local).
 *
 * La lectura es SINCRONA desde una cache en memoria; initPersistence()
 * la rellena una sola vez al arrancar. Las escrituras a la base de datos
 * van en cola, una por clave, para que no se pisen entre si.
 */

const cache = new Map();
let pool = null;
const queues = new Map();

export function usingDatabase() {
  return pool !== null;
}

export async function initPersistence() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('[Persistencia] Sin DATABASE_URL: se usan archivos locales (se pierden en Render gratis).');
    return;
  }
  const { default: pg } = await import('pg');
  pool = new pg.Pool({
    connectionString: url,
    // Neon y Supabase exigen SSL.
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
    max: 3,
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kv (
      name TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  const { rows } = await pool.query('SELECT name, data FROM kv');
  for (const r of rows) cache.set(r.name, r.data);
  console.log(`[Persistencia] Postgres conectado (${rows.length} bloques cargados).`);
}

export function readBlob(name) {
  if (cache.has(name)) return cache.get(name);
  if (pool) return null;
  try {
    const file = path.join(DATA_DIR, `${name}.json`);
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      cache.set(name, data);
      return data;
    }
  } catch (err) {
    console.error(`[Persistencia] No se pudo leer ${name}:`, err.message);
  }
  return null;
}

export function writeBlob(name, data) {
  cache.set(name, data);
  if (!pool) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data), 'utf8');
    } catch (err) {
      console.error(`[Persistencia] No se pudo guardar ${name}:`, err.message);
    }
    return Promise.resolve();
  }
  const prev = queues.get(name) || Promise.resolve();
  const next = prev
    .then(() =>
      pool.query(
        `INSERT INTO kv (name, data, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [name, JSON.stringify(data)]
      )
    )
    .catch((err) => console.error(`[Persistencia] Fallo al guardar ${name} en Postgres:`, err.message));
  queues.set(name, next);
  return next;
}

/** Solo para tests: vacia la cache en memoria. */
export function _resetForTests() {
  cache.clear();
}
