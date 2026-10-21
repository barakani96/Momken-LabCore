import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('standalone database entrypoint loads .env.local and .env before creating the pool', async () => {
  const db = await read('../db/index.ts');
  assert.match(db, /from 'dotenv'/);
  assert.match(db, /loadEnv\(\{ path: \['\.env\.local', '\.env'\] \}\)/);
  assert.ok(db.indexOf('loadEnv(') < db.indexOf('export const db = drizzle(getPool()'));
});

test('Drizzle CLI config loads the same environment files', async () => {
  const config = await read('../drizzle.config.ts');
  assert.match(config, /loadEnv\(\{ path: \['\.env\.local', '\.env'\] \}\)/);
});

test('seed env check does not print database credentials', async () => {
  const script = await read('../scripts/check-database-env.ts');
  assert.match(script, /DATABASE_URL is missing/);
  assert.match(script, /Credentials are not printed/);
  assert.doesNotMatch(script, /console\.log\(process\.env\.DATABASE_URL/);
});

test('specimen labels request validated Code 128 SVG and print it', async () => {
  const route = await read('../app/api/barcode/route.ts');
  const worklist = await read('../components/worklist.tsx');
  assert.match(route, /bcid: 'code128'/);
  assert.match(route, /text\.length > 40/);
  assert.match(route, /image\/svg\+xml/);
  assert.match(worklist, /api\/barcode\?text=/);
  assert.match(worklist, /\$\{barcodeSvg\}/);
});
