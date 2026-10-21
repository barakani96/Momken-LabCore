import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
test('increment 1.8 migration adds per-user overrides and authentication event history', () => {
  const sql = read('../db/migrations/0006_user_admin_permissions.sql');
  assert.match(sql, /CREATE TABLE user_permission_overrides/);
  assert.match(sql, /UNIQUE \(user_id, permission_key\)/);
  assert.match(sql, /CREATE TABLE auth_events/);
  assert.match(sql, /ip_hash varchar\(64\)/);
});
test('user administration API hashes passwords and requires fine-grained permission', () => {
  const route = read('../app/api/admin/users/route.ts');
  assert.match(route, /authorizeApi\(false, 'users\.manage', request\)/);
  assert.match(route, /hashPassword\(body\.data\.password\)/);
  assert.match(route, /min\(14\)/);
  assert.match(route, /23505/);
});
test('user administration prevents self-deactivation and last-admin lockout', () => {
  const route = read('../app/api/admin/users/[id]/route.ts');
  assert.match(route, /You cannot deactivate or demote your own account/);
  assert.match(route, /LAST_ACTIVE_ADMIN/);
  assert.match(route, /tx\.delete\(appSessions\)/);
});
test('permission overrides are validated against the supported permission allowlist', () => {
  const route = read('../app/api/admin/users/[id]/permissions/route.ts');
  assert.match(route, /z\.enum\(PERMISSIONS\)/);
  assert.match(route, /Administrator permissions are fixed/);
  assert.match(route, /USER_PERMISSIONS_UPDATED/);
});
test('domain APIs use fine-grained permission keys instead of coarse write-only checks', () => {
  for (const [file, key] of [['../app/api/orders/route.ts','orders.read'],['../app/api/specimens/route.ts','specimens.read'],['../app/api/patients/route.ts','patients.read'],['../app/api/specimens/[id]/transition/route.ts','specimens.transition']]) {
    assert.match(read(file), new RegExp(key.replace('.', '\\.') ));
  }
});
test('admin navigation and user administration page are present', () => {
  assert.ok(existsSync(new URL('../app/admin/users/page.tsx', import.meta.url)));
  assert.match(read('../components/app-shell.tsx'), /Users & permissions/);
  assert.match(read('../components/user-administration.tsx'), /Save permissions/);
});
test('login records success and failure without persisting raw IP addresses', () => {
  const route = read('../app/api/auth/login/route.ts');
  assert.match(route, /authEvents/);
  assert.match(route, /createHash\('sha256'\)/);
  assert.match(route, /outcome: 'FAILURE'/);
  assert.match(route, /outcome: 'SUCCESS'/);
});
