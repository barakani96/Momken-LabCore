import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = p => readFile(new URL(p, import.meta.url), 'utf8');
test('blood transfusion index uses callback table columns rather than self-referencing the uninitialized table', async () => {
  const schema = await read('../db/schema.ts');
  assert.match(schema, /index\('blood_transfusion_patient_idx'\)\.on\(table\.patientId, table\.createdAt\)/);
  assert.doesNotMatch(schema, /index\('blood_transfusion_patient_idx'\)\.on\(bloodTransfusionEvents\./);
});
test('sign-in handles non-JSON server responses without throwing JSON.parse errors to the user', async () => {
  const page = await read('../app/login/page.tsx');
  assert.match(page, /const responseText = await response\.text\(\)/);
  assert.match(page, /Sign-in service returned an HTML error/);
  assert.match(page, /response\.headers\.get\('content-type'\)/);
});
