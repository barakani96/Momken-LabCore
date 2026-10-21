import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
test('persistent results migration enforces specimen/test uniqueness and records lifecycle events', async () => {
  const sql = await read('../db/migrations/0008_persistent_results_workflow.sql');
  assert.match(sql, /CREATE TABLE lab_results/); assert.match(sql, /UNIQUE \(specimen_id, test_code\)/);
  assert.match(sql, /CREATE TABLE lab_result_events/); assert.match(sql, /Critical pending/); assert.match(sql, /validated_by/);
  const journal = JSON.parse(await read('../db/migrations/meta/_journal.json'));
  assert.equal(journal.entries.find(entry => entry.tag === '0008_persistent_results_workflow')?.idx, 7); assert.equal(journal.entries.find(entry => entry.tag === '0009_reference_ranges_critical_management')?.idx, 8); assert.equal(journal.entries.find(entry => entry.tag === '0010_clinical_report_release')?.idx, 9); assert.equal(journal.entries.find(entry => entry.tag === '0014_blood_bank_core')?.idx, 13); assert.equal(journal.entries.find(entry => entry.tag === '0017_password_recovery_session_management')?.idx, 16); assert.equal(journal.entries.find(entry => entry.tag === '0018_audit_compliance_chain')?.idx, 17); assert.equal(journal.entries.find(entry => entry.tag === '0019_quality_management_system')?.idx, 18); assert.equal(journal.entries.find(e=>e.tag==='0020_document_control_sop')?.idx,19);
});
test('result APIs require scoped permissions, optimistic concurrency, and independent validation', async () => {
  const list = await read('../app/api/results/route.ts'); const entry = await read('../app/api/results/[id]/route.ts'); const review = await read('../app/api/results/[id]/review/route.ts');
  assert.match(list, /results\.read/); assert.match(list, /results\.enter/); assert.match(entry, /expectedVersion/); assert.match(entry, /Validated.*immutable/);
  assert.match(review, /results\.validate/); assert.match(review, /Independent validation is required/); assert.match(review, /Critical-range results require a separate critical-result escalation workflow/);
  assert.match(review, /labResultEvents/); assert.match(review, /auditEvents/);
});
test('result persistence schema snapshots values and keeps entry, review, and validation actors separate', async () => {
  const schema = await read('../db/schema.ts');
  assert.match(schema, /export const labResults = pgTable\('lab_results'/); assert.match(schema, /enteredBy: uuid\('entered_by'\)/); assert.match(schema, /reviewedBy: uuid\('reviewed_by'\)/); assert.match(schema, /validatedBy: uuid\('validated_by'\)/);
  assert.match(schema, /export const labResultEvents = pgTable\('lab_result_events'/);
});
test('results page renders the database-backed workbench and preserves explicit clinical safety caveats', async () => {
  const page = await read('../app/results/page.tsx'); const ui = await read('../components/persistent-results-workbench.tsx');
  assert.match(page, /PersistentResultsWorkbench/); assert.match(ui, /fetch\(`\/api\/results/); assert.match(ui, /expectedVersion/);
  assert.match(ui, /القيم المرجعية والحرجة غير معتمدة افتراضياً/); assert.match(ui, /Escalation required/);
});
