import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async p => readFile(new URL(p, import.meta.url), 'utf8');
test('audit compliance migration adds ordered SHA-256 hash chain and append-only database guard', async () => {
 const migration = await read('../db/migrations/0018_audit_compliance_chain.sql');
 assert.match(migration, /CREATE EXTENSION IF NOT EXISTS pgcrypto/);
 assert.match(migration, /chain_seq bigserial/);
 assert.match(migration, /digest\(/);
 assert.match(migration, /BEFORE UPDATE OR DELETE ON audit_events/);
 assert.match(migration, /BEFORE INSERT ON audit_events/);
 const journal = JSON.parse(await read('../db/migrations/meta/_journal.json'));
 assert.equal(journal.entries.find(e => e.tag === '0018_audit_compliance_chain')?.idx, 17);
});
test('audit API supports permission-gated CSV export and injection-safe cells', async () => {
 const route = await read('../app/api/admin/audit/route.ts');
 assert.match(route, /format === 'csv' \? 'audit\.export' : 'audit\.read'/);
 assert.match(route, /5000/);
 assert.match(route, /X-Content-Type-Options/);
 assert.match(route, /csvCell/);
 assert.match(route, /\[\\s\\u0000-\\u001f\]\*\[=\+@-\]/);
});
test('audit integrity endpoint checks both event hashes and previous links', async () => {
 const route = await read('../app/api/admin/audit/integrity/route.ts');
 assert.match(route, /lag\(e\.event_hash\)/);
 assert.match(route, /digest\(/);
 assert.match(route, /previous_hash IS DISTINCT FROM prior_hash/);
 assert.match(route, /audit\.read/);
});
test('audit UI exposes date filters, CSV export, and integrity verification in Carbon UI', async () => {
 const ui = await read('../components/audit-trail.tsx');
 assert.match(ui, /Export CSV/);
 assert.match(ui, /type="date"/);
 assert.match(ui, /Verify now/);
 assert.match(ui, /DataTable/);
});

test('audit export is independently permissioned and available to Lab Managers', async () => {
 const permissions = await read('../lib/auth/permissions.ts');
 assert.match(permissions, /'audit\.export'/);
 assert.match(permissions, /'Lab Manager'.*'audit\.read','audit\.export'/);
});
