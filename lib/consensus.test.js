// lib/consensus.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickConsensus, contrarianCorrect, chalkScore } from './consensus.js';

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
