import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async p => readFile(new URL(p, import.meta.url), 'utf8');
test('QMS migration adds constrained quality cases and append-only history', async () => {
 const sql = await read('../db/migrations/0019_quality_management_system.sql');
 assert.match(sql, /CREATE TABLE quality_cases/);
 assert.match(sql, /case_type IN \('Nonconformance','Incident','CAPA','Internal audit'\)/);
 assert.match(sql, /status IN \('Open','Investigating','Action planned','Verification','Closed','Cancelled'\)/);
 assert.match(sql, /quality_case_events_append_only_guard/);
 assert.match(sql, /BEFORE UPDATE OR DELETE ON quality_case_events/);
 const journal = JSON.parse(await read('../db/migrations/meta/_journal.json'));
 assert.equal(journal.entries.find(entry => entry.tag === '0019_quality_management_system')?.idx, 18); assert.equal(journal.entries.find(e=>e.tag==='0020_document_control_sop')?.idx,19);
});
test('QMS API enforces read/manage permissions, validated workflow, and audit trail', async () => {
 const list = await read('../app/api/quality/cases/route.ts');
 const detail = await read('../app/api/quality/cases/[id]/route.ts');
 assert.match(list, /authorizeApi\(false, 'quality\.read'/);
 assert.match(list, /authorizeApi\(true, 'quality\.manage'/);
 assert.match(list, /qualityCaseEvents/);
 assert.match(list, /QUALITY_CASE_CREATED/);
 assert.match(detail, /Invalid status transition/);
 assert.match(detail, /Document at least one corrective or preventive action/);
 assert.match(detail, /effectiveness check is required before closure/i);
 assert.match(detail, /QUALITY_CASE_STATUS_CHANGED/);
 assert.match(detail, /Closed cases are immutable/);
});
test('QMS workbench supports bilingual creation, filters, CAPA fields, lifecycle, and history', async () => {
 const ui = await read('../components/quality-management-workbench.tsx');
 assert.match(ui, /Nonconformance/);
 assert.match(ui, /Internal audit/);
 assert.match(ui, /Root-cause analysis/);
 assert.match(ui, /Corrective action/);
 assert.match(ui, /Preventive action/);
 assert.match(ui, /Effectiveness verification/);
 assert.match(ui, /Case history/);
 assert.match(ui, /dir=\{ar\?'rtl':'ltr'\}/);
 assert.match(ui, /@carbon\/react/);
});
test('QMS permissions preserve role-based quality access', async () => {
 const permissions = await read('../lib/auth/permissions.ts');
 assert.match(permissions, /'quality\.read', 'quality\.manage', 'quality\.audit'/);
 assert.match(permissions, /'Lab Manager'.*'quality\.read','quality\.manage','quality\.audit'/);
});
