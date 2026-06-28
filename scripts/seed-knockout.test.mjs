import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKnockout, parseFeederRef } from './seed-knockout.mjs';

// The real 2026 wiring as published by ESPN on 2026-06-28. Two ground truths:
//   - FIFA matchNumber (R32 = 73..88) drives the per-round numbering. The match
//     id order is DIFFERENT from matchNumber order (note the shuffled ids below),
//     which is exactly the bug this guards against.
//   - The feeder refs ("Round of 32 N Winner") number their sources by that same
//     matchNumber position.
// [matchId, matchNumber, home, away]
const R32 = [
  ['760486', 73, 'RSA', 'CAN'], ['760489', 74, 'GER', 'PAR'], ['760488', 75, 'NED', 'MAR'], ['760487', 76, 'BRA', 'JPN'],
  ['760492', 77, 'FRA', 'SWE'], ['760490', 78, 'CIV', 'NOR'], ['760491', 79, 'MEX', 'ECU'], ['760495', 80, 'ENG', 'COD'],
  ['760494', 81, 'USA', 'BIH'], ['760493', 82, 'BEL', 'SEN'], ['760496', 83, 'POR', 'CRO'], ['760497', 84, 'ESP', 'AUT'],
  ['760498', 85, 'SUI', 'ALG'], ['760500', 86, 'ARG', 'CPV'], ['760501', 87, 'COL', 'GHA'], ['760499', 88, 'AUS', 'EGY'],
].map(([matchId, matchNumber, home, away]) => ({ matchId, matchNumber, home, away, kickoff_iso: '2026-06-28T19:00:00.000Z' }));

const ref = (round, num) => ({ round, num, result: 'Winner' });
const later = (matchId, matchNumber, a, b) => ({ matchId, matchNumber, kickoff_iso: '2026-07-04T17:00:00.000Z', feeders: [a, b] });

const byRound = {
  R32,
  R16: [
    later('760502', 90, ref('R32', 1), ref('R32', 3)),
    later('760503', 89, ref('R32', 2), ref('R32', 5)),
    later('760504', 91, ref('R32', 4), ref('R32', 6)),
    later('760505', 92, ref('R32', 7), ref('R32', 8)),
    later('760506', 93, ref('R32', 11), ref('R32', 12)),
    later('760507', 94, ref('R32', 9), ref('R32', 10)),
    later('760508', 96, ref('R32', 13), ref('R32', 15)),
    later('760509', 95, ref('R32', 14), ref('R32', 16)),
  ],
  QF: [
    later('760510', 97, ref('R16', 1), ref('R16', 2)),
    later('760511', 98, ref('R16', 5), ref('R16', 6)),
    later('760512', 99, ref('R16', 3), ref('R16', 4)),
    later('760513', 100, ref('R16', 7), ref('R16', 8)),
  ],
  SF: [
    later('760514', 101, ref('QF', 1), ref('QF', 2)),
    later('760515', 102, ref('QF', 3), ref('QF', 4)),
  ],
  F: [later('760517', 104, ref('SF', 1), ref('SF', 2))],
};

// Walk feeds from an R32 slot up to its semifinal slot.
function semifinalOf(ko, r32Slot) {
  const bySlot = {};
  for (const r of Object.values(ko.rounds)) for (const s of r) bySlot[s.slot] = s;
  let slot = bySlot[r32Slot];
  while (slot && !slot.slot.startsWith('SF-')) slot = bySlot[slot.feeds];
  return slot?.slot;
}
const r32SlotOf = (ko, team) => ko.rounds.R32.find((s) => s.home === team || s.away === team)?.slot;

test('parseFeederRef parses every round label, returns null on real teams', () => {
  assert.deepEqual(parseFeederRef('Round of 32 3 Winner'), { round: 'R32', num: 3, result: 'Winner' });
  assert.deepEqual(parseFeederRef('Quarterfinal 1 Winner'), { round: 'QF', num: 1, result: 'Winner' });
  assert.deepEqual(parseFeederRef('Semifinal 2 Loser'), { round: 'SF', num: 2, result: 'Loser' });
  assert.equal(parseFeederRef('Brazil'), null);
  assert.equal(parseFeederRef('3RD'), null);
});

test('buildKnockout emits all five rounds at full size', () => {
  const ko = buildKnockout(byRound);
  assert.equal(ko.rounds.R32.length, 16);
  assert.equal(ko.rounds.R16.length, 8);
  assert.equal(ko.rounds.QF.length, 4);
  assert.equal(ko.rounds.SF.length, 2);
  assert.equal(ko.rounds.F.length, 1);
});

test('buildKnockout numbers by matchNumber, not match id', () => {
  const ko = buildKnockout(byRound);
  // "Round of 32 2" is matchNumber 74 (GER), even though that match's id (760489)
  // is NOT the 2nd-lowest id. Under the old id-order bug this slot held BRA.
  const r32 = Object.fromEntries(ko.rounds.R32.map((s) => [s.slot, s]));
  // R16-1 (clean) is fed by ESPN R16#89 ← R32 #2 & #5 = GER & FRA.
  assert.deepEqual(ko.rounds.R16[0].from.map((sl) => r32[sl].home).sort(), ['FRA', 'GER']);
});

test('REGRESSION: RSA and BRA land in different halves (matchNumber wiring)', () => {
  const ko = buildKnockout(byRound);
  const rsaSF = semifinalOf(ko, r32SlotOf(ko, 'RSA'));
  const braSF = semifinalOf(ko, r32SlotOf(ko, 'BRA'));
  assert.ok(rsaSF && braSF, 'both teams resolve to a semifinal');
  assert.notEqual(rsaSF, braSF, 'RSA and BRA must be in opposite halves');
});

test('buildKnockout keeps the Final (drops 3rd place) and wires the chain', () => {
  const ko = buildKnockout(byRound);
  assert.deepEqual(ko.rounds.QF[0].from, ['R16-1', 'R16-2']);
  assert.deepEqual(ko.rounds.SF[0].from, ['QF-1', 'QF-2']);
  assert.deepEqual(ko.rounds.F[0].from, ['SF-1', 'SF-2']);
  assert.equal(ko.rounds.F[0].match_id, '760517');
  assert.equal(ko.rounds.F[0].feeds, undefined);
});

test('buildKnockout populates match_id + kickoff for every slot (cron needs them)', () => {
  const ko = buildKnockout(byRound);
  for (const round of ['R32', 'R16', 'QF', 'SF', 'F']) {
    for (const slot of ko.rounds[round]) {
      assert.ok(slot.match_id, `${slot.slot} missing match_id`);
      assert.ok(slot.kickoff_iso, `${slot.slot} missing kickoff_iso`);
    }
  }
});

test('buildKnockout rejects a match missing matchNumber', () => {
  const bad = { ...byRound, QF: byRound.QF.map((q, i) => i === 0 ? { ...q, matchNumber: undefined } : q) };
  assert.throws(() => buildKnockout(bad), /missing matchNumber/);
});

test('buildKnockout rejects a short round', () => {
  const bad = { ...byRound, QF: byRound.QF.slice(0, 3) };
  assert.throws(() => buildKnockout(bad), /Expected 4 QF/);
});
