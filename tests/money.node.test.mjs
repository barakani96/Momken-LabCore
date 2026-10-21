import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMinor, minorDigits, parseMajorToMinor } from '../lib/money.ts';
test('minor-unit digits follow the currency', () => { assert.equal(minorDigits('USD'), 2); assert.equal(minorDigits('JPY'), 0); assert.equal(minorDigits('KWD'), 3); });
test('amounts parse exactly without floating-point drift', () => {
  assert.equal(parseMajorToMinor('12.5', 'USD'), 1250); assert.equal(parseMajorToMinor('0.1', 'USD'), 10); assert.equal(parseMajorToMinor('1,234.56', 'USD'), 123456); assert.equal(parseMajorToMinor('19.99', 'USD'), 1999); assert.equal(parseMajorToMinor('5', 'JPY'), 5); assert.equal(parseMajorToMinor('1.005', 'KWD'), 1005);
  for (const bad of ['', 'abc', '-1', '1.234', '1e3', '12.', '.5', '1234567890123']) assert.equal(parseMajorToMinor(bad, 'USD'), null, bad);
  assert.equal(parseMajorToMinor('1.5', 'JPY'), null);
});
test('amounts format in English and Arabic with Latin digits', () => { assert.match(formatMinor(123456, 'USD', 'en'), /1,234\.56/); assert.match(formatMinor(123456, 'USD', 'ar'), /1,234\.56/); assert.match(formatMinor(500, 'JPY', 'en'), /500/); });
