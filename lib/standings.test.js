import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings } from './standings.js';

// Minimal fixtures shape: only the groups + matches we need for testing.
function makeFixtures(group, teams, matchIds) {
  return {
    groups: {
      [group]: { teams, matches: matchIds }
    },
    matches: Object.fromEntries(matchIds.map(id => [id, { group, home: null, away: null, kickoff_iso: '2026-06-11T00:00:00Z' }]))
  };
}

// Helper to build the 6 matches of a 4-team group with deterministic match IDs.
function fourTeamGroupFixtures(group, teams) {
  // Round-robin: m01..m06 pairings
  const matchIds = ['m01','m02','m03','m04','m05','m06'];
  const fixtures = makeFixtures(group, teams, matchIds);
  const [A, B, C, D] = teams;
  fixtures.matches.m01 = { group, home: A, away: B, kickoff_iso: '2026-06-11T00:00:00Z' };
  fixtures.matches.m02 = { group, home: C, away: D, kickoff_iso: '2026-06-11T00:00:00Z' };
  fixtures.matches.m03 = { group, home: A, away: C, kickoff_iso: '2026-06-11T00:00:00Z' };
  fixtures.matches.m04 = { group, home: B, away: D, kickoff_iso: '2026-06-11T00:00:00Z' };
  fixtures.matches.m05 = { group, home: A, away: D, kickoff_iso: '2026-06-11T00:00:00Z' };
  fixtures.matches.m06 = { group, home: B, away: C, kickoff_iso: '2026-06-11T00:00:00Z' };
  return fixtures;
}

test('strict ordering by points', () => {
  const fixtures = fourTeamGroupFixtures('A', ['AAA','BBB','CCC','DDD']);
  // AAA wins all 3, BBB wins 2, CCC wins 1, DDD wins 0
  const matches = {
    m01: { home_score: 1, away_score: 0 }, // AAA beats BBB
    m02: { home_score: 1, away_score: 0 }, // CCC beats DDD
    m03: { home_score: 1, away_score: 0 }, // AAA beats CCC
    m04: { home_score: 1, away_score: 0 }, // BBB beats DDD
    m05: { home_score: 1, away_score: 0 }, // AAA beats DDD
    m06: { home_score: 1, away_score: 0 }, // BBB beats CCC
  };
  const { standings, unresolvedTies } = computeStandings('A', matches, fixtures);
  assert.deepEqual(standings, ['AAA','BBB','CCC','DDD']);
  assert.deepEqual(unresolvedTies, []);
});

test('tie on points: head-to-head winner ranks first (here it also has the better GD)', () => {
  // AAA and BBB both 6 points, but AAA has +4 GD, BBB has +1 GD
  const fixtures = fourTeamGroupFixtures('A', ['AAA','BBB','CCC','DDD']);
  const matches = {
    m01: { home_score: 3, away_score: 0 }, // AAA 3-0 BBB
    m02: { home_score: 0, away_score: 0 }, // CCC 0-0 DDD
    m03: { home_score: 2, away_score: 0 }, // AAA 2-0 CCC
    m04: { home_score: 3, away_score: 1 }, // BBB 3-1 DDD
    m05: { home_score: 0, away_score: 1 }, // AAA 0-1 DDD (AAA loses one)
    m06: { home_score: 2, away_score: 0 }, // BBB 2-0 CCC
  };
  // AAA: 2W 1L = 6 pts, GF=5 GA=1, GD=+4
  // BBB: 2W 1L = 6 pts, GF=5 GA=4, GD=+1
  // DDD: 1W 1D 1L = 4 pts
  // CCC: 1D 2L = 1 pt
  const { standings } = computeStandings('A', matches, fixtures);
  assert.deepEqual(standings, ['AAA','BBB','DDD','CCC']);
});

