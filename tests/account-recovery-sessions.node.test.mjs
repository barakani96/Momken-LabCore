import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('password recovery never stores the raw reset token', () => {
  const source = read('../app/api/auth/password/forgot/route.ts');
  assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /sha256\(token\)/);
  assert.match(source, /expiresAt: new Date\(Date\.now\(\) \+ 30 \* 60 \* 1000\)/);
  assert.match(source, /GENERIC/);
});
test('password reset consumes an unexpired unused token atomically', () => {
  const source = read('../app/api/auth/password/reset/route.ts');
  assert.match(source, /used_at IS NULL AND expires_at > now\(\)/);
  assert.match(source, /WHERE token_hash = \$\{tokenHash\}/);
  assert.match(source, /tx\.delete\(appSessions\)/);
  assert.match(source, /PASSWORD_RESET/);
});
test('password change verifies the current password and rotates the current session', () => {
  const source = read('../app/api/auth/password/change/route.ts');
  assert.match(source, /verifyPassword\(parsed\.data\.currentPassword/);
  assert.match(source, /currentSessionRotated: true/);
  assert.match(source, /response\.cookies\.set\(SESSION_COOKIE, nextToken/);
});
test('session APIs scope listing and revocation to the authenticated user', () => {
  const list = read('../app/api/auth/sessions/route.ts');
  const revoke = read('../app/api/auth/sessions/[id]/route.ts');
  assert.match(list, /eq\(appSessions\.userId, auth\.user\.id\)/);
  assert.match(list, /rows\.map\(\(\{ tokenHash, \.\.\.row \}\)/);
  assert.match(revoke, /eq\(appSessions\.userId, auth\.user\.id\)/);
  assert.match(revoke, /SESSION_REVOKED/);
});
test('account security UI links password recovery and active session management', () => {
  assert.match(read('../app/login/page.tsx'), /forgot-password/);
  assert.match(read('../middleware.ts'), /'\/forgot-password'/);
  assert.match(read('../middleware.ts'), /'\/api\/auth\/password\/reset'/);
  assert.match(read('../app/security/page.tsx'), /AccountSessionWorkbench/);
  assert.match(read('../app/forgot-password/page.tsx'), /\/api\/auth\/password\/forgot/);
  assert.match(read('../app/reset-password/page.tsx'), /\/api\/auth\/password\/reset/);
});
test('password recovery schema and migration are journaled', () => {
  const schema = read('../db/schema.ts');
  const migration = read('../db/migrations/0017_password_recovery_session_management.sql');
  const journal = JSON.parse(read('../db/migrations/meta/_journal.json'));
  assert.match(schema, /export const appPasswordRecoveryTokens/);
  assert.match(schema, /passwordChangedAt: timestamp\('password_changed_at'/);
  assert.match(migration, /password_changed_at/);
  assert.ok(journal.entries.some(entry => entry.tag === '0017_password_recovery_session_management'));
});
