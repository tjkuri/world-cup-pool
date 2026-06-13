# v2 Knockout Bracket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the phase-2 knockout bracket — entry page, slot-based scoring, phase-aware backend, and an overall-first leaderboard — to the World Cup pool, on the `feat/v2-knockout-bracket` branch so the live group-stage site is never disturbed.

**Architecture:** A new `bracket.html` Vite entry hosts a standalone bracket-entry app (mirrors `src/form/`). Pure connected-bracket + slot-based scoring lives in `lib/bracket.js` and a new `scoreBracket` in `lib/score.js`. The real bracket is seeded once into `public/knockout.json`; the results cron is extended to pull knockout match IDs and record who advanced. Knockout picks are a second submission (`phase:'knockout'`) linked by email with its own secret. The leaderboard merges both phases per email and shifts to an overall-first board with a tabbed pick modal.

**Tech Stack:** React 19, Vite 6 (multi-page), Tailwind v4, vanilla-JS pure logic with `node --test`, Google Apps Script backend, ESPN public scoreboard API.

**Spec:** `docs/superpowers/specs/2026-06-13-v2-knockout-bracket-design.md`

**Testing conventions (from the repo):** Only `lib/*.test.js` is tested with `node --test lib/*.test.js` (NOT `node --test lib/` — that fails). React components are verified manually via `npm run dev`. This plan uses strict TDD for `lib/` tasks and write-then-verify-in-dev-server for React tasks.

---

## Data shapes (locked here, referenced by every task)

**`public/knockout.json`** — produced by `seed-knockout.mjs`, read by the bracket app, the scorer, and the leaderboard:

```json
{
  "seeded_at": "2026-06-27T20:00:00.000Z",
  "first_kickoff_iso": "2026-07-05T19:00:00Z",
  "rounds": {
    "R32": [
      { "slot": "R32-1", "match_id": "770001", "home": "BRA", "away": "KOR", "kickoff_iso": "2026-07-05T19:00:00Z", "feeds": "R16-1" }
    ],
    "R16": [
      { "slot": "R16-1", "match_id": "770017", "from": ["R32-1", "R32-2"], "kickoff_iso": "2026-07-09T19:00:00Z", "feeds": "QF-1" }
    ],
    "QF": [
      { "slot": "QF-1", "match_id": "770025", "from": ["R16-1", "R16-2"], "kickoff_iso": "2026-07-12T19:00:00Z", "feeds": "SF-1" }
    ],
    "SF": [
      { "slot": "SF-1", "match_id": "770029", "from": ["QF-1", "QF-2"], "kickoff_iso": "2026-07-15T19:00:00Z", "feeds": "F-1" }
    ],
    "F": [
      { "slot": "F-1", "match_id": "770031", "from": ["SF-1", "SF-2"], "kickoff_iso": "2026-07-19T19:00:00Z" }
    ]
  }
}
```

- Real tournament file: R32 has 16 slots, R16 8, QF 4, SF 2, F 1 (31 total).
- `match_id`s may be `null` for R16+ at seed time and backfilled by the cron; the scorer treats a slot with no final result as pending.

**`public/results.json`** — knockout entries gain an optional `advances` (team code that went through, from ESPN's `winner` flag; needed because penalty-shootout winners can't be derived from the score):

```json
{ "770001": { "home_score": 2, "away_score": 1, "status": "STATUS_FULL_TIME", "advances": "BRA" } }
```

Group entries are unchanged (no `advances`).

**Knockout `picks_json`** (the `phase:'knockout'` row):

```json
{
  "bracket": {
    "R32-1": { "match_id": "770001", "home": "BRA", "away": "KOR", "home_score": 2, "away_score": 0, "advances": "BRA" },
    "R16-1": { "match_id": "770017", "home": "BRA", "away": "MEX", "home_score": 1, "away_score": 1, "advances": "BRA" }
  },
  "champion": "BRA"
}
```

`advances` is stored explicitly per slot (derived from the score, or chosen via the pens toggle on a tie) so neither the scorer nor the renderer re-derives ties.

---

