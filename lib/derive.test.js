import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveWinner } from './derive.js';

test('home wins when home score is higher', () => {
  assert.equal(deriveWinner(2, 1), 'home');
});

test('away wins when away score is higher', () => {
  assert.equal(deriveWinner(0, 1), 'away');
});

test('draw when scores are equal', () => {
  assert.equal(deriveWinner(2, 2), 'draw');
});

test('0-0 is a draw', () => {
  assert.equal(deriveWinner(0, 0), 'draw');
});

test('throws on non-numeric input', () => {
  assert.throws(() => deriveWinner(undefined, 1));
  assert.throws(() => deriveWinner(1, null));
  assert.throws(() => deriveWinner('2', 1));
});
