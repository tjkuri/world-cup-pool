import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKnockout, parseFeederRef } from './seed-knockout.mjs';

// The real 2026 wiring as published by ESPN on 2026-06-27 (match ids 760486+).
// R32 matches keyed by ascending id = ESPN "Round of 32 N". Later rounds carry
// the feeder refs ESPN exposes as placeholder team names. This fixture is the
// whole point of the rewrite: the bracket is NOT sequential.
const R32 = [
  ['760486', 'RSA', 'CAN'], ['760487', 'BRA', 'JPN'], ['760488', 'NED', 'MAR'], ['760489', 'GER', 'PAR'],
  ['760490', 'CIV', 'NOR'], ['760491', 'MEX', 'URU'], ['760492', 'FRA', 'SWE'], ['760493', 'BEL', 'CRO'],
  ['760494', 'USA', 'BIH'], ['760495', 'POR', 'GHA'], ['760496', 'COL', 'SEN'], ['760497', 'ESP', 'ECU'],
  ['760498', 'SUI', 'IRN'], ['760499', 'AUS', 'EGY'], ['760500', 'ARG', 'CPV'], ['760501', 'ENG', 'PAN'],
].map(([matchId, home, away], i) => ({ matchId, home, away, kickoff_iso: `2026-06-28T${String(10 + i).padStart(2, '0')}:00:00.000Z` }));

const ref = (round, num) => ({ round, num, result: 'Winner' });
const later = (matchId, a, b) => ({ matchId, kickoff_iso: '2026-07-01T00:00:00.000Z', feeders: [a, b] });

const byRound = {
  R32,
  R16: [
    later('760502', ref('R32', 1), ref('R32', 3)),
    later('760503', ref('R32', 2), ref('R32', 5)),
    later('760504', ref('R32', 4), ref('R32', 6)),
    later('760505', ref('R32', 7), ref('R32', 8)),
    later('760506', ref('R32', 11), ref('R32', 12)),
    later('760507', ref('R32', 9), ref('R32', 10)),
    later('760508', ref('R32', 13), ref('R32', 15)),
    later('760509', ref('R32', 14), ref('R32', 16)),
  ],
  QF: [
    later('760510', ref('R16', 1), ref('R16', 2)),
    later('760511', ref('R16', 5), ref('R16', 6)),
    later('760512', ref('R16', 3), ref('R16', 4)),
    later('760513', ref('R16', 7), ref('R16', 8)),
  ],
  SF: [
    later('760514', ref('QF', 1), ref('QF', 2)),
    later('760515', ref('QF', 3), ref('QF', 4)),
  ],
  F: [later('760517', ref('SF', 1), ref('SF', 2))],
};

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

test('buildKnockout places teams per ESPN wiring, NOT sequentially', () => {
  const ko = buildKnockout(byRound);
  const r32 = Object.fromEntries(ko.rounds.R32.map((s) => [s.slot, s]));
  // R16-1 is fed by ESPN R32 #1 (RSA/CAN) and #3 (NED/MAR) — adjacent in the
  // clean relabeling, but the SECOND slot is the non-sequential one.
  assert.equal(r32['R32-1'].home, 'RSA');
  assert.equal(r32['R32-2'].home, 'NED'); // ESPN #3, not #2 — proves non-sequential
  assert.deepEqual(ko.rounds.R16[0].from, ['R32-1', 'R32-2']);
  assert.equal(r32['R32-1'].feeds, 'R16-1');
  assert.equal(r32['R32-2'].feeds, 'R16-1');
});

test('buildKnockout wires the full chain and keeps the Final (drops 3rd place)', () => {
  const ko = buildKnockout(byRound);
  assert.deepEqual(ko.rounds.QF[0].from, ['R16-1', 'R16-2']);
  assert.deepEqual(ko.rounds.SF[0].from, ['QF-1', 'QF-2']);
  assert.deepEqual(ko.rounds.F[0].from, ['SF-1', 'SF-2']);
  assert.equal(ko.rounds.F[0].match_id, '760517'); // the Final, not 3rd-place 760516
  assert.equal(ko.rounds.F[0].feeds, undefined);    // root has no parent
});

test('buildKnockout populates match_id + kickoff for every slot (cron needs them)', () => {
  const ko = buildKnockout(byRound);
  for (const round of ['R32', 'R16', 'QF', 'SF', 'F']) {
    for (const slot of ko.rounds[round]) {
      assert.ok(slot.match_id, `${slot.slot} missing match_id`);
      assert.ok(slot.kickoff_iso, `${slot.slot} missing kickoff_iso`);
    }
  }
  assert.equal(ko.first_kickoff_iso, '2026-06-28T10:00:00.000Z');
});

test('buildKnockout rejects a slot that feeds two parents', () => {
  const bad = { ...byRound, R16: [...byRound.R16] };
  bad.R16[1] = later('760503', ref('R32', 1), ref('R32', 5)); // R32#1 now feeds R16#1 and R16#2
  assert.throws(() => buildKnockout(bad), /feeds two parents/);
});

test('buildKnockout rejects a short round', () => {
  const bad = { ...byRound, QF: byRound.QF.slice(0, 3) };
  assert.throws(() => buildKnockout(bad), /Expected 4 QF/);
});
