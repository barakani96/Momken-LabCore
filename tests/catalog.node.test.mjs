import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoOrder, filterCatalog, seedTestCatalog, validateOrder } from '../lib/catalog.ts';

test('catalog search matches code, department, method and specimen', () => {
  assert.equal(filterCatalog(seedTestCatalog, 'HBA1C', 'All departments').length, 1);
  assert.ok(filterCatalog(seedTestCatalog, 'serum', 'All departments').length > 0);
  assert.ok(filterCatalog(seedTestCatalog, '', 'Hematology').every(test => test.department === 'Hematology'));
});
test('order validation requires patient, clinician, and at least one active test', () => {
  assert.deepEqual(validateOrder({ patientId: '', patientName: '', clinician: '', testCodes: [] }, seedTestCatalog), ['Patient ID is required.', 'Patient name is required.', 'Ordering clinician is required.', 'Select at least one test.']);
});
test('order validation blocks incompatible specimen types', () => {
  const errors = validateOrder({ patientId: 'PT-1', patientName: 'Demo Patient', clinician: 'Dr Demo', testCodes: ['CBC', 'CMP'] }, seedTestCatalog);
  assert.ok(errors.includes('Selected tests require different specimen types; split the order by specimen.'));
});
test('order validation rejects inactive or unknown tests', () => {
  const catalog = [...seedTestCatalog, { ...seedTestCatalog[0], code: 'OLD', active: false }];
  assert.ok(validateOrder({ patientId: 'PT-1', patientName: 'Demo', clinician: 'Dr Demo', testCodes: ['OLD'] }, catalog).includes('One or more selected tests are unavailable.'));
});
test('order creation snapshots codes, normalizes identity fields, and assigns deterministic demo accession', () => {
  const order = createDemoOrder({ patientId: ' PT-001 ', patientName: ' Demo Patient ', clinician: ' Dr Example ', priority: 'Urgent', testCodes: ['CBC', 'RETIC', 'CBC'] }, seedTestCatalog, 4, '2026-10-21T00:00:00.000Z');
  assert.equal(order.accession, 'NS-2026-00004'); assert.equal(order.patientId, 'PT-001'); assert.deepEqual(order.testCodes, ['CBC', 'RETIC']); assert.equal(order.specimenType, 'EDTA whole blood');
});
test('order creation throws when specimen requirements conflict', () => {
  assert.throws(() => createDemoOrder({ patientId: 'PT-1', patientName: 'Demo', clinician: 'Dr Demo', priority: 'Routine', testCodes: ['CBC', 'TSH'] }, seedTestCatalog, 1), /different specimen types/);
});