test('FIFA 2026: overall goals scored breaks a tie only after head-to-head is level', () => {
  // AAA and BBB tie on points (7) AND overall goal difference (+3), and they
  // DREW head-to-head (so the head-to-head mini-table is level too). Only then
  // does the chain fall through to overall goals scored, where AAA (6) beat
  // BBB (4).
  const fixtures = fourTeamGroupFixtures('A', ['AAA','BBB','CCC','DDD']);
  const matches = {
    m01: { home_score: 1, away_score: 1 }, // AAA 1-1 BBB  (head-to-head draw)
    m02: { home_score: 3, away_score: 0 }, // CCC 3-0 DDD
    m03: { home_score: 3, away_score: 1 }, // AAA 3-1 CCC
    m04: { home_score: 2, away_score: 0 }, // BBB 2-0 DDD
    m05: { home_score: 2, away_score: 1 }, // AAA 2-1 DDD
    m06: { home_score: 1, away_score: 0 }, // BBB 1-0 CCC
  };
  // AAA: D W W = 7 pts, GF=6 GA=3, GD=+3
  // BBB: D W W = 7 pts, GF=4 GA=1, GD=+3
  // Head-to-head drawn 1-1 → level. Overall GD level (+3). Overall GF: AAA 6 > BBB 4.
  const { standings } = computeStandings('A', matches, fixtures);
  assert.deepEqual(standings, ['AAA','BBB','CCC','DDD']);
});

test('FIFA 2026: three teams tied on points are separated by the head-to-head mini-table', () => {
  // AAA, BBB, CCC each finish on 6 points (each beat DDD and split a cycle among
  // themselves). CCC has by far the best OVERALL goal difference (thrashed DDD
  // 9-0), so the old overall-GD-first rule would rank CCC first. But the 2026
  // rule resolves the tie via the mini-table among only the tied teams, where
  // AAA > BBB > CCC.
  const fixtures = fourTeamGroupFixtures('A', ['AAA','BBB','CCC','DDD']);
  const matches = {
    m01: { home_score: 3, away_score: 0 }, // AAA 3-0 BBB
    m02: { home_score: 9, away_score: 0 }, // CCC 9-0 DDD
    m03: { home_score: 0, away_score: 1 }, // AAA 0-1 CCC
    m04: { home_score: 1, away_score: 0 }, // BBB 1-0 DDD
    m05: { home_score: 1, away_score: 0 }, // AAA 1-0 DDD
    m06: { home_score: 2, away_score: 0 }, // BBB 2-0 CCC
  };
  // Totals: AAA 6, BBB 6, CCC 6, DDD 0.
  // Overall GD: AAA +3, BBB 0, CCC +8 (old rule would rank CCC first).
  // Mini-table among {AAA,BBB,CCC}: each 3 pts; mini GD AAA +2, BBB -1, CCC -1;
  // mini GF separates BBB (2) over CCC (1) → AAA > BBB > CCC.
  const { standings } = computeStandings('A', matches, fixtures);
  assert.deepEqual(standings, ['AAA','BBB','CCC','DDD']);
});

test('FIFA 2026: head-to-head winner outranks team with better overall goal difference', () => {
  // AAA and BBB both finish on 6 points. BBB has the better OVERALL goal
  // difference (+4 vs +3), but AAA beat BBB head-to-head. Under the 2026 rule
  // (head-to-head BEFORE overall GD) AAA must rank first.
  const fixtures = fourTeamGroupFixtures('A', ['AAA','BBB','CCC','DDD']);
  const matches = {
    m01: { home_score: 1, away_score: 0 }, // AAA 1-0 BBB  (AAA wins head-to-head)
    m02: { home_score: 1, away_score: 1 }, // CCC 1-1 DDD
    m03: { home_score: 0, away_score: 3 }, // AAA 0-3 CCC  (AAA loses big)
    m04: { home_score: 4, away_score: 0 }, // BBB 4-0 DDD
    m05: { home_score: 5, away_score: 0 }, // AAA 5-0 DDD
    m06: { home_score: 1, away_score: 0 }, // BBB 1-0 CCC
  };
  // AAA: W L W = 6 pts, GF=6 GA=3, GD=+3
  // BBB: L W W = 6 pts, GF=5 GA=1, GD=+4  (better overall GD)
  // Head-to-head: AAA beat BBB 1-0.
  const { standings } = computeStandings('A', matches, fixtures);
  assert.equal(standings[0], 'AAA');
  assert.equal(standings[1], 'BBB');
});

