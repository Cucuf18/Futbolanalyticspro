import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import path from 'path';
import fs from 'fs';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fap-auto-'));
delete process.env.DATABASE_URL;
delete process.env.FOOTBALL_API_KEY;

const { runAutoRegister } = await import('../server/services/autoRegister.js');

test('sin API key el registro automatico se salta sin romper nada', async () => {
  const r = await runAutoRegister();
  assert.ok(r.skipped);
});
