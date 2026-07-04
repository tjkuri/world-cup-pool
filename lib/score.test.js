import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSubmission, scoreBracket, scoreKnockoutMatch } from './score.js';

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

test('STATUS_FULL_TIME counts the same as STATUS_FINAL (ESPN soccer)', () => {
  const fixtures = singleGroupFixtures();
  const submission = {
    matches: { m01: { home_score: 2, away_score: 0 } },
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
  const results = { matches: { m01: { home_score: 2, away_score: 0, status: 'STATUS_FULL_TIME' } } };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.match_points.m01, 6);
  assert.equal(r.exact_score_count, 1);
});

test('group standings score when all 6 matches are STATUS_FULL_TIME', () => {
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
  const results = { matches: Object.fromEntries(Object.entries(allWin).map(([k, v]) => [k, { ...v, status: 'STATUS_FULL_TIME' }])) };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.group_points.A.subtotal, 35);
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

const KO = {
  rounds: {
    R32: [
      { slot: 'R32-1', match_id: 'a', home: 'BRA', away: 'KOR', feeds: 'R16-1' },
      { slot: 'R32-2', match_id: 'b', home: 'MEX', away: 'GER', feeds: 'R16-1' },
      { slot: 'R32-3', match_id: 'c', home: 'FRA', away: 'SUI', feeds: 'R16-2' },
      { slot: 'R32-4', match_id: 'd', home: 'ARG', away: 'NGA', feeds: 'R16-2' },
    ],
    R16: [
      { slot: 'R16-1', match_id: 'e', from: ['R32-1', 'R32-2'], feeds: 'SF-1' },
      { slot: 'R16-2', match_id: 'f', from: ['R32-3', 'R32-4'], feeds: 'SF-1' },
    ],
    SF: [{ slot: 'SF-1', match_id: 'g', from: ['R16-1', 'R16-2'], feeds: 'F-1' }],
    F: [{ slot: 'F-1', match_id: 'h', from: ['SF-1'] }],
  },
};

// Helper to build a fully-final results set where the listed code advances each slot.
function results(map) {
  const matches = {};
  for (const [mid, [hs, as_, adv]] of Object.entries(map)) {
    matches[mid] = { home_score: hs, away_score: as_, status: 'STATUS_FULL_TIME', advances: adv };
  }
  return { matches };
}

test('scoreBracket awards round-winner points per correct slot advancer', () => {
  const bracket = {
    'R32-1': { home: 'BRA', away: 'KOR', home_score: 2, away_score: 0, advances: 'BRA' },
    'R32-2': { home: 'MEX', away: 'GER', home_score: 0, away_score: 1, advances: 'GER' },
    'R32-3': { home: 'FRA', away: 'SUI', home_score: 1, away_score: 0, advances: 'FRA' },
    'R32-4': { home: 'ARG', away: 'NGA', home_score: 2, away_score: 0, advances: 'ARG' },
    'R16-1': { home: 'BRA', away: 'GER', home_score: 1, away_score: 0, advances: 'BRA' },
    'R16-2': { home: 'FRA', away: 'ARG', home_score: 0, away_score: 1, advances: 'ARG' },
    'SF-1': { home: 'BRA', away: 'ARG', home_score: 1, away_score: 0, advances: 'BRA' },
    'F-1': { home: 'BRA', away: null, home_score: 1, away_score: 0, advances: 'BRA' },
  };
  const r = results({
    a: [2, 0, 'BRA'], b: [0, 1, 'GER'], c: [1, 0, 'FRA'], d: [2, 0, 'ARG'],
    e: [1, 0, 'BRA'], f: [0, 1, 'ARG'], g: [1, 0, 'BRA'], h: [1, 0, 'BRA'],
  });
  const s = scoreBracket(bracket, KO, r);
  // 4 R32 correct ×4 = 16; 2 R16 correct ×16 = 32; 1 SF correct ×64 = 64
  assert.equal(s.round_totals.R32, 16);
  assert.equal(s.round_totals.R16, 32);
  assert.equal(s.round_totals.SF, 64);
  assert.equal(s.champion_points, 128);         // F advancer BRA, picked BRA
  // finalist scoring removed: the field is gone from the return object
  assert.equal(s.finalist_points, undefined);
});

test('scoreBracket exact-score bonus is +3, +5 on the final (matchup + score correct)', () => {
  // Two R32 slots feeding a real two-team final so the final's matchup resolves.
  const ko = {
    rounds: {
      R32: [
        { slot: 'R32-1', match_id: 'a', home: 'BRA', away: 'KOR', feeds: 'F-1' },
        { slot: 'R32-2', match_id: 'b', home: 'ARG', away: 'NGA', feeds: 'F-1' },
      ],
      F: [{ slot: 'F-1', match_id: 'h', from: ['R32-1', 'R32-2'] }],
    },
  };
  const bracket = {
    'R32-1': { home: 'BRA', away: 'KOR', home_score: 2, away_score: 1, advances: 'BRA' }, // exact +3
    'F-1':   { home: 'BRA', away: 'ARG', home_score: 1, away_score: 1, advances: 'BRA' }, // exact final +5
  };
  const r = results({
    a: [2, 1, 'BRA'],   // R32-1 → BRA, 2-1 matches
    b: [0, 1, 'ARG'],   // R32-2 → ARG, so the final is BRA vs ARG
    h: [1, 1, 'BRA'],   // final 1-1 (BRA on pens) matches predicted 1-1 → +5
  });
  const s = scoreBracket(bracket, ko, r);
  assert.equal(s.exact_bonus, 8);     // 3 + 5
  assert.equal(s.exact_count, 2);
});

test('scoreBracket exact bonus: needs the real matchup; draw forgives the pens pick', () => {
  const ko = {
    rounds: {
      R32: [
        { slot: 'R32-1', match_id: 'a', home: 'BRA', away: 'KOR', feeds: 'R16-1' },
        { slot: 'R32-2', match_id: 'b', home: 'ARG', away: 'NGA', feeds: 'R16-1' },
      ],
      R16: [{ slot: 'R16-1', match_id: 'e', from: ['R32-1', 'R32-2'] }],
    },
  };
  const r = results({
    a: [1, 1, 'KOR'],   // R32-1 draw 1-1, KOR through on pens
    b: [2, 0, 'ARG'],   // R32-2 → ARG, so R16 actual matchup is KOR vs ARG
    e: [2, 1, 'KOR'],   // R16 KOR beats ARG 2-1
  });

  // A: R32-1 draw, right teams, called BRA on pens (wrong) → exact +3 anyway;
  //    R16-1 predicted BRA vs ARG (BRA never advanced) 2-1 → wrong matchup, no exact.
  const a = scoreBracket({
    'R32-1': { home: 'BRA', away: 'KOR', home_score: 1, away_score: 1, advances: 'BRA' },
    'R16-1': { home: 'BRA', away: 'ARG', home_score: 2, away_score: 1, advances: 'BRA' },
  }, ko, r);
  assert.equal(a.exact_count, 1);            // only the draw
  assert.equal(a.exact_bonus, 3);
  assert.equal(a.round_totals.R32, 0);       // lost the shootout → no winner points

  // B: R16-1 predicted the real matchup KOR vs ARG 2-1, advances KOR → full exact.
  const b = scoreBracket({
    'R16-1': { home: 'KOR', away: 'ARG', home_score: 2, away_score: 1, advances: 'KOR' },
  }, ko, r);
  assert.equal(b.exact_count, 1);
  assert.equal(b.exact_bonus, 3);
});

test('scoreBracket: busted champion still scores correct later slots; pending excluded', () => {
  const bracket = {
    'R32-1': { home: 'BRA', away: 'KOR', home_score: 1, away_score: 0, advances: 'BRA' },
    'R16-1': { home: 'BRA', away: 'GER', home_score: 1, away_score: 0, advances: 'BRA' },
  };
  const r = results({ a: [0, 1, 'KOR'] }); // R32-1 wrong; e (R16) pending (absent)
  const ko = { rounds: { R32: [KO.rounds.R32[0]], R16: [KO.rounds.R16[0]] } };
  const s = scoreBracket(bracket, ko, r);
  assert.equal(s.round_totals.R32, 0);   // wrong advancer
  assert.equal(s.bracket_total, 0);      // R16 pending → no points yet
});

test('scoreKnockoutMatch: winner + exact, champion on final, pending when not final', () => {
  const actual = { home: 'BRA', away: 'ARG', home_score: 2, away_score: 1, advances: 'BRA', final: true };
  const P = { home: 'BRA', away: 'ARG' }; // right matchup for all decisive cases below
  // R16 correct advancer + exact score → 16 + 3
  const r16 = scoreKnockoutMatch('R16', { ...P, home_score: 2, away_score: 1, advances: 'BRA' }, actual);
  assert.deepEqual(r16, { points: 19, winnerPoints: 16, exactBonus: 3, correctAdvancer: true, exact: true, pending: false });
  // QF correct advancer, wrong score → 32
  assert.equal(scoreKnockoutMatch('QF', { ...P, home_score: 3, away_score: 0, advances: 'BRA' }, actual).points, 32);
  // wrong advancer → 0
  assert.equal(scoreKnockoutMatch('R32', { ...P, home_score: 0, away_score: 1, advances: 'ARG' }, actual).points, 0);
  // final winner = champion 128 + exact-final 5 → 133
  assert.equal(scoreKnockoutMatch('F', { ...P, home_score: 2, away_score: 1, advances: 'BRA' }, actual).points, 133);
  // decisive game, right score but WRONG advancer → no exact bonus
  const wrongAdv = scoreKnockoutMatch('QF', { ...P, home_score: 2, away_score: 1, advances: 'ARG' }, actual);
  assert.equal(wrongAdv.exact, false);
  assert.equal(wrongAdv.points, 0);
  // right score but WRONG matchup (opponent wasn't in the game) → no exact bonus
  const wrongTeams = scoreKnockoutMatch('QF', { home: 'BRA', away: 'GER', home_score: 2, away_score: 1, advances: 'BRA' }, actual);
  assert.equal(wrongTeams.exact, false);
  assert.equal(wrongTeams.points, 32); // winner points still stand (called BRA)
  // not final → pending, no points
  assert.equal(scoreKnockoutMatch('SF', { advances: 'BRA' }, { final: false }).pending, true);
});

test('scoreKnockoutMatch: a draw forgives the pens pick — exact score still scores', () => {
  const actual = { home: 'BRA', away: 'ARG', home_score: 1, away_score: 1, advances: 'ARG', final: true }; // ARG on pens
  // Right teams + right 1-1, but called BRA on pens (lost the shootout):
  const m = scoreKnockoutMatch('R16', { home: 'BRA', away: 'ARG', home_score: 1, away_score: 1, advances: 'BRA' }, actual);
  assert.equal(m.exact, true);            // scoreline bonus survives the coin flip
  assert.equal(m.correctAdvancer, false); // but no winner points
  assert.equal(m.winnerPoints, 0);
  assert.equal(m.points, 3);              // exact bonus only
  // Same draw + scoreline but WRONG opponent → no bonus (predicted a different game).
  const wrongTeams = scoreKnockoutMatch('R16', { home: 'BRA', away: 'GER', home_score: 1, away_score: 1, advances: 'BRA' }, actual);
  assert.equal(wrongTeams.exact, false);
  assert.equal(wrongTeams.points, 0);
});
