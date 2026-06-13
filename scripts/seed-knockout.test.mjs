import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKnockout } from './seed-knockout.mjs';

// Minimal parsed-events fixture: 2 R32 matches feeding one final (test-sized tree).
const parsed = [
  { matchId: '1', home: 'BRA', away: 'KOR', kickoff_iso: '2026-07-05T19:00:00Z', round: 'R32', bracketSlot: 1 },
  { matchId: '2', home: 'MEX', away: 'GER', kickoff_iso: '2026-07-05T22:00:00Z', round: 'R32', bracketSlot: 2 },
];

test('buildKnockout assigns slots, sorts R32 by kickoff, records first kickoff', () => {
  const ko = buildKnockout(parsed);
  assert.equal(ko.rounds.R32.length, 2);
  assert.equal(ko.rounds.R32[0].slot, 'R32-1');
  assert.equal(ko.rounds.R32[0].home, 'BRA');
  assert.equal(ko.rounds.R32[0].match_id, '1');
  assert.equal(ko.first_kickoff_iso, '2026-07-05T19:00:00Z');
});
