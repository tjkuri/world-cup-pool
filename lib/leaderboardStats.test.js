import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partitionFinishedMatches } from './leaderboardStats.js';

// Use noon-UTC anchors so .toDateString() lands on the same calendar day
// across most TZs (anything tighter than UTC±12 is consistent).
const fixtures = {
  matches: {
    'a': { kickoff_iso: '2026-06-12T12:00:00Z', home: 'KOR', away: 'CZE', group: 'A' },
    'b': { kickoff_iso: '2026-06-11T12:00:00Z', home: 'MEX', away: 'RSA', group: 'A' },
    'c': { kickoff_iso: '2026-06-10T12:00:00Z', home: 'OLD', away: 'MATCH', group: 'B' },
    'd': { kickoff_iso: '2026-06-12T12:00:00Z', home: 'NOT', away: 'YET', group: 'B' },
  },
};
const results = {
  matches: {
    'a': { home_score: 2, away_score: 1, status: 'STATUS_FULL_TIME' },
    'b': { home_score: 2, away_score: 0, status: 'STATUS_FULL_TIME' },
    'c': { home_score: 1, away_score: 0, status: 'STATUS_FULL_TIME' },
    'd': { home_score: 0, away_score: 0, status: 'STATUS_SCHEDULED' },
  },
};

test('partitionFinishedMatches buckets by today / yesterday / older', () => {
  const refDate = new Date('2026-06-12T12:00:00Z');
  const part = partitionFinishedMatches(fixtures, results, refDate);
  assert.deepEqual(part.today, ['a']);
  assert.deepEqual(part.yesterday, ['b']);
  assert.deepEqual(part.older, ['c']);
});

test('partitionFinishedMatches excludes non-final matches', () => {
  const refDate = new Date('2026-06-12T12:00:00Z');
  const part = partitionFinishedMatches(fixtures, results, refDate);
  const all = [...part.today, ...part.yesterday, ...part.older];
  assert.equal(all.includes('d'), false);
});

test('partitionFinishedMatches returns empty buckets when nothing finished', () => {
  const allScheduled = {
    matches: { 'a': { status: 'STATUS_SCHEDULED' } },
  };
  const part = partitionFinishedMatches(fixtures, allScheduled, new Date('2026-06-12T12:00:00Z'));
  assert.deepEqual(part, { today: [], yesterday: [], older: [] });
});
