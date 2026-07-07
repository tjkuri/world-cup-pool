import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exactCountHistogram } from './distributions.js';

const fixtures = { groups: {}, matches: { m1: {}, m2: {} } };
const knockout = { rounds: { R32: [], R16: [], QF: [], SF: [], F: [] } };
const results = { matches: {
  m1: { home_score: 1, away_score: 0, status: 'STATUS_FULL_TIME' },
  m2: { home_score: 2, away_score: 2, status: 'STATUS_FULL_TIME' },
} };

const subs = [
  // 2 exacts: nails m1 (1-0) and m2 (2-2)
  { email_hash: 'a', phase: 'group', picks: { matches: { m1: { home_score: 1, away_score: 0 }, m2: { home_score: 2, away_score: 2 } }, group_standings: {} } },
  // 1 exact: nails m1 only
  { email_hash: 'b', phase: 'group', picks: { matches: { m1: { home_score: 1, away_score: 0 }, m2: { home_score: 0, away_score: 0 } }, group_standings: {} } },
  // 0 exacts
  { email_hash: 'c', phase: 'group', picks: { matches: { m1: { home_score: 3, away_score: 3 }, m2: { home_score: 1, away_score: 0 } }, group_standings: {} } },
];

test('exactCountHistogram buckets entrants by their whole-tournament exact count', () => {
  const h = exactCountHistogram(subs, fixtures, results, knockout);
  assert.deepEqual(h, [
    { exact: 0, players: 1 },
    { exact: 1, players: 1 },
    { exact: 2, players: 1 },
  ]);
});

test('exactCountHistogram returns [] for no submissions', () => {
  assert.deepEqual(exactCountHistogram([], fixtures, results, knockout), []);
});
