import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSpecimens, seedSpecimens, transitionSpecimen } from '../lib/specimens.ts';

test('search matches accession, patient, and test codes case-insensitively', () => {
  assert.equal(filterSpecimens(seedSpecimens, 'lab-2026-001842', 'All statuses').length, 1);
  assert.equal(filterSpecimens(seedSpecimens, 'maha', 'All statuses')[0].patientId, 'PAT-004283');
  assert.equal(filterSpecimens(seedSpecimens, 'tsh', 'All statuses')[0].accession, 'LAB-2026-001848');
});
test('status filter returns only matching specimens', () => {
  assert.equal(filterSpecimens(seedSpecimens, '', 'Collected').length, 3);
});
test('valid collection transition is allowed', () => {
  assert.equal(transitionSpecimen(seedSpecimens[1], 'In progress').status, 'In progress');
});
test('invalid state skip is rejected', () => {
  assert.throws(() => transitionSpecimen(seedSpecimens[1], 'Authorized'), /Invalid specimen transition/);
});
test('authorized specimens are terminal', () => {
  assert.throws(() => transitionSpecimen(seedSpecimens[4], 'In progress'), /Invalid specimen transition/);
});
