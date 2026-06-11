// Dev-only fixture data for previewing the leaderboard locally without lock-flipping
// the Apps Script or waiting for the real tournament. Activated by ?mockLeaderboard=1.
import { computeStandings } from '../../lib/standings.js';
import { isMatchFinal } from '../../lib/status.js';

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
