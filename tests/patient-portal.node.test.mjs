import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = p => readFile(new URL(`../${p}`, import.meta.url), 'utf8');
test('portal migration stores token hashes, expiry, revocation and access outcomes', async()=> {
 const sql=await read('db/migrations/0011_patient_portal_secure_delivery.sql');
 for(const part of ['report_portal_grants','token_hash varchar(64) NOT NULL UNIQUE','expires_at timestamptz NOT NULL','revoked_at timestamptz','report_portal_access_events','ip_hash varchar(64)']) assert.ok(sql.includes(part),part);
});
test('patient portal tokens are generated with cryptographic randomness and only hashes are stored',async()=>{
 const api=await read('app/api/portal/grants/route.ts');
 assert.match(api,/randomBytes\(32\)/); assert.match(api,/createHash\('sha256'\)/); assert.match(api,/tokenHash/); assert.match(api,/expiresInDays: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(30\)/);
});
test('portal report route rejects invalid, revoked, expired and superseded grants and disables caching',async()=>{
 const api=await read('app/api/portal/reports/[token]/route.ts');
 assert.match(api,/grant\.revokedAt/); assert.match(api,/grant\.expiresAt > new Date\(\)/); assert.match(api,/grant\.status === 'Released'/); assert.match(api,/Cache-Control.*no-store/); assert.match(api,/X-Robots-Tag/);
});
test('portal management requires fine-grained permission and supports revocation',async()=>{
 const api=await read('app/api/portal/grants/route.ts'); const revoke=await read('app/api/portal/grants/[id]/route.ts');
 assert.match(api,/reports\.portal\.manage/); assert.match(revoke,/reports\.portal\.manage/); assert.match(revoke,/revokedAt: new Date\(\)/);
});
test('public portal routes are explicitly exempted from staff-session middleware',async()=>{
 const middleware=await read('middleware.ts'); assert.match(middleware,/\/portal/); assert.match(middleware,/\/api\/portal\/reports/);
});
test('portal admin and report view use Carbon components and provide a clinical disclaimer',async()=>{
 const admin=await read('components/patient-portal-admin.tsx'); const view=await read('components/portal-report-view.tsx');
 assert.match(admin,/@carbon\/react/); assert.match(admin,/Revoke/); assert.match(view,/@carbon\/react/); assert.match(view,/qualified healthcare professional/);
});
