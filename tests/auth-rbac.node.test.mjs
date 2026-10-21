import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
test('authentication migration persists users and expiring revocable sessions', async () => {
  const sql = await read('../db/migrations/0005_authentication_rbac.sql');
  assert.match(sql, /CREATE TABLE app_users/); assert.match(sql, /password_hash text NOT NULL/);
  assert.match(sql, /CREATE TABLE app_sessions/); assert.match(sql, /ON DELETE CASCADE/); assert.match(sql, /expires_at timestamptz NOT NULL/);
});
test('session cookies are HttpOnly, SameSite Lax, and secure in production', async () => {
  const login = await read('../app/api/auth/login/route.ts');
  assert.match(login, /httpOnly: true/); assert.match(login, /sameSite: 'lax'/); assert.match(login, /secure: process\.env\.NODE_ENV === 'production'/);
  assert.match(login, /randomBytes\(32\)/); assert.match(login, /hashSessionToken\(token\)/);
});
test('protected APIs verify session from database, not only cookie presence', async () => {
  const guard = await read('../lib/auth/api-guard.ts'); const session = await read('../lib/auth/session.ts');
  assert.match(guard, /getSessionUser/); assert.match(session, /eq\(appSessions\.tokenHash, hashSessionToken\(token\)\)/);
  assert.match(guard, /Insufficient permissions/); assert.match(guard, /401/); assert.match(guard, /403/);
});
test('API audit actors are no longer accepted from x-actor-id', async () => {
  for (const path of ['../app/api/orders/route.ts','../app/api/patients/route.ts','../app/api/specimens/route.ts','../app/api/orders/[id]/accession/route.ts','../app/api/specimens/[id]/transition/route.ts']) {
    const source = await read(path); assert.doesNotMatch(source, /x-actor-id/); assert.match(source, /auth\.user\.id/);
  }
});
test('seed never overwrites an existing administrator and does not exit before bootstrap', async () => {
  const seed = await read('../db/seed.ts'); assert.match(seed, /onConflictDoNothing\(\{ target: appUsers\.email \}\)/);
  assert.ok(seed.indexOf('Bootstrap administrator ensured') < seed.lastIndexOf('process.exit(0)'));
});