test('reports unresolvedTies when chain cannot separate teams', () => {
  // Two teams perfectly mirror each other: 0-0 head to head, same overall stats.
  const fixtures = fourTeamGroupFixtures('A', ['AAA','BBB','CCC','DDD']);
  const matches = {
    m01: { home_score: 0, away_score: 0 }, // AAA 0-0 BBB
    m02: { home_score: 1, away_score: 1 }, // CCC 1-1 DDD
    m03: { home_score: 1, away_score: 0 }, // AAA 1-0 CCC
    m04: { home_score: 1, away_score: 0 }, // BBB 1-0 DDD
    m05: { home_score: 0, away_score: 1 }, // AAA 0-1 DDD
    m06: { home_score: 0, away_score: 1 }, // BBB 0-1 CCC
  };
  // AAA: D W L = 4 pts, GF=1 GA=1, GD=0
  // BBB: D W L = 4 pts, GF=1 GA=1, GD=0
  // H2H AAA vs BBB: 0-0 → 1 pt each, 0 GD.
  // Truly tied.
  const { standings, unresolvedTies } = computeStandings('A', matches, fixtures);
  // AAA, BBB tied. CCC and DDD also identical (1D 1W 1L each for 4 pts; check by hand).
  // Just assert that AAA & BBB appear as a tied pair somewhere.
  const pair = unresolvedTies.find(t => t.includes('AAA') && t.includes('BBB'));
  assert.ok(pair, 'expected AAA and BBB to appear in unresolvedTies');
});

test('manualTiebreakers resolves previously-tied teams', () => {
  const fixtures = fourTeamGroupFixtures('A', ['AAA','BBB','CCC','DDD']);
  const matches = {
    m01: { home_score: 0, away_score: 0 },
    m02: { home_score: 1, away_score: 1 },
    m03: { home_score: 1, away_score: 0 },
    m04: { home_score: 1, away_score: 0 },
    m05: { home_score: 0, away_score: 1 },
    m06: { home_score: 0, away_score: 1 },
  };
  // Same data as the previous test. User says: AAA before BBB.
  const manual = { AAA: 1, BBB: 2 };
  const { standings, unresolvedTies } = computeStandings('A', matches, fixtures, manual);
  const aaaIdx = standings.indexOf('AAA');
  const bbbIdx = standings.indexOf('BBB');
  assert.ok(aaaIdx < bbbIdx, 'AAA should be ranked above BBB per manualTiebreakers');
  // The AAA/BBB pair should no longer be in unresolvedTies.
  const stillTied = unresolvedTies.find(t => t.includes('AAA') && t.includes('BBB'));
  assert.equal(stillTied, undefined);
});

test('manualTiebreakers does not affect teams not in a tie', () => {
  const fixtures = fourTeamGroupFixtures('A', ['AAA','BBB','CCC','DDD']);
  // Strict ordering by points, no ties.
  const matches = {
    m01: { home_score: 1, away_score: 0 },
    m02: { home_score: 1, away_score: 0 },
    m03: { home_score: 1, away_score: 0 },
    m04: { home_score: 1, away_score: 0 },
    m05: { home_score: 1, away_score: 0 },
    m06: { home_score: 1, away_score: 0 },
  };
  // Bogus manualTiebreakers payload shouldn't reorder anyone.
  const { standings } = computeStandings('A', matches, fixtures, { DDD: 1, AAA: 4 });
  assert.deepEqual(standings, ['AAA','BBB','CCC','DDD']);
});

test('re-invoking with changed scores returns fresh result (no hidden state)', () => {
  const fixtures = fourTeamGroupFixtures('A', ['AAA','BBB','CCC','DDD']);
  const matches1 = {
    m01: { home_score: 1, away_score: 0 },
    m02: { home_score: 1, away_score: 0 },
    m03: { home_score: 1, away_score: 0 },
    m04: { home_score: 1, away_score: 0 },
    m05: { home_score: 1, away_score: 0 },
    m06: { home_score: 1, away_score: 0 },
  };
  const r1 = computeStandings('A', matches1, fixtures);
  // Flip every match around.
  const matches2 = Object.fromEntries(
    Object.entries(matches1).map(([k, v]) => [k, { home_score: v.away_score, away_score: v.home_score }])
  );
  const r2 = computeStandings('A', matches2, fixtures);
  assert.notDeepEqual(r1.standings, r2.standings);
});
