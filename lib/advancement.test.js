import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teamRoundCounts } from './advancement.js';

test('teamRoundCounts counts brackets reaching each round per team', () => {
  const ko = { rounds: {
    R32: [{ slot: 'R32-1' }, { slot: 'R32-2' }],
    R16: [{ slot: 'R16-1' }],
    QF: [], SF: [],
    F: [{ slot: 'F-1' }],
  } };
  const s = [
    { phase: 'knockout', picks: { bracket: {
      'R32-1': { advances: 'BRA' }, 'R32-2': { advances: 'ARG' }, 'R16-1': { advances: 'BRA' }, 'F-1': { advances: 'BRA' },
    } } },
    { phase: 'knockout', picks: { bracket: {
      'R32-1': { advances: 'BRA' }, 'R32-2': { advances: 'GER' }, 'R16-1': { advances: 'GER' }, 'F-1': { advances: 'GER' },
    } } },
    { phase: 'group', picks: { matches: {} } }, // ignored
  ];
  const c = teamRoundCounts(s, ko);
  // BRA: made R16 in both (advanced R32-1) → 2; QF via sub1 R16-1 → 1; champion via sub1 F-1 → 1.
  assert.deepEqual(c.BRA, { R16: 2, QF: 1, SF: 0, Final: 0, Champion: 1 });
  assert.deepEqual(c.ARG, { R16: 1, QF: 0, SF: 0, Final: 0, Champion: 0 });
  assert.deepEqual(c.GER, { R16: 1, QF: 1, SF: 0, Final: 0, Champion: 1 });
});
