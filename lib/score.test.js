import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSubmission } from './score.js';

// Build a single-group fixtures object for testing.
function singleGroupFixtures() {
  return {
    groups: {
      A: { teams: ['AAA','BBB','CCC','DDD'], matches: ['m01','m02','m03','m04','m05','m06'] }
    },
    matches: {
      m01: { group: 'A', home: 'AAA', away: 'BBB', kickoff_iso: '2026-06-11T00:00:00Z' },
      m02: { group: 'A', home: 'CCC', away: 'DDD', kickoff_iso: '2026-06-11T00:00:00Z' },
      m03: { group: 'A', home: 'AAA', away: 'CCC', kickoff_iso: '2026-06-11T00:00:00Z' },
      m04: { group: 'A', home: 'BBB', away: 'DDD', kickoff_iso: '2026-06-11T00:00:00Z' },
      m05: { group: 'A', home: 'AAA', away: 'DDD', kickoff_iso: '2026-06-11T00:00:00Z' },
      m06: { group: 'A', home: 'BBB', away: 'CCC', kickoff_iso: '2026-06-11T00:00:00Z' },
    }
  };
}

function finalResult(home_score, away_score) {
  return { home_score, away_score, status: 'STATUS_FINAL' };
}

function pendingResult() {
  return { status: 'STATUS_SCHEDULED' };
}

test('correct winner, wrong score = 3 pts', () => {
  const fixtures = singleGroupFixtures();
  const submission = {
    matches: { m01: { home_score: 2, away_score: 1 } },
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
  const results = { matches: { m01: finalResult(1, 0) } };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.match_points.m01, 3);
  assert.equal(r.match_total, 3);
});

test('correct exact score = 6 pts (3 + 3 bonus)', () => {
  const fixtures = singleGroupFixtures();
  const submission = {
    matches: { m01: { home_score: 1, away_score: 0 } },
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
  const results = { matches: { m01: finalResult(1, 0) } };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.match_points.m01, 6);
  assert.equal(r.exact_score_count, 1);
});

test('wrong winner = 0 pts', () => {
  const fixtures = singleGroupFixtures();
  const submission = {
    matches: { m01: { home_score: 0, away_score: 2 } },
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
  const results = { matches: { m01: finalResult(1, 0) } };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.match_points.m01, 0);
  assert.equal(r.match_total, 0);
});

test('predicted draw matches actual draw exact score = 6 pts', () => {
  const fixtures = singleGroupFixtures();
  const submission = {
    matches: { m01: { home_score: 1, away_score: 1 } },
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
  const results = { matches: { m01: finalResult(1, 1) } };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.match_points.m01, 6);
});

test('predicted draw, actual draw but different score = 3 pts', () => {
  const fixtures = singleGroupFixtures();
  const submission = {
    matches: { m01: { home_score: 1, away_score: 1 } },
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
  const results = { matches: { m01: finalResult(2, 2) } };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.match_points.m01, 3);
});

test('pending matches contribute 0 to match_total but are not "wrong"', () => {
  const fixtures = singleGroupFixtures();
  const submission = {
    matches: {
      m01: { home_score: 1, away_score: 0 },
      m02: { home_score: 2, away_score: 1 },
    },
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
  const results = { matches: { m01: finalResult(1, 0), m02: pendingResult() } };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.match_points.m01, 6);
  assert.equal(r.match_points.m02, undefined); // pending -> no entry
  assert.equal(r.match_total, 6);
});

test('group standings only score when all 6 matches are STATUS_FINAL', () => {
  const fixtures = singleGroupFixtures();
  const submission = {
    matches: {
      m01: { home_score: 1, away_score: 0 },
      m02: { home_score: 1, away_score: 0 },
      m03: { home_score: 1, away_score: 0 },
      m04: { home_score: 1, away_score: 0 },
      m05: { home_score: 1, away_score: 0 },
      // m06 omitted
    },
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
  const results = {
    matches: {
      m01: finalResult(1, 0),
      m02: finalResult(1, 0),
      m03: finalResult(1, 0),
      m04: finalResult(1, 0),
      m05: finalResult(1, 0),
      m06: pendingResult(),
    }
  };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.group_total, 0);
  assert.equal(r.group_points.A, undefined); // pending group -> no entry
});

test('all 3 positions correct + perfect bonus = 35 pts', () => {
  const fixtures = singleGroupFixtures();
  // AAA wins everything; BBB second; CCC third; DDD last.
  const allWin = {
    m01: { home_score: 1, away_score: 0 }, // AAA 1-0 BBB
    m02: { home_score: 1, away_score: 0 }, // CCC 1-0 DDD
    m03: { home_score: 1, away_score: 0 }, // AAA 1-0 CCC
    m04: { home_score: 1, away_score: 0 }, // BBB 1-0 DDD
    m05: { home_score: 1, away_score: 0 }, // AAA 1-0 DDD
    m06: { home_score: 1, away_score: 0 }, // BBB 1-0 CCC
  };
  const submission = {
    matches: allWin,
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
  const results = { matches: Object.fromEntries(Object.entries(allWin).map(([k, v]) => [k, { ...v, status: 'STATUS_FINAL' }])) };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.group_points.A.first, 15);
  assert.equal(r.group_points.A.second, 8);
  assert.equal(r.group_points.A.third, 4);
  assert.equal(r.group_points.A.perfect, 8);
  assert.equal(r.group_points.A.subtotal, 35);
});

test('1st correct, 2nd/3rd swapped: 15 pts, no perfect bonus', () => {
  const fixtures = singleGroupFixtures();
  const allWin = {
    m01: { home_score: 1, away_score: 0 },
    m02: { home_score: 1, away_score: 0 },
    m03: { home_score: 1, away_score: 0 },
    m04: { home_score: 1, away_score: 0 },
    m05: { home_score: 1, away_score: 0 },
    m06: { home_score: 1, away_score: 0 },
  };
  const submission = {
    matches: allWin,
    group_standings: { A: ['AAA','CCC','BBB','DDD'] } // 1st right, 2nd+3rd swapped, 4th not scored
  };
  const results = { matches: Object.fromEntries(Object.entries(allWin).map(([k, v]) => [k, { ...v, status: 'STATUS_FINAL' }])) };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.group_points.A.first, 15);
  assert.equal(r.group_points.A.second, 0);
  assert.equal(r.group_points.A.third, 0);
  assert.equal(r.group_points.A.perfect, 0);
  assert.equal(r.group_points.A.subtotal, 15);
});

test('total = match_total + group_total: max single group = 71 pts', () => {
  const fixtures = singleGroupFixtures();
  const allWin = {
    m01: { home_score: 1, away_score: 0 },
    m02: { home_score: 1, away_score: 0 },
    m03: { home_score: 1, away_score: 0 },
    m04: { home_score: 1, away_score: 0 },
    m05: { home_score: 1, away_score: 0 },
    m06: { home_score: 1, away_score: 0 },
  };
  const submission = { matches: allWin, group_standings: { A: ['AAA','BBB','CCC','DDD'] } };
  const results = { matches: Object.fromEntries(Object.entries(allWin).map(([k, v]) => [k, { ...v, status: 'STATUS_FINAL' }])) };
  const r = scoreSubmission(submission, fixtures, results);
  // All 6 matches scored exactly: 6 * 6 = 36. Group total: 35. Total: 71.
  assert.equal(r.match_total, 36);
  assert.equal(r.group_total, 35);
  assert.equal(r.total, 71);
});
