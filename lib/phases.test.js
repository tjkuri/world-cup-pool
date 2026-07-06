// lib/phases.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phaseBoundaries } from './phases.js';

const knockout = { rounds: {
  R32: [ { slot:'R32-1', kickoff_iso:'2026-06-29T20:30:00Z' }, { slot:'R32-2', kickoff_iso:'2026-06-28T19:00:00Z' } ],
  R16: [ { slot:'R16-1', kickoff_iso:'2026-07-03T19:00:00Z' } ],
  QF: [], SF: [], F: [ { slot:'F-1', kickoff_iso:'2026-07-19T19:00:00Z' } ],
} };

test('phaseBoundaries returns earliest kickoff per non-empty round, sorted', () => {
  const b = phaseBoundaries(knockout);
  assert.deepEqual(b.map(x=>x.round), ['R32','R16','F']);
  assert.equal(b[0].start, '2026-06-28T19:00:00Z'); // earliest of the two R32 slots
});

test('phaseBoundaries omits rounds with no kickoff data and tolerates missing rounds', () => {
  assert.deepEqual(phaseBoundaries({ rounds: {} }), []);
});
