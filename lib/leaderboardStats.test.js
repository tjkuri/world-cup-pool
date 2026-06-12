import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  partitionFinishedMatches,
  computeMatchSummary,
  computeMostExact,
  computeLeadStat,
  computeLatestMatchTop,
} from './leaderboardStats.js';

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

function entryWith(matchPoints, picks) {
  return { scoring: { match_points: matchPoints }, picks: { matches: picks } };
}

test('computeMatchSummary counts exact, winner, and consensus pick', () => {
  const entries = [
    entryWith({ m1: 6 }, { m1: { home_score: 2, away_score: 0 } }),
    entryWith({ m1: 6 }, { m1: { home_score: 2, away_score: 0 } }),
    entryWith({ m1: 3 }, { m1: { home_score: 2, away_score: 1 } }),
    entryWith({ m1: 0 }, { m1: { home_score: 1, away_score: 1 } }),
  ];
  const s = computeMatchSummary('m1', entries);
  assert.equal(s.exactCount, 2);
  assert.equal(s.winnerCount, 3);
  assert.equal(s.totalCount, 4);
  assert.equal(s.consensus, '2-0');
});

test('computeMatchSummary returns null consensus on a top-tie', () => {
  const entries = [
    entryWith({ m1: 6 }, { m1: { home_score: 2, away_score: 0 } }),
    entryWith({ m1: 6 }, { m1: { home_score: 2, away_score: 1 } }),
  ];
  const s = computeMatchSummary('m1', entries);
  assert.equal(s.consensus, null);
});

test('computeMatchSummary tolerates entries with no pick for the match', () => {
  const entries = [
    { scoring: { match_points: {} }, picks: { matches: {} } },
  ];
  const s = computeMatchSummary('m1', entries);
  assert.equal(s.exactCount, 0);
  assert.equal(s.winnerCount, 0);
  assert.equal(s.totalCount, 1);
  assert.equal(s.consensus, null);
});

function statEntry(name, total, exact, matchPoints = {}) {
  return {
    name,
    scoring: { total, exact_score_count: exact, match_points: matchPoints },
  };
}

test('computeMostExact returns single leader', () => {
  const entries = [statEntry('Alice', 10, 3), statEntry('Bob', 8, 1)];
  const r = computeMostExact(entries);
  assert.equal(r.count, 3);
  assert.deepEqual(r.names, ['Alice']);
  assert.equal(r.label, 'Alice (3 exact)');
});

test('computeMostExact lists ties up to 2 names then "and N others"', () => {
  const entries = [
    statEntry('Charlie', 10, 2),
    statEntry('Alice', 10, 2),
    statEntry('Bob', 10, 2),
    statEntry('Dave', 10, 2),
  ];
  const r = computeMostExact(entries);
  assert.equal(r.label, 'Alice, Bob and 2 others (2 exact)');
});

test('computeLeadStat formats gap-over-runner-up', () => {
  const entries = [statEntry('Alice', 15, 2), statEntry('Bob', 10, 1)];
  const r = computeLeadStat(entries);
  assert.equal(r.label, 'Alice +5 over Bob');
});

test('computeLeadStat formats N-way tie at top', () => {
  const entries = [statEntry('Alice', 15, 2), statEntry('Bob', 15, 1), statEntry('Carol', 15, 1)];
  const r = computeLeadStat(entries);
  assert.equal(r.label, '3-way tie at 15 pts');
});

test('computeLatestMatchTop picks the latest finished match', () => {
  const fixtures = {
    matches: {
      'old': { kickoff_iso: '2026-06-11T19:00Z', home: 'MEX', away: 'RSA', group: 'A' },
      'new': { kickoff_iso: '2026-06-12T02:00Z', home: 'KOR', away: 'CZE', group: 'A' },
      'pending': { kickoff_iso: '2026-06-13T19:00Z', home: 'BIH', away: 'CAN', group: 'B' },
    },
  };
  const results = {
    matches: {
      'old': { home_score: 2, away_score: 0, status: 'STATUS_FULL_TIME' },
      'new': { home_score: 2, away_score: 1, status: 'STATUS_FULL_TIME' },
      'pending': { status: 'STATUS_SCHEDULED' },
    },
  };
  const entries = [
    statEntry('Alice', 12, 2, { 'new': 6, 'old': 6 }),
    statEntry('Bob', 9, 1, { 'new': 3, 'old': 6 }),
  ];
  const r = computeLatestMatchTop(entries, fixtures, results);
  assert.equal(r.matchId, 'new');
  assert.equal(r.name, 'Alice');
  assert.equal(r.points, 6);
  assert.equal(r.matchLabel, 'KOR 2-1 CZE');
  assert.equal(r.label, 'Alice +6');
});

test('computeLatestMatchTop returns null when nothing is finished', () => {
  const fixtures = { matches: { 'x': { kickoff_iso: '2026-06-13T19:00Z', home: 'A', away: 'B' } } };
  const results = { matches: { 'x': { status: 'STATUS_SCHEDULED' } } };
  const r = computeLatestMatchTop([statEntry('Alice', 0, 0)], fixtures, results);
  assert.equal(r, null);
});
