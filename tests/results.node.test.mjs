import test from 'node:test';
import assert from 'node:assert/strict';
import { filterResults, flagResult, parseResultValue, seedResults, submitForTechnicalReview, validateResultEntry } from '../lib/results.ts';

test('parses only finite numeric result values', () => {
  assert.equal(parseResultValue(' 7.2 '), 7.2);
  assert.equal(parseResultValue(''), null);
  assert.equal(parseResultValue('NaN'), null);
  assert.equal(parseResultValue('1e999'), null);
});

test('flags values against illustrative reference and critical intervals', () => {
  const potassium = seedResults.find(r => r.testCode === 'K');
  assert.ok(potassium);
  assert.equal(flagResult(potassium), 'Critical high');
  assert.equal(flagResult({ ...potassium, value: '5.0' }), 'Normal');
  assert.equal(flagResult({ ...potassium, value: '3.0' }), 'Low');
  assert.equal(flagResult({ ...potassium, value: '' }), 'Not entered');
});

test('validates numeric entry and rejects empty or malformed values', () => {
  assert.equal(validateResultEntry('12.3'), null);
  assert.equal(validateResultEntry(''), 'A numeric result is required.');
  assert.equal(validateResultEntry('abc'), 'Enter a valid numeric result.');
});

test('filters result workbench by query, status and department together', () => {
  assert.equal(filterResults(seedResults, 'PAT-004281', 'Entered', 'Hematology').length, 2);
  assert.equal(filterResults(seedResults, 'potassium', 'All statuses', 'All departments').length, 1);
  assert.equal(filterResults(seedResults, '', 'Needs entry', 'Coagulation').length, 1);
});

test('routes eligible entered results to technical review with reviewer metadata', () => {
  const result = seedResults.find(r => r.testCode === 'WBC');
  assert.ok(result);
  const next = submitForTechnicalReview(result, 'Reviewer A', '2026-10-21T00:00:00.000Z');
  assert.equal(next.status, 'Technical review');
  assert.equal(next.reviewedBy, 'Reviewer A');
  assert.equal(next.reviewedAt, '2026-10-21T00:00:00.000Z');
  assert.equal(result.status, 'Entered', 'transition must not mutate the original record');
});

test('blocks empty, already-reviewed, and critical-range results from review action', () => {
  const missing = seedResults.find(r => r.testCode === 'INR');
  const critical = seedResults.find(r => r.testCode === 'K');
  const reviewed = seedResults.find(r => r.testCode === 'ALT');
  assert.ok(missing && critical && reviewed);
  assert.throws(() => submitForTechnicalReview(missing, 'Reviewer A', 'now'), /missing or invalid/);
  assert.throws(() => submitForTechnicalReview(critical, 'Reviewer A', 'now'), /critical-result workflow/);
  assert.throws(() => submitForTechnicalReview(reviewed, 'Reviewer A', 'now'), /already in technical review/);
});
