// Dev-only fixture data for previewing the leaderboard locally without lock-flipping
// the Apps Script or waiting for the real tournament. Activated by ?mockLeaderboard=1.
import { computeStandings } from '../../lib/standings.js';
import { isMatchFinal } from '../../lib/status.js';
import { KO_ROUND_ORDER } from '../../lib/bracket.js';

function midHash(mid) {
  return mid.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
}

function generatePicks(fixtures, results, pickFn, standingsFn) {
  const matches = {};
  for (const [mid, fx] of Object.entries(fixtures.matches)) {
    const [h, a] = pickFn(mid, fx);
    matches[mid] = { home_score: h, away_score: a, home: fx.home, away: fx.away };
  }
  const group_standings = {};
  for (const [letter, group] of Object.entries(fixtures.groups)) {
    const allFinal = group.matches.every(mid => isMatchFinal(results.matches[mid]?.status));
    if (allFinal) {
      const matchScores = {};
      for (const mid of group.matches) {
        const r = results.matches[mid];
        matchScores[mid] = { home_score: r.home_score, away_score: r.away_score };
      }
      const { standings: actual } = computeStandings(letter, matchScores, fixtures);
      group_standings[letter] = standingsFn(actual, group.teams);
    } else {
      group_standings[letter] = [...group.teams];
    }
  }
  return { matches, group_standings };
}

const PROFILES = [
  {
    name: 'Alice (perfect standings, 2-0 picks)',
    pickFn: () => [2, 0],
    standingsFn: (actual) => [...actual],
    submitted_at: '2026-06-10T22:00:00Z',
  },
  {
    name: 'Bob (swapped 1-2, draws picks)',
    pickFn: () => [1, 1],
    standingsFn: (actual) => [actual[1], actual[0], actual[2], actual[3]],
    submitted_at: '2026-06-10T18:00:00Z',
  },
  {
    name: 'Carla (only 1st right, 0-1 picks)',
    pickFn: () => [0, 1],
    standingsFn: (actual) => [actual[0], actual[3], actual[2], actual[1]],
    submitted_at: '2026-06-09T14:30:00Z',
  },
  {
    name: 'Dan (reverse standings, varied picks)',
    pickFn: (mid) => {
      const seed = midHash(mid);
      return [seed % 3, (seed + 1) % 4];
    },
    standingsFn: (actual) => [...actual].reverse(),
    submitted_at: '2026-06-11T08:00:00Z',
  },
  {
    name: 'Eve (raw fixture order, low scores)',
    pickFn: (mid) => {
      const seed = midHash(mid);
      return [seed % 2, (seed + 1) % 2];
    },
    standingsFn: (_actual, teams) => [...teams],
    submitted_at: '2026-06-11T18:30:00Z',
  },
];

export function buildMockSubmissions(fixtures, results) {
  return PROFILES.map((p, i) => ({
    name: p.name,
    email_hash: `mock-${i}-${p.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8)}`,
    phase: 'group',
    picks: generatePicks(fixtures, results, p.pickFn, p.standingsFn),
    submitted_at: p.submitted_at,
  }));
}

export function buildMockResults(fixtures) {
  const matches = {};
  // Mark all matches in the first 3 groups (A, B, C) FINAL so each is fully
  // resolved — group_points only score when every match in a group is FINAL.
  const groupLetters = Object.keys(fixtures.groups).slice(0, 3);
  for (const letter of groupLetters) {
    for (const mid of fixtures.groups[letter].matches) {
      const seed = midHash(mid);
      matches[mid] = {
        home_score: seed % 3,
        away_score: (seed + 1) % 3,
        status: 'STATUS_FINAL',
      };
    }
  }
  return { updated_at: new Date().toISOString(), matches };
}

// ---------------------------------------------------------------------------
// Knockout phase mock data (mirrors public/knockout.sample.json)
// Activated by ?mockLeaderboard=1&mockKnockout=1 in the dev server.
// ---------------------------------------------------------------------------

