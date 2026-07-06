// lib/consensus.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickConsensus, contrarianCorrect, contrarianCorrectMatches, chalkScore, upsetScore } from './consensus.js';

const fixtures = { matches: { m1: {}, m2: {} } };
// 3 entrants: two pick m1 home (2-0), one picks m1 away (0-1). m2: all draw.
const subs = [
  { phase:'group', picks:{ matches:{ m1:{home_score:2,away_score:0}, m2:{home_score:1,away_score:1} }, group_standings:{} } },
  { phase:'group', picks:{ matches:{ m1:{home_score:1,away_score:0}, m2:{home_score:0,away_score:0} }, group_standings:{} } },
  { phase:'group', picks:{ matches:{ m1:{home_score:0,away_score:1}, m2:{home_score:2,away_score:2} }, group_standings:{} } },
];

test('pickConsensus tallies outcomes and modal share', () => {
  const c = pickConsensus(subs, fixtures);
  const m1 = c.get('m1');
  assert.equal(m1.home, 2); assert.equal(m1.away, 1); assert.equal(m1.draw, 0);
  assert.equal(m1.modal, 'home');
  assert.ok(Math.abs(m1.share - 2/3) < 1e-9);
});

test('contrarianCorrect counts correct low-consensus picks only', () => {
  const c = pickConsensus(subs, fixtures);
  const results = { matches: { m1:{home_score:0,away_score:1,status:'STATUS_FULL_TIME'} } }; // away wins
  // entrant 3 predicted away (share 1/3 < 0.34) AND correct → counts 1.
  assert.equal(contrarianCorrect(subs[2], fixtures, results, c), 1);
  // entrant 1 predicted home (wrong) → 0.
  assert.equal(contrarianCorrect(subs[0], fixtures, results, c), 0);
});

test('chalkScore counts picks matching the odds favorite', () => {
  const odds = { matches: { m1:{home_implied:0.6,draw_implied:0.2,away_implied:0.2}, m2:{home_implied:0.2,draw_implied:0.5,away_implied:0.3} } };
  // entrant 1: m1 home == favorite(home) ✓, m2 draw == favorite(draw) ✓ → 2
  assert.equal(chalkScore(subs[0], fixtures, odds), 2);
  // entrant 3: m1 away (fav home) ✗, m2 draw (fav draw) ✓ → 1
  assert.equal(chalkScore(subs[2], fixtures, odds), 1);
});

test('contrarianCorrect excludes correct BUT high-consensus picks (threshold gate)', () => {
  const c = pickConsensus(subs, fixtures);
  const results = { matches: { m1: { home_score: 2, away_score: 0, status: 'STATUS_FULL_TIME' } } }; // home wins
  // subs[0] and subs[1] both predicted home (correct) but home's share is 2/3 > 0.34 → NOT contrarian → 0.
  assert.equal(contrarianCorrect(subs[0], fixtures, results, c), 0);
  assert.equal(contrarianCorrect(subs[1], fixtures, results, c), 0);
  // subs[2] predicted away (wrong, actual is home) → 0.
  assert.equal(contrarianCorrect(subs[2], fixtures, results, c), 0);
});

test('contrarianCorrectMatches returns the qualifying match detail; contrarianCorrect is its length', () => {
  const c = pickConsensus(subs, fixtures);
  const results = { matches: { m1:{home_score:0,away_score:1,status:'STATUS_FULL_TIME'} } }; // away wins
  const matches = contrarianCorrectMatches(subs[2], fixtures, results, c);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].matchId, 'm1');
  assert.ok(Math.abs(matches[0].share - 1/3) < 1e-9);
  assert.equal(contrarianCorrect(subs[2], fixtures, results, c), matches.length);
});

test('upsetScore counts correct underdog calls with a clear gap only', () => {
  // m1: away heavy favorite (0.6) vs home underdog (0.2), gap 0.4 → real upset if home wins.
  // m2: near-even (0.45 vs 0.40), gap 0.05 < 0.10 → excluded even if an underdog wins.
  const odds = { matches: {
    m1: { home_implied: 0.2, draw_implied: 0.2, away_implied: 0.6 },
    m2: { home_implied: 0.45, draw_implied: 0.15, away_implied: 0.40 },
  } };
  const results = { matches: {
    m1: { home_score: 1, away_score: 0, status: 'STATUS_FULL_TIME' }, // home (underdog) wins → upset
    m2: { home_score: 0, away_score: 1, status: 'STATUS_FULL_TIME' }, // away underdog wins but gap too small
  } };
  // subs[0]: m1 picked home (2-0 → home = underdog), correct → 1; m2 draw → not an underdog win → 0.
  assert.equal(upsetScore(subs[0], fixtures, odds, results), 1);
  // subs[2]: m1 picked away (0-1 → favorite) → 0; m2 draw pick → 0.
  assert.equal(upsetScore(subs[2], fixtures, odds, results), 0);
});
