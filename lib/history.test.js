// lib/history.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHistorySeries, rankMovements } from './history.js';

const fixtures = {
  groups: { A: { matches: ['m1'] } },
  matches: { m1: {} },
};
const knockout = { rounds: { R32: [], R16: [], QF: [], SF: [], F: [] } };

const submissions = [
  { email_hash: 'h1', name: 'Ana', phase: 'group',
    picks: { matches: { m1: { home_score: 1, away_score: 0 } }, group_standings: {} } },
  { email_hash: 'h2', name: 'Bo', phase: 'group',
    picks: { matches: { m1: { home_score: 3, away_score: 3 } }, group_standings: {} } },
];

// two snapshots: pre-result (nothing final), then m1 final 1-0 (Ana nails winner+exact)
const snapshots = [
  { t: '2026-06-11T20:00:00Z', results: { matches: { m1: { status: 'STATUS_SCHEDULED' } } } },
  { t: '2026-06-11T22:00:00Z', results: { matches: { m1: { home_score: 1, away_score: 0, status: 'STATUS_FULL_TIME' } } } },
];

test('buildHistorySeries computes per-entrant totals per snapshot', () => {
  const series = buildHistorySeries({ snapshots, submissions, fixtures, knockout });
  assert.equal(series.snapshots.length, 2);
  const s2 = series.snapshots[1].standings;
  const ana = s2.find((x) => x.email_hash === 'h1');
  const bo = s2.find((x) => x.email_hash === 'h2');
  assert.equal(ana.total, 6);  // correct winner (3) + exact (3)
  assert.equal(bo.total, 0);   // predicted 3-3 draw, actual 1-0
});

test('rankMovements ranks by total and reports delta from first scored snapshot', () => {
  const series = buildHistorySeries({ snapshots, submissions, fixtures, knockout });
  const moves = rankMovements(series);
  const ana = moves.find((x) => x.email_hash === 'h1');
  // First scored snapshot is snapshot 2; Ana is rank 1 there, Bo rank 2.
  assert.equal(ana.lastRank, 1);
  assert.equal(ana.firstRank, 1);
  assert.ok(ana.delta >= 0);
});

test('rankMovements assigns deterministic ranks to tied totals (name tiebreak)', () => {
  // Both entrants finish tied on total; rank must not depend on submission order.
  const subs = [
    { email_hash: 'hz', name: 'Zed', phase: 'group', picks: { matches: { m1: { home_score: 1, away_score: 0 } }, group_standings: {} } },
    { email_hash: 'ha', name: 'Amy', phase: 'group', picks: { matches: { m1: { home_score: 1, away_score: 0 } }, group_standings: {} } },
  ];
  const snaps = [
    { t: '2026-06-11T22:00:00Z', results: { matches: { m1: { home_score: 1, away_score: 0, status: 'STATUS_FULL_TIME' } } } },
  ];
  const s1 = buildHistorySeries({ snapshots: snaps, submissions: subs, fixtures, knockout });
  const s2 = buildHistorySeries({ snapshots: snaps, submissions: [...subs].reverse(), fixtures, knockout });
  const rankOf = (moves, h) => moves.find((x) => x.email_hash === h).lastRank;
  const m1r = rankMovements(s1);
  const m2r = rankMovements(s2);
  // Amy sorts ahead of Zed by name regardless of input order.
  assert.equal(rankOf(m1r, 'ha'), 1);
  assert.equal(rankOf(m2r, 'ha'), 1);
  assert.equal(rankOf(m1r, 'hz'), 2);
  assert.equal(rankOf(m2r, 'hz'), 2);
});
