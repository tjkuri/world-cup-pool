// lib/ceiling.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aliveTeams, maxReachablePoints } from './ceiling.js';

// Minimal 2-slot bracket: one R32 slot feeding a (degenerate) champion slot.
const knockout = {
  rounds: {
    R32: [
      { slot: 'r32-1', home: 'AAA', away: 'BBB', match_id: '1' },
      { slot: 'r32-2', home: 'CCC', away: 'DDD', match_id: '2' },
    ],
    R16: [], QF: [], SF: [],
    F: [{ slot: 'final', from: ['r32-1', 'r32-2'], match_id: '3' }],
  },
};

test('aliveTeams: losers of final matches are eliminated', () => {
  const results = { matches: {
    '1': { home_score: 2, away_score: 0, status: 'STATUS_FULL_TIME', advances: 'AAA' },
    '2': { home_score: 1, away_score: 3, status: 'STATUS_FULL_TIME', advances: 'DDD' },
  } };
  const alive = aliveTeams(knockout, results);
  assert.ok(alive.has('AAA'));
  assert.ok(alive.has('DDD'));
  assert.ok(!alive.has('BBB')); // lost r32-1
  assert.ok(!alive.has('CCC')); // lost r32-2
});

test('maxReachablePoints: adds champion points when picked champ still alive and final pending', () => {
  const results = { matches: {
    '1': { home_score: 2, away_score: 0, status: 'STATUS_FULL_TIME', advances: 'AAA' },
    '2': { home_score: 1, away_score: 3, status: 'STATUS_FULL_TIME', advances: 'DDD' },
    // final (match 3) NOT played yet
  } };
  const bracket = {
    'r32-1': { advances: 'AAA', home: 'AAA', away: 'BBB', home_score: 3, away_score: 1 },
    'r32-2': { advances: 'DDD', home: 'CCC', away: 'DDD', home_score: 2, away_score: 2 },
    'final': { advances: 'AAA', home: 'AAA', away: 'DDD', home_score: 1, away_score: 0 },
  };
  const { current, ceiling } = maxReachablePoints(bracket, knockout, results);
  // current: both R32 winners correct = 4 + 4 = 8. Final pending → champ not counted yet.
  assert.equal(current, 8);
  // ceiling: current + champion 128 (AAA still alive, final pending) = 136.
  assert.equal(ceiling, 136);
});

test('maxReachablePoints: does NOT add points for an eliminated picked advancer', () => {
  const results = { matches: {
    '1': { home_score: 0, away_score: 1, status: 'STATUS_FULL_TIME', advances: 'BBB' },
    '2': { home_score: 1, away_score: 3, status: 'STATUS_FULL_TIME', advances: 'DDD' },
  } };
  const bracket = {
    'r32-1': { advances: 'AAA', home: 'AAA', away: 'BBB', home_score: 2, away_score: 0 },
    'r32-2': { advances: 'DDD', home: 'CCC', away: 'DDD', home_score: 2, away_score: 2 },
    'final': { advances: 'AAA', home: 'AAA', away: 'DDD', home_score: 1, away_score: 0 },
  };
  const { current, ceiling } = maxReachablePoints(bracket, knockout, results);
  // current: r32-1 wrong (picked AAA, BBB advanced) = 0; r32-2 correct = 4.
  assert.equal(current, 4);
  // ceiling: AAA is eliminated → final champ points NOT addable → ceiling === current.
  assert.equal(ceiling, 4);
});