## File structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `lib/bracket.js` + `.test.js` | Create | Pure connected-bracket: round order, winner-from-score, matchup resolution, actual-bracket resolution from results |
| `lib/score.js` + `.test.js` | Modify | Add `scoreBracket` + knockout constants (group `scoreSubmission` untouched) |
| `lib/status.js` + `.test.js` | Modify | Recognize extra-time / penalty final statuses |
| `lib/validate.js` + `.test.js` | Modify | Add `validateBracket` |
| `public/knockout.sample.json` | Create | Small 4-team committed fixture for dev/UI + a real-shape example for tests |
| `scripts/lib/espn.mjs` | Modify | Extract `advancer` (winner flag) in `parseEvent`; helper to detect knockout events |
| `scripts/seed-knockout.mjs` + `scripts/seed-knockout.test.mjs` | Create | One-shot: build `public/knockout.json` from ESPN; pure transform tested |
| `scripts/fetch-results.mjs` | Modify | Also pull knockout match IDs and store `advances` |
| `apps_script/Code.gs` | Modify | `knockout_lock_iso` gating + per-phase secret check (MANUAL redeploy) |
| `vite.config.js` | Modify | Add `bracket` entry point |
| `bracket.html` | Create | Vite entry HTML (mirrors `index.html`) |
| `src/bracket/main.jsx` | Create | React root |
| `src/bracket/App.jsx` | Create | Loads config + knockout.json; gating; composes the entry UI |
| `src/bracket/state.jsx` | Create | `useReducer` + Context for bracket picks |
| `src/bracket/useBracketAutosave.js` | Create | localStorage draft (key `wc-bracket-draft`) |
| `src/bracket/bracketPicks.js` | Create | Build `advancerForSlot` + payload from state |
| `src/bracket/submit.js` | Create | POST `phase:'knockout'` |
| `src/bracket/components/RoundTabs.jsx` | Create | R32/R16/QF/SF/🏆 tabs |
| `src/bracket/components/BracketRound.jsx` | Create | Matchup cards: score inputs + pens toggle |
| `src/bracket/components/BracketReview.jsx` | Create | Read-only tree review before submit |
| `src/bracket/components/BracketSubmitModal.jsx` | Create | Identity + secret + confirm |
| `src/shared/scoreInput.js` | Create | Shared score-input className (polish #4) |
| `src/shared/bracketTree.jsx` | Create | Read-only tree renderer (shared by review + leaderboard tab) |
| `src/leaderboard/App.jsx` | Modify | Merge phases per email; phase detection; brackets-submitted count |
| `src/leaderboard/components/LeaderboardTable.jsx` | Modify | Group/Knockout/Total columns |
| `src/leaderboard/components/PrizeCards.jsx` | Create | Group(frozen)/Overall(live) cards |
| `src/leaderboard/components/PickModal.jsx` | Modify | `[Group]/[Knockout]` tabs |
| `src/leaderboard/components/KnockoutPicks.jsx` | Create | Bracket drilldown w/ slot scoring |
| `src/leaderboard/components/MatchStrip.jsx` | Modify | Knockout-first in phase 2 |
| `src/leaderboard/mockData.js` | Modify | Knockout-phase mock data |
| `CLAUDE.md` | Modify | Note the knockout pts-literal renderer |

---

# Phase 1 — Pure logic foundation (TDD)

## Task 1: `lib/bracket.js` — connected-bracket resolution

**Files:**
- Create: `lib/bracket.js`
- Test: `lib/bracket.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// lib/bracket.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KO_ROUND_ORDER, winnerCode, resolveMatchups, resolveActualBracket } from './bracket.js';

const knockout = {
  rounds: {
    R32: [
      { slot: 'R32-1', match_id: 'm1', home: 'BRA', away: 'KOR', feeds: 'R16-1' },
      { slot: 'R32-2', match_id: 'm2', home: 'MEX', away: 'GER', feeds: 'R16-1' },
    ],
    R16: [{ slot: 'R16-1', match_id: 'm3', from: ['R32-1', 'R32-2'], feeds: 'F-1' }],
    F: [{ slot: 'F-1', match_id: 'm4', from: ['R16-1'] }], // single-feeder for test simplicity
  },
};

test('KO_ROUND_ORDER is R32→F', () => {
  assert.deepEqual(KO_ROUND_ORDER, ['R32', 'R16', 'QF', 'SF', 'F']);
});

test('winnerCode returns the higher-scoring side, null on tie', () => {
  assert.equal(winnerCode('BRA', 'KOR', 2, 1), 'BRA');
  assert.equal(winnerCode('BRA', 'KOR', 1, 2), 'KOR');
  assert.equal(winnerCode('BRA', 'KOR', 1, 1), null);
});

test('resolveMatchups fills R32 from knockout and later rounds from advancers', () => {
  const advancer = (slot) => ({ 'R32-1': 'BRA', 'R32-2': 'GER', 'R16-1': 'BRA' }[slot] ?? null);
  const teams = resolveMatchups(knockout, advancer);
  assert.deepEqual(teams['R32-1'], { home: 'BRA', away: 'KOR' });
  assert.deepEqual(teams['R16-1'], { home: 'BRA', away: 'GER' });
  assert.deepEqual(teams['F-1'], { home: 'BRA', away: null }); // single feeder
});

test('resolveActualBracket walks results, using advances field then score', () => {
  const results = { matches: {
    m1: { home_score: 2, away_score: 1, status: 'STATUS_FULL_TIME' },          // BRA by score
    m2: { home_score: 1, away_score: 1, status: 'STATUS_FULL_TIME', advances: 'GER' }, // pens → GER
    m3: { home_score: 0, away_score: 0, status: 'STATUS_SCHEDULED' },          // pending
  }};
  const { advancers, matchInfo } = resolveActualBracket(knockout, results);
  assert.equal(advancers['R32-1'], 'BRA');
  assert.equal(advancers['R32-2'], 'GER');
  assert.equal(advancers['R16-1'], null);            // m3 pending
  assert.equal(matchInfo['R16-1'].home, 'BRA');      // teams resolved from R32 advancers
  assert.equal(matchInfo['R16-1'].away, 'GER');
  assert.equal(matchInfo['R16-1'].final, false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test lib/bracket.test.js`
Expected: FAIL — `Cannot find module './bracket.js'` / exports undefined.

- [ ] **Step 3: Implement `lib/bracket.js`**

```js
// lib/bracket.js
// Pure connected-bracket logic, shared by the entry UI and the scorer.
import { isMatchFinal } from './status.js';

export const KO_ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'F'];

// Team code that won by score, or null on a tie (a tie needs an explicit
// advancer — pens during entry, ESPN's winner flag for actual results).
export function winnerCode(home, away, homeScore, awayScore) {
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  if (homeScore > awayScore) return home;
  if (awayScore > homeScore) return away;
  return null;
}

// slot -> { home, away } for every round. advancerForSlot(slot) returns the
// team advancing from a given slot (or null if undecided).
export function resolveMatchups(knockout, advancerForSlot) {
  const teams = {};
  for (const round of KO_ROUND_ORDER) {
    for (const slot of knockout.rounds[round] || []) {
      if (round === 'R32') {
        teams[slot.slot] = { home: slot.home, away: slot.away };
      } else {
        const [a, b] = slot.from;
        teams[slot.slot] = { home: advancerForSlot(a) ?? null, away: advancerForSlot(b) ?? null };
      }
    }
  }
  return teams;
}

// Walk the real results round by round. For each slot resolve its two teams
// (R32 from knockout.json, later rounds from prior actual advancers), then its
// actual advancer (results.advances if present, else derived from score; null
// if the match isn't final yet).
export function resolveActualBracket(knockout, results) {
  const advancers = {};
  const matchInfo = {};
  for (const round of KO_ROUND_ORDER) {
    for (const slot of knockout.rounds[round] || []) {
      const home = round === 'R32' ? slot.home : (advancers[slot.from[0]] ?? null);
      const away = round === 'R32' ? slot.away : (advancers[slot.from[1]] ?? null);
      const r = slot.match_id ? results?.matches?.[slot.match_id] : null;
      const final = !!(r && isMatchFinal(r.status));
      let advances = null;
      if (final) {
        advances = r.advances ?? winnerCode(home, away, r.home_score, r.away_score);
      }
      advancers[slot.slot] = advances;
      matchInfo[slot.slot] = {
        home, away,
        home_score: r?.home_score ?? null,
        away_score: r?.away_score ?? null,
        advances, final,
      };
    }
  }
  return { advancers, matchInfo };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test lib/bracket.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/bracket.js lib/bracket.test.js
git commit -m "feat(lib): connected-bracket resolution helpers"
```

## Task 2: `lib/score.js` — `scoreBracket` + knockout constants

**Files:**
- Modify: `lib/score.js`
- Test: `lib/score.test.js`

- [ ] **Step 1: Write the failing tests** (append to `lib/score.test.js`)

```js
import { scoreBracket } from './score.js';

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
  // 4 R32 correct ×4 = 16; 2 R16 correct ×8 = 16; 1 SF correct ×32 = 32
  assert.equal(s.round_totals.R32, 16);
  assert.equal(s.round_totals.R16, 16);
  assert.equal(s.round_totals.SF, 32);
  assert.equal(s.champion_points, 80);          // F advancer BRA, picked BRA
  // finalist: actual finalists = SF-1 teams {BRA, ARG}; predicted final teams {BRA, null} → BRA only
  assert.equal(s.finalist_points, 50);
});

test('scoreBracket exact-score bonus is +3, +5 on the final, pens score ignored', () => {
  const bracket = {
    'R32-1': { home: 'BRA', away: 'KOR', home_score: 2, away_score: 1, advances: 'BRA' }, // exact
    'F-1': { home: 'BRA', away: null, home_score: 1, away_score: 1, advances: 'BRA' },     // exact final
  };
  const r = results({
    a: [2, 1, 'BRA'],   // matches predicted score → +3 on top of +4 winner
    h: [1, 1, 'BRA'],   // final 1-1 (BRA on pens) matches predicted → +5
  });
  // Trim KO to just these two slots for isolation.
  const ko = { rounds: { R32: [KO.rounds.R32[0]], F: KO.rounds.F } };
  const s = scoreBracket(bracket, ko, r);
  assert.equal(s.exact_bonus, 8);     // 3 + 5
  assert.equal(s.exact_count, 2);
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test lib/score.test.js`
Expected: FAIL — `scoreBracket` is not exported.

- [ ] **Step 3: Implement `scoreBracket` in `lib/score.js`** (add imports + constants + function; do not touch `scoreSubmission`)

Add at the top, after the existing imports:

```js
import { KO_ROUND_ORDER, resolveActualBracket } from './bracket.js';

const KO_WINNER_POINTS = { R32: 4, R16: 8, QF: 16, SF: 32 };
const KO_CHAMPION_POINTS = 80;
const KO_FINALIST_POINTS = 50;
const KO_EXACT_BONUS = 3;
const KO_FINAL_EXACT_BONUS = 5;
```

Add at the end of the file:

```js
// Slot-based knockout scoring. Each bracket position is scored independently
// against the real bracket (ESPN-style): round-winner points when the player's
// advancer for a slot matches reality, an exact-score bonus per match, plus
// finalist and champion achievements. See the locked table in docs/HANDOFF.md.
export function scoreBracket(bracket, knockout, results) {
  const { advancers, matchInfo } = resolveActualBracket(knockout, results);

  const round_points = {};
  const round_totals = { R32: 0, R16: 0, QF: 0, SF: 0 };
  let exact_bonus = 0;
  let exact_count = 0;

  for (const round of KO_ROUND_ORDER) {
    for (const slot of knockout.rounds[round] || []) {
      const id = slot.slot;
      const actual = matchInfo[id];
      const pick = bracket?.[id];
      if (!actual || !actual.final || !pick) continue;

      // Round-winner points (R32..SF; the final's winner is scored as champion).
      if (round !== 'F' && pick.advances && pick.advances === actual.advances) {
        const pts = KO_WINNER_POINTS[round];
        round_points[id] = pts;
        round_totals[round] += pts;
      }

      // Exact-score bonus: predicted regulation/ET score vs ESPN's reported
      // score (penalty shootouts ignored). +5 on the final, +3 otherwise.
      if (pick.home_score === actual.home_score && pick.away_score === actual.away_score) {
        exact_bonus += round === 'F' ? KO_FINAL_EXACT_BONUS : KO_EXACT_BONUS;
        exact_count += 1;
      }
    }
  }

  // Finalists: the two teams in the actual final (the F slot's resolved teams).
  // +50 for each that the player also placed in their final, capped at 100.
  const finalSlot = (knockout.rounds.F || [])[0];
  let finalist_points = 0;
  let champion_points = 0;
  if (finalSlot) {
    const actualFinal = matchInfo[finalSlot.slot];
    const pickFinal = bracket?.[finalSlot.slot];
    if (actualFinal && pickFinal) {
      const actualFinalists = new Set([actualFinal.home, actualFinal.away].filter(Boolean));
      const predictedFinalists = [pickFinal.home, pickFinal.away].filter(Boolean);
      for (const team of predictedFinalists) {
        if (actualFinalists.has(team)) finalist_points += KO_FINALIST_POINTS;
      }
      finalist_points = Math.min(finalist_points, 2 * KO_FINALIST_POINTS);
    }
    // Champion: the final's actual advancer.
    if (actualFinal?.final && bracket?.champion && bracket.champion === actualFinal.advances) {
      champion_points = KO_CHAMPION_POINTS;
    }
  }

  const bracket_total =
    round_totals.R32 + round_totals.R16 + round_totals.QF + round_totals.SF +
    finalist_points + champion_points + exact_bonus;

  return { round_points, round_totals, finalist_points, champion_points, exact_bonus, exact_count, bracket_total };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test lib/score.test.js`
Expected: PASS (existing group tests + 3 new).

- [ ] **Step 5: Commit**

```bash
git add lib/score.js lib/score.test.js
git commit -m "feat(lib): scoreBracket slot-based knockout scoring"
```

## Task 3: `lib/status.js` — extra-time / penalty final statuses

**Files:**
- Modify: `lib/status.js`
- Test: `lib/status.test.js`

- [ ] **Step 1: Write the failing tests** (append to `lib/status.test.js`)

```js
test('isMatchFinal recognizes knockout finishes (ET, penalties)', () => {
  assert.equal(isMatchFinal('STATUS_FINAL_AET'), true);
  assert.equal(isMatchFinal('STATUS_FINAL_PEN'), true);
  assert.equal(isMatchFinal('STATUS_FULL_TIME'), true);
  assert.equal(isMatchFinal('STATUS_SCHEDULED'), false);
});
```

> Note: the exact ESPN strings for AET/penalties are not yet confirmed against live data (knockouts haven't started). These two (`STATUS_FINAL_AET`, `STATUS_FINAL_PEN`) are ESPN's documented soccer statuses; verify against a real knockout response during seeding (Task 5) and add any others here — this file is the single chokepoint by design.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test lib/status.test.js`
Expected: FAIL — AET/PEN return false.

- [ ] **Step 3: Add the statuses to `lib/status.js`**

```js
const FINAL_STATUSES = new Set([
  'STATUS_FINAL',
  'STATUS_FULL_TIME',
  'STATUS_FINAL_AET',   // knockout: decided after extra time
  'STATUS_FINAL_PEN',   // knockout: decided on penalties
]);
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test lib/status.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/status.js lib/status.test.js
git commit -m "feat(lib): recognize AET/penalty knockout statuses"
```

## Task 4: `lib/validate.js` — `validateBracket`

**Files:**
- Modify: `lib/validate.js`
- Test: `lib/validate.test.js`

- [ ] **Step 1: Write the failing tests** (append to `lib/validate.test.js`)

```js
import { validateBracket } from './validate.js';

const KO = {
  rounds: {
    R32: [{ slot: 'R32-1', home: 'BRA', away: 'KOR', feeds: 'F-1' },
          { slot: 'R32-2', home: 'MEX', away: 'GER', feeds: 'F-1' }],
    F: [{ slot: 'F-1', from: ['R32-1', 'R32-2'] }],
  },
};

function fullBracket() {
  return {
    bracket: {
      'R32-1': { home: 'BRA', away: 'KOR', home_score: 2, away_score: 0, advances: 'BRA' },
      'R32-2': { home: 'MEX', away: 'GER', home_score: 1, away_score: 0, advances: 'MEX' },
      'F-1':   { home: 'BRA', away: 'MEX', home_score: 1, away_score: 0, advances: 'BRA' },
    },
    champion: 'BRA',
  };
}

test('validateBracket passes a complete consistent bracket', () => {
  const { valid, errors } = validateBracket({ identity: goodIdentity(), picks: fullBracket() }, KO);
  assert.equal(valid, true, JSON.stringify(errors));
});

test('validateBracket flags a missing slot pick', () => {
  const picks = fullBracket();
  delete picks.bracket['F-1'];
  const { valid, errors } = validateBracket({ identity: goodIdentity(), picks }, KO);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.code === 'slot_incomplete' && e.slot === 'F-1'));
});

