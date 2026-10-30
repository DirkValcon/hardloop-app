import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTijd, formatTijd } from '../js/tijd.js';

test('parseTijd leest mm:ss, u:mm:ss en alleen cijfers', () => {
  assert.equal(parseTijd('35:00'), 2100);
  assert.equal(parseTijd('28:30'), 1710);
  assert.equal(parseTijd('70:00'), 4200);
  assert.equal(parseTijd('1:10:00'), 4200);
  assert.equal(parseTijd('3500'), 2100);
  assert.equal(parseTijd('11000'), 4200);
  assert.equal(parseTijd(' 35.00 '), 2100);
});

test('parseTijd weigert onzin', () => {
  for (const t of ['', '35', 'abc', '35:75', '1:75:00', '35:', ':30', '-5:00', '1:2:3:4']) {
    assert.equal(parseTijd(t), null, t);
  }
});

test('formatTijd', () => {
  assert.equal(formatTijd(2100), '35:00');
  assert.equal(formatTijd(4200), '1:10:00');
  assert.equal(formatTijd(3565), '59:25');
});
