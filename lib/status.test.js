import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMatchFinal } from './status.js';

test('STATUS_FINAL is final', () => {
  assert.equal(isMatchFinal('STATUS_FINAL'), true);
});

test('STATUS_FULL_TIME is final (ESPN soccer)', () => {
  assert.equal(isMatchFinal('STATUS_FULL_TIME'), true);
});

test('STATUS_SCHEDULED is not final', () => {
  assert.equal(isMatchFinal('STATUS_SCHEDULED'), false);
});

test('STATUS_HALFTIME is not final', () => {
  assert.equal(isMatchFinal('STATUS_HALFTIME'), false);
});

test('undefined / missing is not final', () => {
  assert.equal(isMatchFinal(undefined), false);
  assert.equal(isMatchFinal(null), false);
});