test('validateBracket flags a tie with no advancer chosen', () => {
  const picks = fullBracket();
  picks.bracket['R32-1'] = { home: 'BRA', away: 'KOR', home_score: 1, away_score: 1, advances: null };
  const { valid, errors } = validateBracket({ identity: goodIdentity(), picks }, KO);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.code === 'slot_no_advancer' && e.slot === 'R32-1'));
});

test('validateBracket flags champion not matching the final advancer', () => {
  const picks = fullBracket();
  picks.champion = 'MEX'; // final advancer is BRA
  const { valid, errors } = validateBracket({ identity: goodIdentity(), picks }, KO);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.code === 'champion_mismatch'));
});
```

Add this helper near the top of `lib/validate.test.js` if not already present:

```js
function goodIdentity() {
  return { name: 'Tester', email: 'a@b.com', secret: 'abcd', acknowledged: true };
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test lib/validate.test.js`
Expected: FAIL — `validateBracket` not exported.

- [ ] **Step 3: Implement `validateBracket` in `lib/validate.js`**

Add at the end (reuse `EMAIL_RE` already defined at the top of the file):

```js
import { KO_ROUND_ORDER } from './bracket.js';

export function validateBracket(input, knockout) {
  const errors = [];
  const { identity, picks } = input;

  if (!identity || typeof identity.name !== 'string' || identity.name.trim().length === 0 || identity.name.length > 40) {
    errors.push({ code: 'identity_name', message: 'Name must be 1–40 characters.' });
  }
  if (!identity || typeof identity.email !== 'string' || !EMAIL_RE.test(identity.email)) {
    errors.push({ code: 'identity_email', message: 'Email is not valid.' });
  }
  if (!identity || typeof identity.secret !== 'string' || identity.secret.length < 4) {
    errors.push({ code: 'identity_secret', message: 'Secret must be at least 4 characters.' });
  }
  if (!identity || identity.acknowledged !== true) {
    errors.push({ code: 'identity_acknowledged', message: 'Please acknowledge before submitting.' });
  }

  const bracket = picks?.bracket || {};
  let finalSlotId = null;
  for (const round of KO_ROUND_ORDER) {
    for (const slot of knockout.rounds[round] || []) {
      if (round === 'F') finalSlotId = slot.slot;
      const pick = bracket[slot.slot];
      if (!pick || !Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) {
        errors.push({ code: 'slot_incomplete', slot: slot.slot, message: `Fill in the score for ${slot.slot}.` });
        continue;
      }
      for (const v of [pick.home_score, pick.away_score]) {
        if (v < 0 || v > 20) {
          errors.push({ code: 'score_out_of_range', slot: slot.slot, message: `${slot.slot} score must be 0–20.` });
        }
      }
      if (!pick.advances) {
        errors.push({ code: 'slot_no_advancer', slot: slot.slot, message: `Pick who advances from ${slot.slot}.` });
      }
    }
  }

  if (finalSlotId) {
    const finalPick = bracket[finalSlotId];
    if (finalPick && picks?.champion && finalPick.advances && picks.champion !== finalPick.advances) {
      errors.push({ code: 'champion_mismatch', message: 'Champion must be the winner of the final.' });
    }
    if (!picks?.champion) {
      errors.push({ code: 'champion_missing', message: 'Pick a champion.' });
    }
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test lib/validate.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite + commit**

Run: `npm test`
Expected: all pass (prior 55 + new bracket/score/status/validate tests).

```bash
git add lib/validate.js lib/validate.test.js
git commit -m "feat(lib): validateBracket for knockout picks"
```

---

# Phase 2 — Data, scripts, backend

## Task 5: ESPN advancer extraction + `seed-knockout.mjs`

**Files:**
- Modify: `scripts/lib/espn.mjs`
- Create: `scripts/seed-knockout.mjs`, `scripts/seed-knockout.test.mjs`
- Create: `public/knockout.sample.json`

- [ ] **Step 1: Add `advancer` to `parseEvent` in `scripts/lib/espn.mjs`**

In the object returned by `parseEvent`, add an `advancer` field after `away_score`:

```js
    away_score: parseInt(awayC.score ?? '', 10),
    // For knockout matches ESPN flags the winning competitor; null until decided.
    advancer: homeC.winner === true ? (homeC.team?.abbreviation || '').toUpperCase()
            : awayC.winner === true ? (awayC.team?.abbreviation || '').toUpperCase()
            : null,
```

- [ ] **Step 2: Write the failing test for the pure transform**

```js
// scripts/seed-knockout.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKnockout } from './seed-knockout.mjs';

// Minimal parsed-events fixture: 2 R32 matches feeding one final (test-sized tree).
const parsed = [
  { matchId: '1', home: 'BRA', away: 'KOR', kickoff_iso: '2026-07-05T19:00:00Z', round: 'R32', bracketSlot: 1 },
  { matchId: '2', home: 'MEX', away: 'GER', kickoff_iso: '2026-07-05T22:00:00Z', round: 'R32', bracketSlot: 2 },
];

test('buildKnockout assigns slots, sorts R32 by kickoff, records first kickoff', () => {
  const ko = buildKnockout(parsed);
  assert.equal(ko.rounds.R32.length, 2);
  assert.equal(ko.rounds.R32[0].slot, 'R32-1');
  assert.equal(ko.rounds.R32[0].home, 'BRA');
  assert.equal(ko.rounds.R32[0].match_id, '1');
  assert.equal(ko.first_kickoff_iso, '2026-07-05T19:00:00Z');
});
```

> Note: the real ESPN-shape mapping (how it labels knockout rounds and bracket
> positions in `event.notes`/`competition.type`) is unconfirmed until knockouts
> start. `buildKnockout` takes already-parsed events so the slot/tree logic is
> testable now; the ESPN-specific extraction in `main()` is validated against a
> live response when run ~Jun 27 (same as the group seed was). Keep `from`/`feeds`
> wiring deterministic from the standard 32-team bracket map.

- [ ] **Step 3: Run to verify it fails**

Run: `node --test scripts/seed-knockout.test.mjs`
Expected: FAIL — module/exports missing.

- [ ] **Step 4: Implement `scripts/seed-knockout.mjs`**

```js
// One-shot. Run locally ONCE after the group stage resolves (~Jun 27):
//   node scripts/seed-knockout.mjs
//
// Pulls the resolved 32-team knockout bracket from ESPN, writes
// public/knockout.json, and prints the first R32 kickoff for config.json +
// the Apps Script "knockout_lock_iso" property.
//
// The standard 32-team bracket tree (which R32 slot feeds which R16 slot, etc.)
// is fixed; buildKnockout wires `from`/`feeds` from it. Verify the printed tree
// against the official bracket before committing knockout.json.

import { writeFile } from 'node:fs/promises';
import { fetchScoreboard, parseEvent } from './lib/espn.mjs';

const ROUND_SIZES = { R32: 16, R16: 8, QF: 4, SF: 2, F: 1 };
// Round-32 dates per the schedule; adjust if the calendar shifts.
const R32_DATES = ['20260705', '20260706', '20260707', '20260708'];

// Standard single-elimination feed map: slot i of a round is fed by slots
// 2i-1 and 2i of the previous round. F-1 is fed by SF-1 and SF-2.
function feedMap() {
  const order = ['R32', 'R16', 'QF', 'SF', 'F'];
  const feeds = {};   // childSlot -> parentSlot
  const from = {};    // parentSlot -> [childA, childB]
  for (let r = 1; r < order.length; r++) {
    const round = order[r];
    for (let i = 1; i <= ROUND_SIZES[round]; i++) {
      const parent = `${round}-${i}`;
      const childRound = order[r - 1];
      const a = `${childRound}-${2 * i - 1}`;
      const b = `${childRound}-${2 * i}`;
      from[parent] = [a, b];
      feeds[a] = parent;
      feeds[b] = parent;
    }
  }
  return { feeds, from };
}

// Pure: turn parsed R32 events (each with a bracketSlot 1..16) into knockout.json.
export function buildKnockout(parsedR32) {
  const { feeds, from } = feedMap();
  const sorted = [...parsedR32].sort((a, b) => a.kickoff_iso.localeCompare(b.kickoff_iso));
  const rounds = { R32: [], R16: [], QF: [], SF: [], F: [] };

  sorted.forEach((evt, idx) => {
    const slot = `R32-${idx + 1}`;
    rounds.R32.push({
      slot, match_id: evt.matchId, home: evt.home, away: evt.away,
      kickoff_iso: evt.kickoff_iso, feeds: feeds[slot],
    });
  });
  for (const round of ['R16', 'QF', 'SF', 'F']) {
    for (let i = 1; i <= ROUND_SIZES[round]; i++) {
      const slot = `${round}-${i}`;
      rounds[round].push({ slot, match_id: null, from: from[slot], kickoff_iso: null, ...(feeds[slot] ? { feeds: feeds[slot] } : {}) });
    }
  }

  const first_kickoff_iso = rounds.R32.length ? rounds.R32[0].kickoff_iso : null;
  return { seeded_at: new Date().toISOString(), first_kickoff_iso, rounds };
}

async function main() {
  const parsed = [];
  for (const dateStr of R32_DATES) {
    console.log(`Fetching ${dateStr}...`);
    const data = await fetchScoreboard(dateStr);
    for (const evt of (data.events || [])) {
      const p = parseEvent(evt); // no group map needed for knockout
      parsed.push(p);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (parsed.length !== ROUND_SIZES.R32) {
    console.warn(`Expected ${ROUND_SIZES.R32} R32 matches, found ${parsed.length}. Inspect before committing.`);
  }
  const ko = buildKnockout(parsed);
  await writeFile(new URL('../public/knockout.json', import.meta.url), JSON.stringify(ko, null, 2) + '\n');
  console.log('Wrote public/knockout.json');
  console.log('\nR32 bracket:');
  for (const s of ko.rounds.R32) console.log(`  ${s.slot}: ${s.home} vs ${s.away}  (${s.match_id})`);
  console.log(`\nFirst kickoff (paste into config.json.knockout_lock_iso + Apps Script "knockout_lock_iso"): ${ko.first_kickoff_iso}`);
}

// Only run main() when executed directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test scripts/seed-knockout.test.mjs`
Expected: PASS.

- [ ] **Step 6: Create `public/knockout.sample.json`** (a real-shape 4-team tree for dev — used by the bracket app and leaderboard mocks via `?mock` until the real file exists)

```json
{
  "seeded_at": "2026-06-27T20:00:00.000Z",
  "first_kickoff_iso": "2026-07-05T19:00:00Z",
  "rounds": {
    "R32": [
      { "slot": "R32-1", "match_id": "990001", "home": "BRA", "away": "KOR", "kickoff_iso": "2026-07-05T19:00:00Z", "feeds": "R16-1" },
      { "slot": "R32-2", "match_id": "990002", "home": "MEX", "away": "GER", "kickoff_iso": "2026-07-05T22:00:00Z", "feeds": "R16-1" },
      { "slot": "R32-3", "match_id": "990003", "home": "FRA", "away": "SUI", "kickoff_iso": "2026-07-06T19:00:00Z", "feeds": "R16-2" },
      { "slot": "R32-4", "match_id": "990004", "home": "ARG", "away": "NGA", "kickoff_iso": "2026-07-06T22:00:00Z", "feeds": "R16-2" }
    ],
    "R16": [
      { "slot": "R16-1", "match_id": "990005", "from": ["R32-1", "R32-2"], "kickoff_iso": null, "feeds": "F-1" },
      { "slot": "R16-2", "match_id": "990006", "from": ["R32-3", "R32-4"], "kickoff_iso": null, "feeds": "F-1" }
    ],
    "F": [
      { "slot": "F-1", "match_id": "990007", "from": ["R16-1", "R16-2"], "kickoff_iso": null }
    ]
  }
}
```

> This 4-slot sample is intentionally a smaller tree (R32→R16→F, no QF/SF) so the
> dev UI renders without 32 teams. The real `knockout.json` has the full 31-match
> tree. Components must not hardcode round counts — they iterate `knockout.rounds`.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/espn.mjs scripts/seed-knockout.mjs scripts/seed-knockout.test.mjs public/knockout.sample.json
git commit -m "feat(scripts): seed-knockout + ESPN advancer extraction + dev sample"
```

## Task 6: `fetch-results.mjs` — include knockout matches + advancer

**Files:**
- Modify: `scripts/fetch-results.mjs`

- [ ] **Step 1: Read knockout match IDs and store advancer** — make these edits:

(a) After loading `fixtures`, also load knockout IDs (graceful if the file is absent):

```js
  const fixtures = JSON.parse(await readFile('public/fixtures.json', 'utf8'));
  const existing = JSON.parse(await readFile('public/results.json', 'utf8'));

  // Group fixture IDs, plus knockout match IDs once the bracket is seeded.
  const matchIds = new Set(Object.keys(fixtures.matches));
  const koDates = {};   // ymd -> [matchId], to extend idsByDate below
  try {
    const ko = JSON.parse(await readFile('public/knockout.json', 'utf8'));
    for (const round of Object.values(ko.rounds)) {
      for (const slot of round) {
        if (!slot.match_id) continue;
        matchIds.add(slot.match_id);
        if (slot.kickoff_iso) {
          const ymd = slot.kickoff_iso.slice(0, 10).replaceAll('-', '');
          for (const key of [ymd, shiftYmd(ymd, -1)]) (koDates[key] ??= []).push(slot.match_id);
        }
      }
    }
  } catch { /* knockout.json not seeded yet — group-only run */ }
```

(b) After the existing `idsByDate` is built from `fixtures.matches`, merge in `koDates`:

```js
  for (const [key, ids] of Object.entries(koDates)) {
    (idsByDate[key] ??= []).push(...ids);
  }
```

(c) In the event loop where `next` is built, carry `advances` for knockout matches:

```js
      const next = {
        home_score: Number.isFinite(parsed.home_score) ? parsed.home_score : (prev?.home_score ?? null),
        away_score: Number.isFinite(parsed.away_score) ? parsed.away_score : (prev?.away_score ?? null),
        status: parsed.status,
      };
      if (parsed.advancer) next.advances = parsed.advancer;
```

- [ ] **Step 2: Smoke-run the cron script (group-only path still works)**

Run: `node scripts/fetch-results.mjs`
Expected: prints "No changes." or "Updated results.json …" with no crash (knockout.json absent → the try/catch is silent). `git diff public/results.json` shows no unexpected churn.

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-results.mjs
git commit -m "feat(cron): fetch knockout results + record advancer"
```

## Task 7: Apps Script — `knockout_lock_iso` + per-phase secret

**Files:**
- Modify: `apps_script/Code.gs`

> ⚠️ Editing this file does nothing live until the user pastes it into the Apps
> Script editor and deploys a new version (URL unchanged). Surface this at handoff.

- [ ] **Step 1: Gate knockout posts on the knockout lock + check the secret against the latest knockout row**

Replace the lock check and secret check region of `doPost`. After parsing `phase`:

```js
    const phase = String(body.phase || 'group');

    // Phase-specific lock: group posts gate on group_lock_iso (long past now);
    // knockout posts gate on knockout_lock_iso.
    const lockProp = phase === 'knockout' ? 'knockout_lock_iso' : 'group_lock_iso';
    const lockIso = PropertiesService.getScriptProperties().getProperty(lockProp);
    if (!lockIso) return jsonResponse(400, { error: 'lock_unset', detail: lockProp });
    if (new Date() >= new Date(lockIso)) {
      return jsonResponse(403, { error: 'locked' });
    }
```

(Remove the earlier `const lockTime = getLockTime(); if (new Date() >= lockTime) ...` block at the top of `doPost` so the lock is only evaluated once, per-phase.)

Then change the secret check to match against the latest row **of the same phase**:

```js
    const sheet = getSheet();
    const latest = findLatestByEmailAndPhase(sheet, email, phase);
    if (latest && latest.secret_hash !== secretHash) {
      return jsonResponse(403, { error: 'secret_mismatch' });
    }
```

- [ ] **Step 2: Add `findLatestByEmailAndPhase`** (next to `findLatestByEmail`; the phase column is index 4)

```js
function findLatestByEmailAndPhase(sheet, email, phase) {
  const data = sheet.getDataRange().getValues();
  let latest = null;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[2] || '').toLowerCase() !== email) continue;
    if (String(row[4] || '') !== phase) continue;
    const submittedAt = String(row[0] || '');
    if (!latest || submittedAt > latest.submitted_at) {
      latest = { submitted_at: submittedAt, secret_hash: String(row[3] || '') };
    }
  }
  return latest;
}
```

- [ ] **Step 3: Update the header comment** in `Code.gs` to document `knockout_lock_iso` as a required script property and the per-phase secret behavior.

- [ ] **Step 4: Verify syntactically** (Apps Script can't run locally; do a lint-level parse)

Run: `node --check apps_script/Code.gs`
Expected: no output (valid JS).

- [ ] **Step 5: Commit**

```bash
git add apps_script/Code.gs
git commit -m "feat(backend): per-phase lock + secret for knockout submissions"
```

> **Manual deploy reminder (do at handoff, not now):** paste `Code.gs` into the
> Apps Script editor, add script property `knockout_lock_iso`, Deploy → Manage
> deployments → edit → New version → Deploy. URL unchanged.

---

# Phase 3 — Bracket entry app

## Task 8: Vite entry + app shell + gating

**Files:**
- Modify: `vite.config.js`
- Create: `bracket.html`, `src/bracket/main.jsx`, `src/bracket/App.jsx`

- [ ] **Step 1: Add the entry to `vite.config.js`**

```js
      input: {
        main: resolve(here, 'index.html'),
        leaderboard: resolve(here, 'leaderboard.html'),
        bracket: resolve(here, 'bracket.html'),
      },
```

- [ ] **Step 2: Create `bracket.html`** (copy `index.html`, swap the script src + title; favicon/data-URI line identical)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9A%BD%3C/text%3E%3C/svg%3E" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>World Cup 2026 Pool — Bracket</title>
  </head>
  <body class="bg-slate-950 text-slate-100">
    <div id="root"></div>
    <script type="module" src="/src/bracket/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `src/bracket/main.jsx`**

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import '../styles/main.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 4: Create `src/bracket/App.jsx`** (loads config + knockout.json; shows "opens after group stage" when the bracket isn't seeded or the lock has passed). `?mockKnockout=1` loads `knockout.sample.json`.

```jsx
import { useEffect, useState } from 'react';
import { TopBar } from '../form/components/TopBar.jsx';
import { LockBanner } from '../form/components/LockBanner.jsx';
import { RulesDrawer } from '../shared/RulesDrawer.jsx';
import { PotBar } from '../shared/PotBar.jsx';
import { BracketStateProvider } from './state.jsx';
import { BracketBody } from './BracketBody.jsx';

export function App() {
  const [config, setConfig] = useState(null);
  const [knockout, setKnockout] = useState(undefined); // undefined=loading, null=not seeded
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const mock = new URLSearchParams(location.search).get('mockKnockout') === '1';
    const koUrl = mock ? '/knockout.sample.json' : '/knockout.json';
    fetch('/config.json').then((r) => r.json()).then(setConfig).catch((e) => setLoadError(String(e)));
    fetch(koUrl).then((r) => (r.ok ? r.json() : null)).then((k) => setKnockout(k)).catch(() => setKnockout(null));
  }, []);

  if (loadError) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6"><p>Failed to load: {loadError}. Refresh to retry.</p></main>;
  }
  if (!config || knockout === undefined) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6"><p className="text-slate-400">Loading…</p></main>;
  }
  return (
    <BracketStateProvider>
      <BracketBody config={config} knockout={knockout} />
    </BracketStateProvider>
  );
}
```

- [ ] **Step 5: Create `src/bracket/BracketBody.jsx`** (the gating shell; the entry UI itself is wired in Task 11)

```jsx
import { useEffect, useState } from 'react';
import { TopBar } from '../form/components/TopBar.jsx';
import { LockBanner } from '../form/components/LockBanner.jsx';
import { RulesDrawer } from '../shared/RulesDrawer.jsx';
import { PotBar } from '../shared/PotBar.jsx';
import { formatKickoff } from '../shared/formatKickoff.js';
import { useBracketState } from './state.jsx';
import { useBracketAutosave, loadBracketDraft } from './useBracketAutosave.js';

export function BracketBody({ config, knockout }) {
  const { state, dispatch } = useBracketState();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const lockIso = config.knockout_lock_iso || knockout?.first_kickoff_iso || null;
  const lockTime = lockIso ? new Date(lockIso) : null;
  const locked = lockTime ? now >= lockTime : false;

  useEffect(() => {
    const draft = loadBracketDraft();
    if (draft) dispatch({ type: 'HYDRATE', payload: draft });
  }, [dispatch]);
  useBracketAutosave(state);

  const topBar = (
    <TopBar pageLabel="World Cup 2026 Pool — Bracket" otherPage="./leaderboard.html" otherLabel="Leaderboard" onOpenRules={() => setRulesOpen(true)}>
      {lockTime && <LockBanner lockTime={lockTime} now={now} />}
    </TopBar>
  );

  // Not seeded yet → bracket opens after the group stage.
  if (!knockout) {
    return (
      <>{topBar}
        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <PotBar appsScriptUrl={config.apps_script_url} buyIn={config.buy_in_usd} />
          <p className="text-slate-300">The bracket opens after the group stage ends. Check back once the Round of 32 is set.</p>
        </main>
        {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
      </>
    );
  }
  if (locked) {
    return (
      <>{topBar}
        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <PotBar appsScriptUrl={config.apps_script_url} buyIn={config.buy_in_usd} />
          <h2 className="text-lg font-semibold">Bracket submissions are closed.</h2>
          <p className="text-slate-300">The knockout stage has begun. <a className="text-emerald-400 hover:underline" href="./leaderboard.html">View the leaderboard.</a></p>
        </main>
        {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
      </>
    );
  }

  // Live entry UI is composed in Task 11 (BracketEntry). Placeholder for now.
  return (
    <>{topBar}
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PotBar appsScriptUrl={config.apps_script_url} buyIn={config.buy_in_usd} />
        {lockTime && <p className="mb-3 text-xs text-slate-500">Locks {formatKickoff(lockIso)}.</p>}
        <div id="bracket-entry-mount" />
      </main>
      {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 6: Verify in the dev server** (state.jsx + autosave land in Task 9; this step will error until then — proceed to Task 9, then verify)

Run: `npm run dev`, open `http://localhost:5173/bracket.html?mockKnockout=1`
Expected (after Task 9): TopBar + PotBar + the "Locks …" line render; no console errors. With `?mockKnockout=0`/no file: "opens after the group stage" copy.

- [ ] **Step 7: Commit**

```bash
git add vite.config.js bracket.html src/bracket/main.jsx src/bracket/App.jsx src/bracket/BracketBody.jsx
git commit -m "feat(bracket): vite entry + app shell with gating"
```

## Task 9: Bracket state + autosave

**Files:**
- Create: `src/bracket/state.jsx`, `src/bracket/useBracketAutosave.js`

- [ ] **Step 1: Create `src/bracket/state.jsx`** (reducer keyed by slot; `advances` stored explicitly)

```jsx
import { createContext, useContext, useReducer } from 'react';

const initial = {
  bracket: {},   // slot -> { home, away, home_score, away_score, advances }
  champion: null,
  identity: { name: '', email: '', secret: '', acknowledged: false },
  activeRound: 'R32',
  errors: [],
  submitState: 'idle',
  submitMessage: '',
  submittedAt: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SLOT_SCORE': {
      const { slot, side, value, home, away } = action;
      const prior = state.bracket[slot] || { home, away, home_score: null, away_score: null, advances: null };
      const next = { ...prior, home, away, [side]: value };
      // Re-derive advancer from score unless it's a tie (then keep prior pens choice).
      if (Number.isInteger(next.home_score) && Number.isInteger(next.away_score)) {
        if (next.home_score > next.away_score) next.advances = home;
        else if (next.away_score > next.home_score) next.advances = away;
        // tie → leave next.advances as-is (set via SET_SLOT_ADVANCER)
      }
      return { ...state, bracket: { ...state.bracket, [slot]: next } };
    }
    case 'SET_SLOT_ADVANCER': {
      const prior = state.bracket[action.slot];
      if (!prior) return state;
      return { ...state, bracket: { ...state.bracket, [action.slot]: { ...prior, advances: action.team } } };
    }
    case 'SET_CHAMPION':
      return { ...state, champion: action.team };
    case 'CLEAR_BRACKET':
      return { ...state, bracket: {}, champion: null, errors: [] };
    case 'SET_IDENTITY':
      return { ...state, identity: { ...state.identity, ...action.patch } };
    case 'SET_ACTIVE_ROUND':
      return { ...state, activeRound: action.round };
    case 'SET_ERRORS':
      return { ...state, errors: action.errors };
    case 'SET_SUBMIT_STATE':
      return { ...state, submitState: action.value, submitMessage: action.message ?? '', submittedAt: action.submittedAt ?? state.submittedAt };
    case 'HYDRATE':
      if (!action.payload || typeof action.payload !== 'object') return state;
      return {
        ...state,
        bracket: action.payload.bracket && typeof action.payload.bracket === 'object' ? action.payload.bracket : state.bracket,
        champion: typeof action.payload.champion === 'string' ? action.payload.champion : state.champion,
        identity: action.payload.identity && typeof action.payload.identity === 'object' ? { ...state.identity, ...action.payload.identity } : state.identity,
        activeRound: typeof action.payload.activeRound === 'string' ? action.payload.activeRound : state.activeRound,
      };
    default:
      return state;
  }
}

const Ctx = createContext(null);
export function BracketStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}
export function useBracketState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBracketState must be used inside BracketStateProvider');
  return ctx;
}
```

- [ ] **Step 2: Create `src/bracket/useBracketAutosave.js`** (mirror `src/form/useAutosave.js`, key `wc-bracket-draft`)

```js
import { useEffect, useRef } from 'react';

const KEY = 'wc-bracket-draft';
const DEBOUNCE_MS = 500;

export function loadBracketDraft() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearBracketDraft() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

export function useBracketAutosave(state) {
  const timerRef = useRef(null);
  const snapshotRef = useRef(null);
  snapshotRef.current = {
    bracket: state.bracket, champion: state.champion,
    identity: state.identity, activeRound: state.activeRound,
  };
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(snapshotRef.current)); } catch { /* noop */ }
    }, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state.bracket, state.champion, state.identity, state.activeRound]);
  useEffect(() => {
    const saveNow = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      try { localStorage.setItem(KEY, JSON.stringify(snapshotRef.current)); } catch { /* noop */ }
    };
    const onVis = () => { if (document.visibilityState === 'hidden') saveNow(); };
    window.addEventListener('blur', saveNow);
    window.addEventListener('beforeunload', saveNow);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', saveNow);
      window.removeEventListener('beforeunload', saveNow);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
}
```

- [ ] **Step 3: Verify in the dev server**

Run: `npm run dev`, open `http://localhost:5173/bracket.html?mockKnockout=1`
Expected: shell renders (Task 8 Step 6 now succeeds); editing nothing yet, but no console errors and `wc-bracket-draft` appears in localStorage after mount.

- [ ] **Step 4: Commit**

```bash
git add src/bracket/state.jsx src/bracket/useBracketAutosave.js
git commit -m "feat(bracket): reducer + autosave"
```

## Task 10: Shared score-input className + round tabs + matchup cards

**Files:**
- Create: `src/shared/scoreInput.js` (polish #4)
- Modify: `src/form/components/MatchInputs.jsx`, `src/form/components/SubmitModal.jsx` (use the const)
- Create: `src/bracket/components/RoundTabs.jsx`, `src/bracket/components/BracketRound.jsx`

- [ ] **Step 1: Create `src/shared/scoreInput.js`**

```js
// Shared Tailwind class string for the small numeric score inputs used by the
// group form and the bracket. Keep DRY — see docs/HANDOFF.md pending item #4.
export const SCORE_INPUT_CLASS =
  'w-12 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-center text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';
```

- [ ] **Step 2: Use the const in `MatchInputs.jsx`** — add `import { SCORE_INPUT_CLASS } from '../../shared/scoreInput.js';` and replace both `className="w-12 rounded-md …emerald-500"` literals on the two `<input>`s with `className={SCORE_INPUT_CLASS}`. Do the same for any matching score-input literal in `SubmitModal.jsx`.

- [ ] **Step 3: Verify the group form is visually unchanged**

Run: `npm run dev`, open `http://localhost:5173/` — score inputs look/behave exactly as before.

- [ ] **Step 4: Create `src/bracket/components/RoundTabs.jsx`** (mirrors `GroupTabs`; completion = all slots in the round have an advancer)

```jsx
import { useBracketState } from '../state.jsx';
import { KO_ROUND_ORDER } from '../../../lib/bracket.js';

const LABELS = { R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', F: '🏆 Final' };

function roundStatus(round, knockout, bracket) {
  const slots = knockout.rounds[round] || [];
  if (slots.length === 0) return 'empty';
  let filled = 0;
  for (const s of slots) if (bracket[s.slot]?.advances) filled++;
  if (filled === 0) return 'empty';
  return filled === slots.length ? 'complete' : 'partial';
}

export function RoundTabs({ knockout }) {
  const { state, dispatch } = useBracketState();
  const rounds = KO_ROUND_ORDER.filter((r) => (knockout.rounds[r] || []).length > 0);
  return (
    <div className="mx-auto mb-4 grid max-w-2xl grid-cols-5 gap-2">
      {rounds.map((round) => {
        const status = roundStatus(round, knockout, state.bracket);
        const isActive = state.activeRound === round;
        const base = 'inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors min-h-10';
        let colors;
        if (isActive) colors = 'bg-emerald-500 text-slate-950 font-semibold';
        else if (status === 'complete') colors = 'bg-slate-800 text-emerald-300 ring-1 ring-inset ring-emerald-500/40 hover:bg-slate-700';
        else if (status === 'partial') colors = 'bg-slate-800 text-amber-300 ring-1 ring-inset ring-amber-500/40 hover:bg-slate-700';
        else colors = 'bg-slate-800 text-slate-400 hover:bg-slate-700';
        return (
          <button key={round} type="button" className={`${base} ${colors}`} onClick={() => dispatch({ type: 'SET_ACTIVE_ROUND', round })}>
            <span>{LABELS[round]}</span>
            {status === 'complete' && <span className="text-xs">✓</span>}
            {status === 'partial' && <span className="text-xs">●</span>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/bracket/components/BracketRound.jsx`** (matchup cards for the active round; score inputs derive the advancer; tie shows a pens toggle; final shows a champion confirmation)

```jsx
import { useBracketState } from '../state.jsx';
import { teamName, teamFlag } from '../../shared/teamNames.js';
import { SCORE_INPUT_CLASS } from '../../shared/scoreInput.js';

function parseScore(raw) {
  if (raw === '') return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

// matchupsForRound: slot -> { home, away } from resolveMatchups (Task 11 passes it in).
export function BracketRound({ knockout, matchups }) {
  const { state, dispatch } = useBracketState();
  const round = state.activeRound;
  const slots = knockout.rounds[round] || [];
  const isFinal = round === 'F';

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{round === 'F' ? 'Final' : round}</h2>
      <ol className="space-y-2">
        {slots.map((slot) => {
          const { home, away } = matchups[slot.slot] || { home: null, away: null };
          const pick = state.bracket[slot.slot] || { home_score: null, away_score: null, advances: null };
          const ready = home && away;
          const decided = Number.isInteger(pick.home_score) && Number.isInteger(pick.away_score);
          const tie = decided && pick.home_score === pick.away_score;
          const setScore = (side) => (e) =>
            dispatch({ type: 'SET_SLOT_SCORE', slot: slot.slot, side, value: parseScore(e.target.value), home, away });

          const rowCls = ['rounded-lg border border-slate-800 bg-slate-900 px-3 py-2', pick.advances && 'border-l-4 border-l-emerald-500/70'].filter(Boolean).join(' ');
          return (
            <li key={slot.slot} className={rowCls}>
              {!ready ? (
                <p className="text-center text-sm text-slate-500">Pick the previous round to set this matchup.</p>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className={`flex-1 text-right text-sm ${pick.advances === home ? 'font-semibold text-emerald-300' : 'text-slate-200'}`}>
                      {teamName(home)} <span className="ml-1">{teamFlag(home)}</span>
                    </span>
                    <input type="number" min={0} max={20} step={1} inputMode="numeric"
                      value={pick.home_score == null ? '' : String(pick.home_score)} onChange={setScore('home_score')} className={SCORE_INPUT_CLASS} />
                    <span className="text-slate-500">–</span>
                    <input type="number" min={0} max={20} step={1} inputMode="numeric"
                      value={pick.away_score == null ? '' : String(pick.away_score)} onChange={setScore('away_score')} className={SCORE_INPUT_CLASS} />
                    <span className={`flex-1 text-sm ${pick.advances === away ? 'font-semibold text-emerald-300' : 'text-slate-200'}`}>
                      <span className="mr-1">{teamFlag(away)}</span> {teamName(away)}
                    </span>
                  </div>
                  {tie && (
                    <div className="mt-2 flex items-center justify-center gap-2 border-t border-dashed border-slate-700 pt-2 text-xs text-slate-300">
                      <span>Advances on pens:</span>
                      {[home, away].map((t) => (
                        <button key={t} type="button"
                          onClick={() => dispatch({ type: 'SET_SLOT_ADVANCER', slot: slot.slot, team: t })}
                          className={`rounded-full border px-2 py-0.5 ${pick.advances === t ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
                          {teamFlag(t)} {t}
                        </button>
                      ))}
                    </div>
                  )}
                  {isFinal && pick.advances && (
                    <p className="mt-2 text-center text-sm text-emerald-300">🏆 Champion: {teamFlag(pick.advances)} {teamName(pick.advances)}</p>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/scoreInput.js src/form/components/MatchInputs.jsx src/form/components/SubmitModal.jsx src/bracket/components/RoundTabs.jsx src/bracket/components/BracketRound.jsx
git commit -m "feat(bracket): round tabs + matchup cards; extract shared score-input class"
```

## Task 11: Wire connected propagation + champion sync into the entry UI

**Files:**
- Create: `src/bracket/components/BracketEntry.jsx`
- Modify: `src/bracket/BracketBody.jsx` (mount `BracketEntry`)

- [ ] **Step 1: Create `src/bracket/components/BracketEntry.jsx`** (computes matchups from picks via `resolveMatchups`, keeps `champion` synced to the final advancer)

```jsx
import { useEffect, useMemo } from 'react';
import { useBracketState } from '../state.jsx';
import { resolveMatchups, KO_ROUND_ORDER } from '../../../lib/bracket.js';
import { RoundTabs } from './RoundTabs.jsx';
import { BracketRound } from './BracketRound.jsx';
import { BracketReview } from './BracketReview.jsx';
import { BracketSubmitModal } from './BracketSubmitModal.jsx';
import { ErrorSummary } from '../../form/components/ErrorSummary.jsx';

export function BracketEntry({ knockout, config }) {
  const { state, dispatch } = useBracketState();

  const matchups = useMemo(
    () => resolveMatchups(knockout, (slot) => state.bracket[slot]?.advances ?? null),
    [knockout, state.bracket]
  );

  // Keep champion synced to the final slot's advancer.
  const finalSlot = (knockout.rounds.F || [])[0];
  const finalAdvancer = finalSlot ? state.bracket[finalSlot.slot]?.advances ?? null : null;
  useEffect(() => {
    if (finalAdvancer !== state.champion) dispatch({ type: 'SET_CHAMPION', team: finalAdvancer });
  }, [finalAdvancer, state.champion, dispatch]);

  const totalSlots = KO_ROUND_ORDER.reduce((n, r) => n + (knockout.rounds[r]?.length || 0), 0);
  const filledSlots = Object.values(state.bracket).filter((s) => s.advances).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{filledSlots} / {totalSlots} picks made</p>
      <ErrorSummary errors={state.errors} />
      <RoundTabs knockout={knockout} />
      <BracketRound knockout={knockout} matchups={matchups} />
      <BracketReview knockout={knockout} matchups={matchups} />
      <BracketSubmitModal knockout={knockout} appsScriptUrl={config.apps_script_url} />
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `BracketBody.jsx`** — replace the `<div id="bracket-entry-mount" />` placeholder with:

```jsx
import { BracketEntry } from './components/BracketEntry.jsx';
// ...
        <BracketEntry knockout={knockout} config={config} />
```

(Add a `submitted` short-circuit mirroring the form: when `state.submitState === 'submitted'`, render a "Bracket submitted — view leaderboard" panel instead of `BracketEntry`, reusing the `SubmittedView` style.)

- [ ] **Step 3: Verify connected propagation in the dev server**

Run: `npm run dev`, open `http://localhost:5173/bracket.html?mockKnockout=1`
Expected: R32 tab shows BRA/KOR, MEX/GER, FRA/SUI, ARG/NGA. Enter `2-0` for BRA/KOR → BRA bolds green. Fill all R32; switch to R16 → matchups show the advancers you chose. Enter a `1-1` tie → pens toggle appears; pick a team → it advances. Reach the Final → champion line appears. Reload → picks persist (autosave).

- [ ] **Step 4: Commit**

```bash
git add src/bracket/components/BracketEntry.jsx src/bracket/BracketBody.jsx
git commit -m "feat(bracket): connected propagation + champion sync"
```

## Task 12: Review tree + submit

**Files:**
- Create: `src/shared/bracketTree.jsx`, `src/bracket/components/BracketReview.jsx`, `src/bracket/components/BracketSubmitModal.jsx`, `src/bracket/submit.js`, `src/bracket/bracketPicks.js`

- [ ] **Step 1: Create `src/bracket/bracketPicks.js`** (build the submission payload from state)

```js
// Assemble the knockout picks_json payload from bracket state + resolved matchups.
export function buildBracketPayload(state, matchups, knockout) {
  const bracket = {};
  for (const round of Object.keys(knockout.rounds)) {
    for (const slot of knockout.rounds[round]) {
      const m = matchups[slot.slot] || {};
      const pick = state.bracket[slot.slot] || {};
      bracket[slot.slot] = {
        match_id: slot.match_id ?? null,
        home: m.home ?? null,
        away: m.away ?? null,
        home_score: pick.home_score ?? null,
        away_score: pick.away_score ?? null,
        advances: pick.advances ?? null,
      };
    }
  }
  return { bracket, champion: state.champion ?? null };
}
```

- [ ] **Step 2: Create `src/shared/bracketTree.jsx`** (read-only renderer, shared by review + leaderboard tab; horizontal columns, scrolls on narrow screens)

```jsx
import { KO_ROUND_ORDER } from '../../lib/bracket.js';
import { teamFlag } from './teamNames.js';

const LABELS = { R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', F: 'Final' };

// slotInfo(slot) -> { home, away, advances, cls? } where cls is an optional
// status class ('hit'|'miss'|'pending') used by the leaderboard tab.
export function BracketTree({ knockout, slotInfo }) {
  const rounds = KO_ROUND_ORDER.filter((r) => (knockout.rounds[r] || []).length > 0);
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {rounds.map((round) => (
        <div key={round} className="flex min-w-[120px] flex-col justify-around">
          <div className="mb-2 text-center text-[11px] uppercase tracking-wide text-slate-500">{LABELS[round]}</div>
          {knockout.rounds[round].map((slot) => {
            const info = slotInfo(slot.slot) || {};
            const statusCls = info.cls === 'hit' ? 'border-emerald-500/60' : info.cls === 'miss' ? 'border-rose-500/40' : 'border-slate-700';
            return (
              <div key={slot.slot} className={`my-1 rounded-md border ${statusCls} text-xs`}>
                {[info.home, info.away].map((t, i) => (
                  <div key={i} className={`px-2 py-1 ${info.advances && info.advances === t ? 'font-semibold text-emerald-300' : 'text-slate-300'} ${i === 0 ? 'border-b border-slate-800' : ''}`}>
                    {t ? <>{teamFlag(t)} {t}</> : <span className="text-slate-600">—</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/bracket/components/BracketReview.jsx`** (collapsible read-only tree of the player's current picks)

```jsx
import { useState } from 'react';
import { useBracketState } from '../state.jsx';
import { BracketTree } from '../../shared/bracketTree.jsx';

export function BracketReview({ knockout, matchups }) {
  const { state } = useBracketState();
  const [open, setOpen] = useState(false);
  const slotInfo = (slot) => {
    const m = matchups[slot] || {};
    return { home: m.home, away: m.away, advances: state.bracket[slot]?.advances ?? null };
  };
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <button type="button" className="text-sm font-medium text-emerald-300 hover:underline" onClick={() => setOpen((v) => !v)}>
        {open ? '▾ Hide bracket review' : '▸ Review full bracket'}
      </button>
      {open && <div className="mt-3"><BracketTree knockout={knockout} slotInfo={slotInfo} /></div>}
    </section>
  );
}
```

- [ ] **Step 4: Create `src/bracket/submit.js`** (mirror `src/form/submit.js`; validate with `validateBracket`, POST `phase:'knockout'`)

```js
import { validateBracket } from '../../lib/validate.js';
import { buildBracketPayload } from './bracketPicks.js';

export async function submitBracket({ state, matchups, knockout, appsScriptUrl, dispatch, onClearDraft }) {
  const picks = buildBracketPayload(state, matchups, knockout);
  const submission = { identity: state.identity, picks };
  const { valid, errors } = validateBracket(submission, knockout);
  dispatch({ type: 'SET_ERRORS', errors });
  if (!valid) {
    dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: 'Please fix the errors above before submitting.' });
    return;
  }
  dispatch({ type: 'SET_SUBMIT_STATE', value: 'submitting' });
  try {
    const res = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        name: state.identity.name, email: state.identity.email, secret: state.identity.secret,
        picks, phase: 'knockout', client_version: '2',
      }),
    });
    const data = await res.json();
    if (data.error === 'locked') return dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: 'Bracket submissions are closed. Visit the leaderboard.' });
    if (data.error === 'secret_mismatch') return dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: "A bracket already exists for this email and the secret doesn't match. Use your bracket secret, or a different email." });
    if (!data.ok) return dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: `Couldn't save: ${data.error || 'unknown error'}.` });
    dispatch({ type: 'SET_SUBMIT_STATE', value: 'submitted', submittedAt: data.submitted_at });
    onClearDraft?.();
  } catch {
    dispatch({ type: 'SET_SUBMIT_STATE', value: 'error', message: "Couldn't save. Your bracket is still here — try again." });
  }
}
```

- [ ] **Step 5: Create `src/bracket/components/BracketSubmitModal.jsx`** (native `<dialog>` recap + identity form; mirror `SubmitModal.jsx`'s centering `fixed inset-0 m-auto h-fit max-h-[90vh]` and the secret/name/email/acknowledge fields). The recap embeds `<BracketTree>` read-only. On confirm, call `submitBracket({ state, matchups, knockout, appsScriptUrl, dispatch, onClearDraft: clearBracketDraft })`.

> Reuse the exact field markup, validation-error wiring, and dialog centering
> classes from `src/form/components/SubmitModal.jsx`. The only content
> differences: title "Submit your bracket", the recap is `<BracketTree>` instead
> of the group-pick recap, and the secret helper text reads "Use any secret — if
> you forgot your group-stage one, set a new one here."

- [ ] **Step 6: Verify the full entry → review → submit flow in the dev server**

Run: `npm run dev`, open `http://localhost:5173/bracket.html?mockKnockout=1`
Expected: fill the whole sample bracket; "Review full bracket" shows the tree with your advancers; open the submit modal → recap tree + identity form; submitting with an incomplete bracket lists slot errors; a complete one posts (will hit the live Apps Script — use a throwaway email, or point `apps_script_url` at a test deployment).

- [ ] **Step 7: Commit**

```bash
git add src/shared/bracketTree.jsx src/bracket/components/BracketReview.jsx src/bracket/components/BracketSubmitModal.jsx src/bracket/submit.js src/bracket/bracketPicks.js
git commit -m "feat(bracket): review tree + submit (phase=knockout)"
```

---

# Phase 4 — Reporting

## Task 13: Merge phases per email + phase detection

**Files:**
- Modify: `src/leaderboard/App.jsx`

- [ ] **Step 1: Add phase + knockout loading and per-email merge.** Edits to `App.jsx`:

(a) Add state: `const [knockout, setKnockout] = useState(null);`

(b) In the load effect, fetch knockout (graceful) alongside results:

```js
        const [c, f, r] = await Promise.all([...]); // unchanged
        setConfig(c); setFixtures(f);
        fetch('/knockout.json').then((x) => (x.ok ? x.json() : null)).then(setKnockout).catch(() => {});
```

(c) Replace the `entries` useMemo to group by `email_hash`, score both phases, and total them:

```js
import { scoreSubmission, scoreBracket } from '../../lib/score.js';
// ...
  const entries = useMemo(() => {
    if (!fixtures || !results || !submissions?.length) return [];
    const byEmail = new Map();
    for (const sub of submissions) {
      const key = sub.email_hash;
      const row = byEmail.get(key) || { name: sub.name, email_hash: key, group: null, knockout: null };
      if (sub.phase === 'knockout') row.knockout = sub; else row.group = sub;
      row.name = sub.name; // latest name wins
      byEmail.set(key, row);
    }
    const rows = [...byEmail.values()].map((row) => {
      const groupScoring = row.group ? scoreSubmission(row.group.picks, fixtures, results) : null;
      const bracketScoring = (row.knockout && knockout) ? scoreBracket(row.knockout.picks.bracket, knockout, results) : null;
      const groupTotal = groupScoring ? groupScoring.total : 0;
      const bracketTotal = bracketScoring ? bracketScoring.bracket_total : 0;
      return {
        name: row.name, email_hash: row.email_hash,
        groupSub: row.group, knockoutSub: row.knockout,
        // Back-compat aliases so the existing group PickModal/MatchModal keep
        // working unchanged: `picks` = the group picks, `scoring` = group scoring.
        picks: row.group ? row.group.picks : null,
        scoring: groupScoring, bracketScoring,
        groupTotal, bracketTotal, total: groupTotal + bracketTotal,
      };
    });
    rows.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const ax = a.scoring?.exact_score_count ?? 0, bx = b.scoring?.exact_score_count ?? 0;
      if (bx !== ax) return bx - ax;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [fixtures, results, submissions, knockout]);

  const inKnockoutPhase = useMemo(() => {
    if (!knockout || !results) return false;
    for (const round of Object.values(knockout.rounds))
      for (const slot of round)
        if (slot.match_id && isMatchFinal(results.matches?.[slot.match_id]?.status)) return true;
    return false;
  }, [knockout, results]);
```

Add `import { isMatchFinal } from '../../lib/status.js';`.

> Note: `entries[]` rows gain `total`/`groupTotal`/`bracketTotal`/`groupSub`/
> `knockoutSub`/`bracketScoring`, but keep the back-compat `picks` (group picks)
> and `scoring` (group scoring) aliases — so the existing group `PickModal` and
> `MatchModal` rendering needs NO changes. Task 14 adds the new columns; Task 15
> adds the knockout tab additively; Task 16 only touches knockout match
> resolution. The group-match `MatchModal` drilldown keeps reading
> `entry.picks.matches[mid]` and `entry.scoring.match_points[mid]` unchanged.

- [ ] **Step 2: Verify the existing (group-only) board still renders**

Run: `npm run dev`, open `http://localhost:5173/leaderboard.html?mockLeaderboard=1`
Expected: board still renders (after Task 14 the columns/totals reflect the new shape; for now expect the table to need the Task 14 prop changes — if it throws on `entry.scoring.total`, that's fixed next).

- [ ] **Step 3: Commit**

```bash
git add src/leaderboard/App.jsx
git commit -m "feat(leaderboard): merge group+knockout per email, phase detection"
```

## Task 14: Overall-first table + prize cards

**Files:**
- Modify: `src/leaderboard/components/LeaderboardTable.jsx`
- Create: `src/leaderboard/components/PrizeCards.jsx`
- Modify: `src/leaderboard/App.jsx` (render PrizeCards + pass `inKnockoutPhase`)

- [ ] **Step 1: Update `LeaderboardTable.jsx`** to show Group/Knockout/Total columns when `inKnockoutPhase`, and just Total otherwise. Read `entry.total`, `entry.groupTotal`, `entry.bracketTotal`. Keep the existing row-click → `onRowClick(entry)`.

```jsx
export function LeaderboardTable({ entries, onRowClick, inKnockoutPhase }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-slate-500">
          <th className="px-2 py-2 text-right">#</th>
          <th className="px-2 py-2 text-left">Player</th>
          {inKnockoutPhase && <th className="px-2 py-2 text-right font-normal text-slate-500">Group</th>}
          {inKnockoutPhase && <th className="px-2 py-2 text-right text-emerald-400">Knockout</th>}
          <th className="px-2 py-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => (
          <tr key={entry.email_hash} className="cursor-pointer border-t border-slate-800 hover:bg-slate-800/50" onClick={() => onRowClick(entry)}>
            <td className="px-2 py-2 text-right text-slate-500">{i + 1}</td>
            <td className="px-2 py-2 text-left text-slate-200">{entry.name}</td>
            {inKnockoutPhase && <td className="px-2 py-2 text-right text-slate-400">{entry.groupTotal}</td>}
            {inKnockoutPhase && <td className="px-2 py-2 text-right font-semibold text-emerald-300">{entry.bracketTotal}</td>}
            <td className="px-2 py-2 text-right font-bold text-white">{entry.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

> If the current `LeaderboardTable` renders extra columns (exact-score flair, perfect-group badges), preserve them in the non-knockout branch — keep today's group-phase board visually intact; only add the Group/Knockout columns when `inKnockoutPhase`.

- [ ] **Step 2: Create `src/leaderboard/components/PrizeCards.jsx`**

```jsx
// Two prize cards shown during the knockout phase: the group prize is frozen
// (decided at group end), the overall prize is the live race.
export function PrizeCards({ entries, buyIn }) {
  if (!entries.length) return null;
  const pot = entries.length * (buyIn || 0);
  const groupLeader = [...entries].sort((a, b) => b.groupTotal - a.groupTotal)[0];
  const overallLeader = entries[0]; // entries are already sorted by total
  const fmt = (n) => `$${Math.round(n)}`;
  return (
    <div className="mb-4 flex gap-3">
      <div className="flex-1 rounded-xl border border-slate-600 bg-slate-900 p-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Group prize · 30%</div>
        <div className="mt-1 text-base font-bold text-white">🥇 {groupLeader.name} — {groupLeader.groupTotal}</div>
        <div className="mt-0.5 text-xs font-semibold text-slate-400">DECIDED · {fmt(pot * 0.3)} locked in</div>
      </div>
      <div className="flex-1 rounded-xl border border-emerald-600 bg-slate-900 p-3 ring-1 ring-emerald-600/40">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Overall prize · 70%</div>
        <div className="mt-1 text-base font-bold text-white">🔥 {overallLeader.name} — {overallLeader.total}</div>
        <div className="mt-0.5 text-xs font-semibold text-emerald-400">LIVE · {fmt(pot * 0.7)}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Render in `App.jsx`** — inside the `locked` branch, above `LeaderboardTable`, when `inKnockoutPhase`:

```jsx
{inKnockoutPhase && <PrizeCards entries={entries} buyIn={config.buy_in_usd} />}
<LeaderboardTable entries={entries} onRowClick={setModalEntry} inKnockoutPhase={inKnockoutPhase} />
```

Add the import.

- [ ] **Step 4: Verify in the dev server**

Run: `npm run dev`, open `http://localhost:5173/leaderboard.html?mockLeaderboard=1` (group-only: no prize cards, single Total column) and the knockout mock added in Task 17.
Expected: group-only board unchanged; column logic gated on `inKnockoutPhase`.

- [ ] **Step 5: Commit**

```bash
git add src/leaderboard/components/LeaderboardTable.jsx src/leaderboard/components/PrizeCards.jsx src/leaderboard/App.jsx
git commit -m "feat(leaderboard): overall-first table + prize cards"
```

## Task 15: Tabbed PickModal + knockout drilldown

**Files:**
- Modify: `src/leaderboard/components/PickModal.jsx`
- Create: `src/leaderboard/components/KnockoutPicks.jsx`

- [ ] **Step 1: Add `[Group]/[Knockout]` tabs to `PickModal.jsx`.** Keep the existing group content as the Group tab body **unchanged** (it reads `entry.scoring` and `entry.picks`, which the Task 13 aliases preserve). Add a `const [tab, setTab] = useState('group')`; show the Knockout tab only when `entry.knockoutSub` exists.

Header total line becomes:
```jsx
Total: <span className="text-emerald-300 font-semibold">{entry.total}</span>
<span className="text-slate-600"> · </span>Group: {entry.groupTotal}
{entry.knockoutSub && <><span className="text-slate-600"> · </span>Knockout: {entry.bracketTotal}</>}
```

Tab strip under the header:
```jsx
<div className="flex gap-2 border-b border-slate-800 px-5 pt-2">
  <button type="button" onClick={() => setTab('group')} className={tab === 'group' ? 'border-b-2 border-emerald-400 pb-1 text-emerald-300' : 'pb-1 text-slate-400'}>Group</button>
  {entry.knockoutSub && <button type="button" onClick={() => setTab('knockout')} className={tab === 'knockout' ? 'border-b-2 border-emerald-400 pb-1 text-emerald-300' : 'pb-1 text-slate-400'}>Knockout</button>}
</div>
```

Body switches on `tab`; render `<KnockoutPicks entry={entry} knockout={knockout} results={results} />` for the knockout tab. `PickModal` now needs a `knockout` prop — pass it from `App.jsx` (`<PickModal ... knockout={knockout} />`).

- [ ] **Step 2: Create `src/leaderboard/components/KnockoutPicks.jsx`** (the player's bracket via the shared tree, colored by hit/miss against actuals)

```jsx
import { resolveActualBracket } from '../../../lib/bracket.js';
import { BracketTree } from '../../shared/bracketTree.jsx';

export function KnockoutPicks({ entry, knockout, results }) {
  const picks = entry.knockoutSub.picks.bracket;
  const { advancers, matchInfo } = resolveActualBracket(knockout, results);
  const s = entry.bracketScoring;

  const slotInfo = (slot) => {
    const pick = picks[slot] || {};
    const actual = matchInfo[slot] || {};
    let cls = 'pending';
    if (actual.final) cls = pick.advances && pick.advances === actual.advances ? 'hit' : 'miss';
    return { home: pick.home, away: pick.away, advances: pick.advances, cls };
  };

  return (
    <div className="space-y-3">
      {s && (
        <p className="text-xs text-slate-400">
          Bracket: <span className="font-semibold text-emerald-300">{s.bracket_total}</span> pts ·
          R32 {s.round_totals.R32} · R16 {s.round_totals.R16} · QF {s.round_totals.QF} · SF {s.round_totals.SF} ·
          Finalists {s.finalist_points} · Champion {s.champion_points} · Exact +{s.exact_bonus}
        </p>
      )}
      <BracketTree knockout={knockout} slotInfo={slotInfo} />
      <p className="text-xs text-slate-500">Champion pick: {entry.knockoutSub.picks.champion || '—'}</p>
    </div>
  );
}
```

- [ ] **Step 3: Verify in the dev server** (uses Task 17 mock)

Run: `npm run dev`, open the knockout leaderboard mock; click a row → modal opens on Group tab; switch to Knockout → bracket tree with hit/miss coloring + the points breakdown.

- [ ] **Step 4: Commit**

```bash
git add src/leaderboard/components/PickModal.jsx src/leaderboard/components/KnockoutPicks.jsx src/leaderboard/App.jsx
git commit -m "feat(leaderboard): tabbed pick modal with knockout drilldown"
```

## Task 16: Knockout-first match strip + brackets-submitted count

**Files:**
- Modify: `src/leaderboard/components/MatchStrip.jsx`
- Modify: `src/leaderboard/App.jsx`

- [ ] **Step 1: Make `MatchStrip` knockout-aware.** Accept `knockout` and `inKnockoutPhase` props. When `inKnockoutPhase`, build the prominent chips from finished knockout matches (iterate `knockout.rounds`, pick those with a final result), labeled by round (R32/R16/QF/SF/Final); demote the group matches into the existing `<select>` ("Group stage matches"). When not in knockout phase, behave exactly as today.

Knockout chip data:
```jsx
function knockoutChips(knockout, results) {
  const out = [];
  for (const round of ['F', 'SF', 'QF', 'R16', 'R32']) {
    for (const slot of (knockout.rounds[round] || [])) {
      const r = slot.match_id ? results.matches?.[slot.match_id] : null;
      if (r && isMatchFinal(r.status)) out.push({ mid: slot.match_id, round, r });
    }
  }
  return out;
}
```
Render these as the top row (most advanced round first). The `MatchModal` for a knockout match is reached via the same `onSelect(mid)` — `MatchModal` already keys off `fixtures.matches[mid]`; for knockout matches it must fall back to `knockout` slot teams. (If `MatchModal` can't resolve a knockout `mid` from `fixtures`, pass `knockout` to it and resolve home/away from the slot — small follow-on edit in `MatchModal.jsx`.)

- [ ] **Step 2: Pre-knockout "brackets submitted" line in `App.jsx`.** When `knockout` exists, the group lock has passed, but `!inKnockoutPhase` (no KO match final yet), show a count of knockout submissions:

```jsx
{knockout && locked && !inKnockoutPhase && (
  <p className="mb-3 text-sm text-slate-400">
    🗳️ {entries.filter((e) => e.knockoutSub).length}/{entries.length} brackets submitted
  </p>
)}
```

- [ ] **Step 3: Verify in the dev server** (Task 17 mock)

Run: `npm run dev`, open the knockout mock with some KO matches final → knockout chips lead the strip, group matches in the dropdown; with no KO matches final but brackets present → the "N/N brackets submitted" line.

- [ ] **Step 4: Commit**

```bash
git add src/leaderboard/components/MatchStrip.jsx src/leaderboard/components/MatchModal.jsx src/leaderboard/App.jsx
git commit -m "feat(leaderboard): knockout-first match strip + brackets-submitted count"
```

## Task 17: Knockout mock data + CLAUDE.md note + full verification

**Files:**
- Modify: `src/leaderboard/mockData.js`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add knockout mock builders to `mockData.js`** so `?mockLeaderboard=1` can exercise the phase-2 board. Add `buildMockKnockout()` returning the `knockout.sample.json` shape, `buildMockKnockoutResults(knockout)` marking R32 (and some later) matches final with an `advances`, and extend `buildMockSubmissions` to also emit `phase:'knockout'` rows (one bracket per mock profile, built by advancing the home team each slot). Wire a `?mockKnockout=1` branch in `leaderboard/App.jsx`'s mock path to set `knockout` + merged results so the phase-2 UI renders end-to-end locally.

```js
export function buildMockKnockout() {
  return /* the public/knockout.sample.json object inline */;
}
export function buildMockKnockoutResults(knockout) {
  const matches = {};
  for (const round of Object.values(knockout.rounds)) {
    for (const slot of round) {
      if (!slot.match_id) continue;
      const home = slot.home || 'BRA';
      matches[slot.match_id] = { home_score: 2, away_score: 1, status: 'STATUS_FULL_TIME', advances: home };
    }
  }
  return matches;
}
```

- [ ] **Step 2: Add the CLAUDE.md gotcha note** (covers the new knockout renderer):

Append to the "Gotchas to remember" section:
```markdown
- **Knockout flair must also use `lib/score.js` constants, not literals.**
  The leaderboard Knockout tab (`KnockoutPicks.jsx`) colors slots hit/miss by
  comparing the player's `advances` to the actual advancer — it does NOT
  hardcode point thresholds. The shared score-input className lives in
  `src/shared/scoreInput.js` (used by the group form and the bracket); change
  it in one place.
```

- [ ] **Step 3: Full verification pass**

Run: `npm test`
Expected: all `lib/` tests pass (group + bracket + score + status + validate).

Run: `npm run build`
Expected: build succeeds; `dist/` contains `index.html`, `leaderboard.html`, AND `bracket.html`.

Run: `npm run dev` and walk all three pages:
- `index.html` — group form visually unchanged; score inputs work (shared className).
- `bracket.html?mockKnockout=1` — fill bracket → review → submit modal.
- `leaderboard.html?mockLeaderboard=1&mockKnockout=1` — prize cards, Group/Knockout/Total columns, knockout-first strip, tabbed modal with bracket drilldown.

- [ ] **Step 4: Commit**

```bash
git add src/leaderboard/mockData.js src/leaderboard/App.jsx CLAUDE.md
git commit -m "feat(leaderboard): knockout mock data + docs note"
```

## Task 18: Update HANDOFF.md + branch wrap

**Files:**
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: Document v2 in HANDOFF.md** — mark pending item #3 as implemented (on branch), add the knockout file map entries (`bracket.html`, `src/bracket/`, `lib/bracket.js`, `public/knockout.json`, `seed-knockout.mjs`), and add the **go-live runbook**:

```markdown
## v2 knockout go-live runbook (run ~Jun 27, after group stage ends)

1. `node scripts/seed-knockout.mjs` — verify the printed R32 tree against the
   official bracket; commit `public/knockout.json`.
2. Paste the printed first-kickoff ISO into `public/config.json` as
   `knockout_lock_iso`, and into the Apps Script script property
   `knockout_lock_iso`.
3. Paste `apps_script/Code.gs` into the Apps Script editor → Deploy → Manage
   deployments → New version. (URL unchanged.)
4. Merge `feat/v2-knockout-bracket` → `main`. CF Pages deploys `bracket.html`.
5. Confirm the cron picks up knockout match IDs (check `public/results.json`
   gains the knockout entries with `advances` after the first R32 matches).
6. Verify `lib/status.js` recognizes the actual ESPN AET/penalty status strings
   from the first knockout result; add any missing ones.
```

- [ ] **Step 2: Commit**

```bash
git add docs/HANDOFF.md
git commit -m "docs: v2 knockout file map + go-live runbook"
```

- [ ] **Step 3: Final branch check**

Run: `git log --oneline main..feat/v2-knockout-bracket`
Expected: the full task series of commits. Branch is ready for review/merge per the runbook (do NOT merge until the bracket is seeded ~Jun 27).

---

## Notes for the implementer

- **Do not merge to `main` early.** The bracket page is harmless pre-seed (it
  shows "opens after the group stage"), but merging is gated on the go-live
  runbook so the Apps Script `knockout_lock_iso` exists before any knockout POST.
- **`npm test` form matters:** `node --test lib/*.test.js`, never `node --test lib/`.
- **ESPN unknowns** (flagged inline): AET/penalty status strings (Task 3), and
  the real knockout-event shape for `seed-knockout` (Task 5). Both are validated
  against live data during the go-live runbook; the pure logic is tested now.
- **Out of scope** (noted in spec, untouched): `lib/leaderboardStats.js` dead
  code, `jsonResponse`'s informational `status` arg.
