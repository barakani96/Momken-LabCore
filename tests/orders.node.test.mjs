import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePersonName, validatePersistentOrder } from '../lib/order-validation.ts';

const tests = [
  { id: '1', code: 'CBC', name: 'Complete blood count', version: '1.0', specimenType: 'EDTA whole blood', department: 'Hematology' },
  { id: '2', code: 'RETIC', name: 'Reticulocyte count', version: '1.0', specimenType: 'EDTA whole blood', department: 'Hematology' },
  { id: '3', code: 'TSH', name: 'Thyroid-stimulating hormone', version: '1.0', specimenType: 'Serum', department: 'Immunology' },
];
const input = { patientNumber: 'PAT-004281', patientName: 'Amal Hassan', clinician: 'Dr Example', priority: 'Routine', testCodes: ['CBC', 'RETIC'] };

test('patient name normalization tolerates case and repeated whitespace only', () => {
  assert.equal(normalizePersonName('  Amal   Hassan '), 'amal hassan');
  assert.equal(normalizePersonName('AMAL HASSAN'), normalizePersonName('Amal Hassan'));
});
test('validates an order with active tests and a single specimen type', () => {
  const result = validatePersistentOrder(input, tests.slice(0, 2));
  assert.deepEqual(result.errors, []);
  assert.equal(result.specimenType, 'EDTA whole blood');
  assert.deepEqual(result.uniqueCodes, ['CBC', 'RETIC']);
});
test('deduplicates repeated requested test codes', () => {
  const result = validatePersistentOrder({ ...input, testCodes: ['CBC', 'CBC'] }, tests.slice(0, 1));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.uniqueCodes, ['CBC']);
});
test('rejects missing requested tests and incompatible specimen types', () => {
  const missing = validatePersistentOrder({ ...input, testCodes: ['CBC', 'FAKE'] }, tests.slice(0, 1));
  assert.ok(missing.errors.some(error => error.includes('inactive or unavailable')));
  const incompatible = validatePersistentOrder({ ...input, testCodes: ['CBC', 'TSH'] }, [tests[0], tests[2]]);
  assert.ok(incompatible.errors.some(error => error.includes('different specimen types')));
});
test('migration defines non-cycling accession sequences and unique order-to-specimen links', async () => {
  const { readFile } = await import('node:fs/promises');
  const migration = await readFile(new URL('../db/migrations/0003_persistent_orders_accessioning.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE SEQUENCE IF NOT EXISTS lab_accession_seq[\s\S]*NO CYCLE/);
  assert.match(migration, /CONSTRAINT order_accessioning_order_uq UNIQUE \(order_id\)/);
  assert.match(migration, /CONSTRAINT order_accessioning_specimen_uq UNIQUE \(specimen_id\)/);
});
test('order APIs use a transaction, verify registered patient identity, snapshot catalog versions, and audit actions', async () => {
  const { readFile } = await import('node:fs/promises');
  const createRoute = await readFile(new URL('../app/api/orders/route.ts', import.meta.url), 'utf8');
  const accessionRoute = await readFile(new URL('../app/api/orders/[id]/accession/route.ts', import.meta.url), 'utf8');
  assert.match(createRoute, /db\.transaction/);
  assert.match(createRoute, /Patient name does not match the registered patient ID/);
  assert.match(createRoute, /catalogVersionSnapshot/);
  assert.match(createRoute, /ORDER_CREATED/);
  assert.match(accessionRoute, /for\('update'\)/);
  assert.match(accessionRoute, /ORDER_ACCESSIONED/);
  assert.match(accessionRoute, /status !== 'Ordered'/);
});
test('database seed loads the catalog before process exit', async () => {
  const { readFile } = await import('node:fs/promises');
  const seed = await readFile(new URL('../db/seed.ts', import.meta.url), 'utf8');
  assert.ok(seed.indexOf('for (const test of catalogSeed)') < seed.indexOf('process.exit(0)'));
  assert.match(seed, /onConflictDoUpdate\([\s\S]*target: \[testCatalog\.code, testCatalog\.version\]/);
});
test('migration journal contains a complete ordered base, catalog, and accessioning chain', async () => {
  const { readFile } = await import('node:fs/promises');
  const journal = JSON.parse(await readFile(new URL('../db/migrations/meta/_journal.json', import.meta.url), 'utf8'));
  assert.deepEqual(journal.entries.map(entry => entry.tag), ['0001_base_schema','0002_catalog_orders','0003_persistent_orders_accessioning','0004_patient_registry_specimen_events','0005_authentication_rbac','0006_user_admin_permissions','0007_audit_security_hardening','0008_persistent_results_workflow','0009_reference_ranges_critical_management','0010_clinical_report_release','0011_patient_portal_secure_delivery','0012_patient_portal_accounts','0013_patient_session_security','0014_blood_bank_core','0015_blood_bank_operations','0016_account_mfa_recovery','0017_password_recovery_session_management','0018_audit_compliance_chain','0019_quality_management_system','0020_document_control_sop','0021_inventory_reagent_control','0022_procurement_purchase_orders']);
  const base = await readFile(new URL('../db/migrations/0001_base_schema.sql', import.meta.url), 'utf8');
  assert.match(base, /CREATE TABLE patients/);
  assert.match(base, /CREATE TABLE specimens/);
  assert.match(base, /CREATE TABLE audit_events/);
});

test('patient registry rejects duplicate identities and specimen creation requires an existing matching patient', async () => {
  const { readFile } = await import('node:fs/promises');
  const patientsRoute = await readFile(new URL('../app/api/patients/route.ts', import.meta.url), 'utf8');
  const specimensRoute = await readFile(new URL('../app/api/specimens/route.ts', import.meta.url), 'utf8');
  assert.match(patientsRoute, /onConflictDoNothing/);
  assert.match(patientsRoute, /Patient ID already exists/);
  assert.match(specimensRoute, /Register the patient first/);
  assert.match(specimensRoute, /Patient name does not match the registered patient ID/);
  assert.doesNotMatch(specimensRoute, /onConflictDoUpdate/);
});
test('specimen lifecycle migration records immutable event details and uses a non-cycling sequence', async () => {
  const { readFile } = await import('node:fs/promises');
  const migration = await readFile(new URL('../db/migrations/0004_patient_registry_specimen_events.sql', import.meta.url), 'utf8');
  const route = await readFile(new URL('../app/api/specimens/[id]/transition/route.ts', import.meta.url), 'utf8');
  assert.match(migration, /lab_specimen_seq START WITH 200000 NO CYCLE/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS specimen_events/);
  assert.match(route, /A rejection reason is required/);
  assert.match(route, /Recollection details are required/);
  assert.match(route, /for\('update'\)/);
  assert.match(route, /SPECIMEN_STATUS_CHANGED/);
});
