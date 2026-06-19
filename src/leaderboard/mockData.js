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

// Full 32-team dev knockout tree (16 R32 → 8 R16 → 4 QF → 2 SF → 1 Final),
// mirroring the shape seed-knockout.mjs produces and what public/knockout.sample.json
// is generated from. Real FIFA codes (from fixtures) so flags render. This is the
// faithful-scale preview; the real knockout.json is seeded at go-live.
const MOCK_KO_TEAMS = [
  'BRA', 'KOR', 'ARG', 'AUS', 'FRA', 'SCO', 'ESP', 'CAN',
  'ENG', 'GHA', 'POR', 'URU', 'GER', 'MEX', 'NED', 'JPN',
  'BEL', 'EGY', 'CRO', 'PAN', 'MAR', 'USA', 'SUI', 'ECU',
  'COL', 'IRN', 'SEN', 'NOR', 'TUR', 'CIV', 'AUT', 'NZL',
];

const KO_ROUND_SIZES = { R32: 16, R16: 8, QF: 4, SF: 2, F: 1 };
const KO_ROUND_DATES = { R32: '2026-07-05', R16: '2026-07-09', QF: '2026-07-13', SF: '2026-07-16', F: '2026-07-19' };

// Standard single-elimination wiring: parent slot i is fed by children 2i-1 and 2i.
function koFeedMap() {
  const feeds = {};
  const from = {};
  for (let r = 1; r < KO_ROUND_ORDER.length; r++) {
    const round = KO_ROUND_ORDER[r];
    const childRound = KO_ROUND_ORDER[r - 1];
    for (let i = 1; i <= KO_ROUND_SIZES[round]; i++) {
      const parent = `${round}-${i}`;
      const a = `${childRound}-${2 * i - 1}`;
      const b = `${childRound}-${2 * i}`;
      from[parent] = [a, b];
      feeds[a] = parent;
      feeds[b] = parent;
    }
  }
  return { feeds, from };
}

// Deterministic, ordered kickoff time per slot (matches 6h apart within a round).
function koKickoff(round, i) {
  const d = new Date(`${KO_ROUND_DATES[round]}T16:00:00Z`);
  d.setUTCHours(d.getUTCHours() + (i - 1) * 6);
  return d.toISOString();
}

export function buildMockKnockout() {
  const { feeds, from } = koFeedMap();
  let mid = 990001;
  const rounds = { R32: [], R16: [], QF: [], SF: [], F: [] };
  for (let i = 1; i <= KO_ROUND_SIZES.R32; i++) {
    rounds.R32.push({
      slot: `R32-${i}`,
      match_id: String(mid++),
      home: MOCK_KO_TEAMS[2 * (i - 1)],
      away: MOCK_KO_TEAMS[2 * (i - 1) + 1],
      kickoff_iso: koKickoff('R32', i),
      feeds: feeds[`R32-${i}`],
    });
  }
  for (const round of ['R16', 'QF', 'SF', 'F']) {
    for (let i = 1; i <= KO_ROUND_SIZES[round]; i++) {
      const slot = `${round}-${i}`;
      rounds[round].push({
        slot,
        match_id: String(mid++),
        from: from[slot],
        kickoff_iso: koKickoff(round, i),
        ...(feeds[slot] ? { feeds: feeds[slot] } : {}),
      });
    }
  }
  return { seeded_at: '2026-06-27T20:00:00.000Z', first_kickoff_iso: rounds.R32[0].kickoff_iso, rounds };
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

// Build a valid connected bracket. Mock actual results always advance the HOME
// team 2-1, so:
//   mode 'home'  → every pick correct + exact (perfect 531)
//   mode 'away'  → every pick wrong (busted 0); wrong teams propagate as greys
//   mode 'mixed' → ~1 in 4 advancers wrong (greys + 0s), correct ones split
//                  between exact (2-1) and right-winner-wrong-score (3-0)
// `seed` varies the mixed pattern between players.
function buildMockBracket(knockout, mode, seed = 0) {
  const advancers = {}; // slot id -> team code this bracket picked to advance
  const bracket = {};
  for (const round of KO_ROUND_ORDER) {
    for (const slot of (knockout.rounds[round] || [])) {
      const home = round === 'R32' ? slot.home : (advancers[slot.from[0]] ?? null);
      const away = round === 'R32' ? slot.away : (advancers[slot.from[1]] ?? null);
      const n = parseInt(slot.match_id, 10) + seed * 7;
      let side;
      if (mode === 'home') side = 'home';
      else if (mode === 'away') side = 'away';
      else side = (n % 4 === 0) ? 'away' : 'home';
      const advances = side === 'home' ? home : (away ?? home);
      let home_score, away_score;
      if (side === 'home') {
        const exact = mode === 'home' || n % 2 === 0;
        home_score = exact ? 2 : 3;
        away_score = exact ? 1 : 0;
      } else {
        home_score = 0;
        away_score = 2;
      }
      bracket[slot.slot] = { match_id: slot.match_id ?? null, home, away, home_score, away_score, advances };
      advancers[slot.slot] = advances;
    }
  }
  const finalSlot = (knockout.rounds.F || [])[0];
  const champion = finalSlot ? bracket[finalSlot.slot]?.advances ?? null : null;
  return { bracket, champion };
}

// One knockout submission per existing group submission (same email_hash + name).
// A spread — one perfect, one busted, the rest mixed (varied by seed) — so the
// bracket view shows greys, partial outlines, and champions both hit and missed.
const MOCK_BRACKET_PLANS = ['home', 'mixed', 'mixed', 'away', 'mixed'];
export function buildMockKnockoutSubmissions(knockout, groupSubs) {
  return groupSubs.map((g, i) => ({
    name: g.name,
    email_hash: g.email_hash,
    phase: 'knockout',
    picks: buildMockBracket(knockout, MOCK_BRACKET_PLANS[i % MOCK_BRACKET_PLANS.length], i + 1),
    submitted_at: '2026-06-28T12:00:00Z',
  }));
}
