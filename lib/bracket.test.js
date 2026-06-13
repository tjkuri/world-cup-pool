// lib/bracket.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KO_ROUND_ORDER, winnerCode, resolveMatchups, resolveActualBracket } from './bracket.js';

const knockout = {
  rounds: {
    R32: [
      { slot: 'R32-1', match_id: 'm1', home: 'BRA', away: 'KOR', feeds: 'R16-1' },
      { slot: 'R32-2', match_id: 'm2', home: 'MEX', away: 'GER', feeds: 'R16-1' },
    ],
    R16: [{ slot: 'R16-1', match_id: 'm3', from: ['R32-1', 'R32-2'], feeds: 'F-1' }],
    F: [{ slot: 'F-1', match_id: 'm4', from: ['R16-1'] }], // single-feeder for test simplicity
  },
};

test('KO_ROUND_ORDER is R32→F', () => {
  assert.deepEqual(KO_ROUND_ORDER, ['R32', 'R16', 'QF', 'SF', 'F']);
});

test('winnerCode returns the higher-scoring side, null on tie', () => {
  assert.equal(winnerCode('BRA', 'KOR', 2, 1), 'BRA');
  assert.equal(winnerCode('BRA', 'KOR', 1, 2), 'KOR');
  assert.equal(winnerCode('BRA', 'KOR', 1, 1), null);
});

test('resolveMatchups fills R32 from knockout and later rounds from advancers', () => {
  const advancer = (slot) => ({ 'R32-1': 'BRA', 'R32-2': 'GER', 'R16-1': 'BRA' }[slot] ?? null);
  const teams = resolveMatchups(knockout, advancer);
  assert.deepEqual(teams['R32-1'], { home: 'BRA', away: 'KOR' });
  assert.deepEqual(teams['R16-1'], { home: 'BRA', away: 'GER' });
  assert.deepEqual(teams['F-1'], { home: 'BRA', away: null }); // single feeder
});

test('resolveActualBracket walks results, using advances field then score', () => {
  const results = { matches: {
    m1: { home_score: 2, away_score: 1, status: 'STATUS_FULL_TIME' },          // BRA by score
    m2: { home_score: 1, away_score: 1, status: 'STATUS_FULL_TIME', advances: 'GER' }, // pens → GER
    m3: { home_score: 0, away_score: 0, status: 'STATUS_SCHEDULED' },          // pending
  }};
  const { advancers, matchInfo } = resolveActualBracket(knockout, results);
  assert.equal(advancers['R32-1'], 'BRA');
  assert.equal(advancers['R32-2'], 'GER');
  assert.equal(advancers['R16-1'], null);            // m3 pending
  assert.equal(matchInfo['R16-1'].home, 'BRA');      // teams resolved from R32 advancers
  assert.equal(matchInfo['R16-1'].away, 'GER');
  assert.equal(matchInfo['R16-1'].final, false);
});