// The 4-team dev knockout tree (mirrors public/knockout.sample.json so the
// phase-2 leaderboard can be exercised without real ESPN data).
export function buildMockKnockout() {
  return {
    seeded_at: '2026-06-27T20:00:00.000Z',
    first_kickoff_iso: '2026-07-05T19:00:00Z',
    rounds: {
      R32: [
        { slot: 'R32-1', match_id: '990001', home: 'BRA', away: 'KOR', kickoff_iso: '2026-07-05T19:00:00Z', feeds: 'R16-1' },
        { slot: 'R32-2', match_id: '990002', home: 'MEX', away: 'GER', kickoff_iso: '2026-07-05T22:00:00Z', feeds: 'R16-1' },
        { slot: 'R32-3', match_id: '990003', home: 'FRA', away: 'SUI', kickoff_iso: '2026-07-06T19:00:00Z', feeds: 'R16-2' },
        { slot: 'R32-4', match_id: '990004', home: 'ARG', away: 'NGA', kickoff_iso: '2026-07-06T22:00:00Z', feeds: 'R16-2' },
      ],
      R16: [
        { slot: 'R16-1', match_id: '990005', from: ['R32-1', 'R32-2'], kickoff_iso: '2026-07-09T19:00:00Z', feeds: 'F-1' },
        { slot: 'R16-2', match_id: '990006', from: ['R32-3', 'R32-4'], kickoff_iso: '2026-07-09T22:00:00Z', feeds: 'F-1' },
      ],
      F: [{ slot: 'F-1', match_id: '990007', from: ['R16-1', 'R16-2'], kickoff_iso: '2026-07-19T19:00:00Z' }],
    },
  };
}

// Mark every knockout match final with score 2-1, home team advancing.
// Single forward pass over KO_ROUND_ORDER: for R32 slots the home team is the
// slot's own `home` field; for later rounds it is the advancer recorded for
// the first feeder slot in the previous iteration.
export function buildMockKnockoutResults(knockout) {
  const advancers = {}; // slot id -> team code that advanced from that slot
  const matches = {};
  for (const round of KO_ROUND_ORDER) {
    for (const slot of (knockout.rounds[round] || [])) {
      if (!slot.match_id) continue;
      const homeTeam = round === 'R32' ? slot.home : (advancers[slot.from[0]] ?? slot.home ?? 'UNK');
      matches[slot.match_id] = {
        home_score: 2,
        away_score: 1,
        status: 'STATUS_FULL_TIME',
        advances: homeTeam,
      };
      advancers[slot.slot] = homeTeam;
    }
  }
  return matches;
}

// Build a valid connected bracket advancing a chosen side each slot.
// side='home' → picks match mock results (earns points);
// side='away' → busts (for visible variety on the leaderboard).
function buildMockBracket(knockout, side) {
  const advancers = {}; // slot id -> team code this bracket picked to advance
  const bracket = {};
  for (const round of KO_ROUND_ORDER) {
    for (const slot of (knockout.rounds[round] || [])) {
      const home = round === 'R32' ? slot.home : (advancers[slot.from[0]] ?? null);
      const away = round === 'R32' ? slot.away : (advancers[slot.from[1]] ?? null);
      const advances = side === 'home' ? home : (away ?? home);
      bracket[slot.slot] = {
        match_id: slot.match_id ?? null,
        home,
        away,
        home_score: side === 'home' ? 2 : 1,
        away_score: side === 'home' ? 1 : 2,
        advances,
      };
      advancers[slot.slot] = advances;
    }
  }
  const finalSlot = (knockout.rounds.F || [])[0];
  const champion = finalSlot ? bracket[finalSlot.slot]?.advances ?? null : null;
  return { bracket, champion };
}

// One knockout submission per existing group submission (same email_hash + name),
// alternating home/away advancers so the board shows a spread of bracket scores.
export function buildMockKnockoutSubmissions(knockout, groupSubs) {
  return groupSubs.map((g, i) => ({
    name: g.name,
    email_hash: g.email_hash,
    phase: 'knockout',
    picks: buildMockBracket(knockout, i % 2 === 0 ? 'home' : 'away'),
    submitted_at: '2026-06-28T12:00:00Z',
  }));
}
