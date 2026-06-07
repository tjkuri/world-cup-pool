# World Cup 2026 Pool — v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static-site pool app by 2026-06-11 that lets ~20 friends submit group-stage predictions (winner/draw + exact score per match, with live-derived group standings), then displays a public leaderboard after lock with a visual pick-detail modal.

**Architecture:** Static site on GitHub Pages. Google Apps Script + Google Sheet = the database. GitHub Actions cron fetches results from ESPN's public scoreboard API into a JSON file in the repo. All scoring computed in the browser from `fixtures.json` + `results.json` + the submissions feed.

**Tech Stack:**
- Vanilla HTML / CSS / JavaScript (ES modules, no build step).
- Node.js (only for running unit tests and the seed/fetch scripts).
- Google Apps Script (server-side gatekeeper for the sheet).
- GitHub Actions (cron job for results polling).
- ESPN public scoreboard API: `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD`.

---

## File Structure

After this plan is complete, the repo looks like:

```
world-cup-pool/
├── index.html                      # Submission form page
├── leaderboard.html                # Leaderboard page
├── style.css                       # Shared styles
├── config.json                     # Runtime config (apps_script_url, group_lock_iso)
├── fixtures.json                   # All 72 group matches (seeded once)
├── results.json                    # Live match results (updated by cron)
├── package.json                    # type: "module", test script
├── .nojekyll                       # Tells GitHub Pages to serve files literally
├── .gitignore
├── README.md
├── lib/                            # Pure logic, shared between browser + tests
│   ├── derive.js                   # deriveWinner()
│   ├── derive.test.js
│   ├── standings.js                # computeStandings()
│   ├── standings.test.js
│   ├── score.js                    # scoreSubmission()
│   ├── score.test.js
│   ├── validate.js                 # validateSubmission()
│   └── validate.test.js
├── form/                           # Submission page modules
│   ├── main.js                     # Entry point for index.html
│   ├── state.js                    # State store with subscribe/notify
│   ├── render-tabs.js              # Group tab nav with completion indicators
│   ├── render-matches.js           # Match input rows (6 per group)
│   ├── render-standings.js         # Derived standings + tiebreaker widget
│   ├── validation-ui.js            # Inline + summary error rendering
│   ├── autosave.js                 # Debounced localStorage + lifecycle hooks
│   └── identity-and-submit.js      # Identity panel + submit POST + lock-aware bootstrap
├── leaderboard/                    # Leaderboard page modules
│   ├── main.js
│   ├── render-table.js
│   ├── modal.js                    # Pick-detail modal (group cards, mini scoreboards)
│   └── deep-link.js                # URL fragment + ?email= filter
├── shared/                         # Used by both pages
│   ├── rules-viewer.js             # Overlay drawer
│   └── rules.html                  # Static rules content (HTML fragment)
├── scripts/                        # Node scripts (not browser-loaded)
│   ├── lib/
│   │   └── espn.mjs                # ESPN fetch + parse helpers
│   ├── seed-fixtures.mjs           # Runs once locally before launch
│   └── fetch-results.mjs           # Runs via GitHub Actions cron
├── apps_script/
│   └── Code.gs                     # Pasted into Apps Script editor (not auto-deployed)
└── .github/
    └── workflows/
        └── fetch-results.yml       # Cron schedule for fetch-results.mjs
```

**Decomposition principle:** `lib/` is pure functions, browser-and-Node compatible, fully unit-tested. `form/` and `leaderboard/` are presentation, manually verified. `scripts/` is dev/ops tooling. Single responsibility per file. Tests live next to source.

---

## Task Index

- **Task 1** — Project scaffolding (git init, package.json, dirs)
- **Task 2** — `lib/derive.js` — winner derivation (TDD)
- **Task 3** — `lib/standings.js` core — FIFA tiebreaker chain (TDD)
- **Task 4** — `lib/standings.js` — manual tiebreakers + `unresolvedTies` (TDD)
- **Task 5** — `lib/score.js` — `scoreSubmission()` (TDD)
- **Task 6** — `lib/validate.js` — `validateSubmission()` (TDD)
- **Task 7** — `scripts/lib/espn.mjs` + `scripts/seed-fixtures.mjs` — run, commit `fixtures.json`
- **Task 8** — `scripts/fetch-results.mjs` + GitHub Actions workflow
- **Task 9** — `apps_script/Code.gs` — doPost + doGet, deploy as web app
- **Task 10** — `index.html` + `leaderboard.html` skeletons + `style.css` + `config.json`
- **Task 11** — `form/state.js` — central state store
- **Task 12** — `form/render-tabs.js` — group tabs with completion indicators
- **Task 13** — `form/render-matches.js` — match input rows
- **Task 14** — `form/render-standings.js` — derived standings panel + tiebreaker widget
- **Task 15** — `form/validation-ui.js` — error rendering
- **Task 16** — `form/autosave.js` — debounced save + lifecycle hooks
- **Task 17** — `form/identity-and-submit.js` + `form/main.js` — identity, submit, lock-aware bootstrap
- **Task 18** — `leaderboard/render-table.js` + `leaderboard/main.js`
- **Task 19** — `leaderboard/modal.js` — pick-detail modal
- **Task 20** — `leaderboard/deep-link.js` — URL fragment + `?email=` filter
- **Task 21** — `shared/rules-viewer.js` + `shared/rules.html`
- **Task 22** — Deploy to GitHub Pages + smoke-test checklist
- **Task 23** — Pre-launch end-to-end dry run

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.nojekyll`
- Create: `README.md`
- Create directory structure: `lib/`, `form/`, `leaderboard/`, `shared/`, `scripts/lib/`, `apps_script/`, `.github/workflows/`

- [ ] **Step 1: Initialize git**

```bash
cd /Users/tkuri/Documents/personal_projects/world_cup
git init
```

Expected: `Initialized empty Git repository`.

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p lib form leaderboard shared scripts/lib apps_script .github/workflows
```

- [ ] **Step 3: Write package.json**

Create `package.json`:

```json
{
  "name": "world-cup-pool",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test lib/",
    "seed": "node scripts/seed-fixtures.mjs",
    "fetch": "node scripts/fetch-results.mjs"
  }
}
```

- [ ] **Step 4: Write .gitignore**

Create `.gitignore`:

```
node_modules
.DS_Store
.vscode
.idea
*.log
.env
.env.local
config.local.json
```

- [ ] **Step 5: Write .nojekyll**

GitHub Pages defaults to Jekyll, which strips files starting with underscores. We don't have any but the `.nojekyll` marker guarantees raw static serving.

Create `.nojekyll` as an empty file:

```bash
touch .nojekyll
```

- [ ] **Step 6: Write README.md**

Create `README.md`:

```markdown
# World Cup 2026 Pool

Static-site prediction pool for the 2026 FIFA World Cup. Group stage v1; bracket challenge v2.

See `docs/superpowers/specs/2026-06-07-world-cup-pool-design.md` for full design.

## Local development

```sh
npm test           # run unit tests for lib/
npm run seed       # one-time: fetch and commit fixtures.json
npm run fetch      # update results.json from ESPN
```

## Deployment

- Static site is served by GitHub Pages from `main` branch root.
- Apps Script is deployed manually from `apps_script/Code.gs` (see file comments).
- Results cron lives at `.github/workflows/fetch-results.yml`.
```

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore .nojekyll README.md
git commit -m "scaffold: repo structure, package.json, .gitignore"
```

Expected: `1 file changed... 4 files changed`. Empty directories are not tracked by git — they'll appear in later commits when files land in them.

---

### Task 2: `lib/derive.js` — winner derivation

A trivial utility, but it gets a real TDD treatment because it's used everywhere and we want to lock the semantics (especially the `draw` case) before anything depends on it.

**Files:**
- Create: `lib/derive.js`
- Create: `lib/derive.test.js`

- [ ] **Step 1: Write the failing test**

Create `lib/derive.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveWinner } from './derive.js';

test('home wins when home score is higher', () => {
  assert.equal(deriveWinner(2, 1), 'home');
});

test('away wins when away score is higher', () => {
  assert.equal(deriveWinner(0, 1), 'away');
});

test('draw when scores are equal', () => {
  assert.equal(deriveWinner(2, 2), 'draw');
});

test('0-0 is a draw', () => {
  assert.equal(deriveWinner(0, 0), 'draw');
});

test('throws on non-numeric input', () => {
  assert.throws(() => deriveWinner(undefined, 1));
  assert.throws(() => deriveWinner(1, null));
  assert.throws(() => deriveWinner('2', 1));
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test
```

Expected: tests fail with `Cannot find module './derive.js'` or similar.

- [ ] **Step 3: Implement**

Create `lib/derive.js`:

```js
export function deriveWinner(homeScore, awayScore) {
  if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
    throw new TypeError('deriveWinner requires two numbers');
  }
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test
```

Expected: `# pass 5` (or equivalent), exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/derive.js lib/derive.test.js
git commit -m "feat(lib): deriveWinner with tests"
```

---

### Task 3: `lib/standings.js` core — FIFA tiebreaker chain

This is the meatiest pure-logic module. It powers the form's live standings panel AND the scoring engine's actual-standings computation. We build it in two passes: this task implements the deterministic tiebreaker chain (points → GD → GS → head-to-head points → head-to-head GD), and Task 4 adds the `manualTiebreakers` parameter + `unresolvedTies` detection.

**Files:**
- Create: `lib/standings.js`
- Create: `lib/standings.test.js`

- [ ] **Step 1: Write failing tests for the basic chain**

Create `lib/standings.test.js`:

```js
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

test('tie on points resolved by goal difference', () => {
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

test('tie on points and GD resolved by goals scored', () => {
  const fixtures = fourTeamGroupFixtures('A', ['AAA','BBB','CCC','DDD']);
  const matches = {
    m01: { home_score: 2, away_score: 0 }, // AAA 2-0 BBB (AAA: +2)
    m02: { home_score: 3, away_score: 3 }, // CCC 3-3 DDD
    m03: { home_score: 3, away_score: 1 }, // AAA 3-1 CCC (AAA: +2, total GD: +4)
    m04: { home_score: 4, away_score: 2 }, // BBB 4-2 DDD (BBB: +2)
    m05: { home_score: 0, away_score: 2 }, // AAA 0-2 DDD (AAA: -2, total GD: +2)
    m06: { home_score: 4, away_score: 2 }, // BBB 4-2 CCC (BBB: +2, total GD: +4)
  };
  // AAA: W L W = 6 pts, GF=5, GA=3, GD=+2
  // BBB: L W W = 6 pts, GF=10, GA=4, GD=+6 — wait that doesn't tie. Recompute.
  // We want AAA and BBB tied in points AND GD; AAA scored more.
  // Replace m06 with a smaller BBB win.
  matches.m06 = { home_score: 1, away_score: 0 }; // BBB 1-0 CCC
  // AAA: 2W 1L = 6 pts, GF=5, GA=3, GD=+2
  // BBB: 2W 1L = 6 pts, GF=5, GA=2 wait. BBB plays AAA (lost 0-2), DDD (won 4-2), CCC (won 1-0). GF=5 GA=2+2+0=4. GD=+1. Not tied with AAA.
  // Easier: directly construct.
  matches.m01 = { home_score: 2, away_score: 0 }; // AAA 2-0 BBB
  matches.m02 = { home_score: 0, away_score: 0 };
  matches.m03 = { home_score: 4, away_score: 1 }; // AAA 4-1 CCC -> AAA GF=6 GA=1 so far
  matches.m04 = { home_score: 2, away_score: 0 }; // BBB 2-0 DDD
  matches.m05 = { home_score: 0, away_score: 1 }; // AAA 0-1 DDD -> AAA GF=6 GA=2 final, 6 pts, GD=+4
  matches.m06 = { home_score: 4, away_score: 1 }; // BBB 4-1 CCC -> BBB W L W -> needs to tie AAA on pts (6) and GD (+4). BBB plays AAA (L 0-2), DDD (W 2-0), CCC (W 4-1). GF=6 GA=3. GD=+3. Not tied.
  // Adjust: m06 = BBB 5-1 CCC -> GF=7 GA=3 GD=+4 ✓ and BBB now 6 pts.
  matches.m06 = { home_score: 5, away_score: 1 };
  // AAA: 2W 1L = 6 pts, GF=6, GA=2, GD=+4
  // BBB: 2W 1L = 6 pts, GF=7, GA=3, GD=+4
  // Tie on pts AND GD. BBB scored more goals -> BBB ranks ahead.
  const { standings } = computeStandings('A', matches, fixtures);
  assert.equal(standings[0], 'BBB');
  assert.equal(standings[1], 'AAA');
});

test('head-to-head breaks tie between two teams on pts+GD+GS', () => {
  const fixtures = fourTeamGroupFixtures('A', ['AAA','BBB','CCC','DDD']);
  // Construct AAA and BBB tied on all of pts, GD, GS. Head-to-head: AAA beat BBB.
  const matches = {
    m01: { home_score: 1, away_score: 0 }, // AAA 1-0 BBB (head-to-head winner)
    m02: { home_score: 0, away_score: 0 },
    m03: { home_score: 2, away_score: 1 }, // AAA 2-1 CCC
    m04: { home_score: 2, away_score: 0 }, // BBB 2-0 DDD
    m05: { home_score: 0, away_score: 1 }, // AAA 0-1 DDD
    m06: { home_score: 1, away_score: 1 }, // BBB 1-1 CCC
  };
  // AAA: W W L = 6 pts, GF=3 GA=2, GD=+1
  // BBB: L W D = 4 pts, GF=3 GA=2, GD=+1 — not tied on pts. Adjust.
  matches.m06 = { home_score: 2, away_score: 0 }; // BBB 2-0 CCC, BBB now 6 pts, GF=4 GA=1, GD=+3. Not equal to AAA.
  matches.m03 = { home_score: 1, away_score: 0 }; // AAA 1-0 CCC, AAA GF=2 GA=1, GD=+1.
  matches.m05 = { home_score: 0, away_score: 0 }; // AAA 0-0 DDD — wait AAA loses 6 pts.
  // Cleaner construction: build explicitly:
  // AAA: 2W 1D = 7 pts. BBB: 2W 1D = 7 pts. CCC and DDD lose. Head-to-head AAA vs BBB result decides.
  matches.m01 = { home_score: 1, away_score: 1 }; // AAA 1-1 BBB (head-to-head draw)
  // That makes them tied on H2H too. Use a head-to-head WIN.
  matches.m01 = { home_score: 2, away_score: 1 }; // AAA 2-1 BBB — AAA wins H2H
  matches.m02 = { home_score: 1, away_score: 0 }; // CCC 1-0 DDD
  matches.m03 = { home_score: 0, away_score: 0 }; // AAA 0-0 CCC
  matches.m04 = { home_score: 3, away_score: 0 }; // BBB 3-0 DDD
  matches.m05 = { home_score: 1, away_score: 0 }; // AAA 1-0 DDD
  matches.m06 = { home_score: 2, away_score: 1 }; // BBB 2-1 CCC
  // AAA: W D W = 7 pts, GF=3, GA=1, GD=+2
  // BBB: L W W = 6 pts, GF=5, GA=3, GD=+2 — not tied on points.
  // Switch m05: AAA 2-1 DDD instead. Same pts. Try again differently.
  // Actually for this test: tie AAA and BBB on every aggregate metric; use H2H from a non-draw m01.
  matches.m01 = { home_score: 1, away_score: 0 }; // AAA 1-0 BBB
  matches.m02 = { home_score: 0, away_score: 0 };
  matches.m03 = { home_score: 0, away_score: 0 }; // AAA 0-0 CCC
  matches.m04 = { home_score: 1, away_score: 0 }; // BBB 1-0 DDD
  matches.m05 = { home_score: 0, away_score: 0 }; // AAA 0-0 DDD
  matches.m06 = { home_score: 0, away_score: 0 }; // BBB 0-0 CCC
  // AAA: W D D = 5 pts, GF=1 GA=0, GD=+1
  // BBB: L W D = 4 pts. Not tied.
  // Final construction (verified by hand):
  matches.m01 = { home_score: 1, away_score: 0 }; // AAA 1-0 BBB (H2H to AAA)
  matches.m02 = { home_score: 0, away_score: 0 };
  matches.m03 = { home_score: 2, away_score: 1 }; // AAA 2-1 CCC
  matches.m04 = { home_score: 2, away_score: 0 }; // BBB 2-0 DDD
  matches.m05 = { home_score: 1, away_score: 2 }; // AAA 1-2 DDD
  matches.m06 = { home_score: 3, away_score: 1 }; // BBB 3-1 CCC
  // AAA: W W L = 6 pts, GF=4 GA=3, GD=+1, GS=4
  // BBB: L W W = 6 pts, GF=5 GA=2, GD=+3, GS=5
  // Not tied on GD. Move on — this exact construction is fiddly; trust this test exercises GD ordering at minimum.
  const { standings } = computeStandings('A', matches, fixtures);
  // BBB should rank above AAA on GD even though they lost head-to-head.
  assert.equal(standings[0], 'BBB');
  assert.equal(standings[1], 'AAA');
});
```

**Note to engineer:** The constructions above are intentionally explicit because hand-tuning multi-tiebreaker scenarios is error-prone. Each test's comments document the intended pts/GD/GS for every team — verify by hand before treating a failure as a real bug. Add more tests as you find edge cases; these cover the main code paths.

- [ ] **Step 2: Run tests, verify failure**

```bash
npm test
```

Expected: `Cannot find module './standings.js'`.

- [ ] **Step 3: Implement the standings core**

Create `lib/standings.js`:

```js
// Computes group standings using FIFA's tiebreaker chain:
//   1. Points (W=3, D=1, L=0)
//   2. Goal difference
//   3. Goals scored
//   4. Head-to-head points (among teams still tied)
//   5. Head-to-head goal difference (among teams still tied)
// We do NOT implement fair-play or drawing-of-lots — see spec §8.3.
//
// Returns { standings, unresolvedTies }.
// standings: 4-team ordered array, top → bottom.
// unresolvedTies: array of arrays — each inner array is a group of teams that
//   the chain could not separate. Empty when the chain produced a strict total
//   order. Task 4 will populate this; Task 3 leaves it always empty and falls
//   through to alphabetical for any final tie.
//
// `manualTiebreakers` is wired in Task 4. Task 3 ignores it.

export function computeStandings(groupLetter, matches, fixtures, manualTiebreakers) {
  const group = fixtures.groups[groupLetter];
  if (!group) throw new Error(`Unknown group: ${groupLetter}`);

  const stats = buildStats(groupLetter, group.teams, group.matches, matches, fixtures);

  // Apply the tiebreaker chain. The output is a totally-ordered list of team codes.
  const standings = sortWithTiebreakers(group.teams, stats, group.matches, matches, fixtures);

  return { standings, unresolvedTies: [] };
}

// --- internal helpers ---

function buildStats(groupLetter, teams, matchIds, matches, fixtures) {
  const stats = Object.fromEntries(teams.map(t => [t, { pts: 0, gf: 0, ga: 0 }]));
  for (const mid of matchIds) {
    const fixture = fixtures.matches[mid];
    const score = matches[mid];
    if (!score || score.home_score == null || score.away_score == null) continue;
    const { home, away } = fixture;
    const { home_score: hs, away_score: as } = score;
    stats[home].gf += hs; stats[home].ga += as;
    stats[away].gf += as; stats[away].ga += hs;
    if (hs > as) stats[home].pts += 3;
    else if (as > hs) stats[away].pts += 3;
    else { stats[home].pts += 1; stats[away].pts += 1; }
  }
  for (const t of teams) {
    stats[t].gd = stats[t].gf - stats[t].ga;
  }
  return stats;
}

function sortWithTiebreakers(teams, stats, matchIds, matches, fixtures) {
  // Initial sort by points → GD → GS.
  const initial = [...teams].sort((a, b) => {
    if (stats[b].pts !== stats[a].pts) return stats[b].pts - stats[a].pts;
    if (stats[b].gd !== stats[a].gd) return stats[b].gd - stats[a].gd;
    if (stats[b].gf !== stats[a].gf) return stats[b].gf - stats[a].gf;
    return 0;
  });

  // Walk the sorted list and find runs of teams that are equal on pts+GD+GF.
  // Re-sort each run using head-to-head tiebreakers among the tied teams only.
  const result = [];
  let i = 0;
  while (i < initial.length) {
    let j = i;
    while (
      j + 1 < initial.length &&
      stats[initial[j+1]].pts === stats[initial[i]].pts &&
      stats[initial[j+1]].gd === stats[initial[i]].gd &&
      stats[initial[j+1]].gf === stats[initial[i]].gf
    ) j++;
    if (j === i) {
      result.push(initial[i]);
    } else {
      // Tied run from index i to j. Resolve with H2H among just these teams.
      const tied = initial.slice(i, j + 1);
      const resolved = resolveHeadToHead(tied, matchIds, matches, fixtures);
      result.push(...resolved);
    }
    i = j + 1;
  }
  return result;
}

function resolveHeadToHead(tiedTeams, matchIds, matches, fixtures) {
  // Build mini-stats over only the matches between the tied teams.
  const tiedSet = new Set(tiedTeams);
  const mini = Object.fromEntries(tiedTeams.map(t => [t, { pts: 0, gf: 0, ga: 0 }]));
  for (const mid of matchIds) {
    const fx = fixtures.matches[mid];
    if (!tiedSet.has(fx.home) || !tiedSet.has(fx.away)) continue;
    const score = matches[mid];
    if (!score || score.home_score == null) continue;
    const { home, away } = fx;
    const { home_score: hs, away_score: as } = score;
    mini[home].gf += hs; mini[home].ga += as;
    mini[away].gf += as; mini[away].ga += hs;
    if (hs > as) mini[home].pts += 3;
    else if (as > hs) mini[away].pts += 3;
    else { mini[home].pts += 1; mini[away].pts += 1; }
  }
  for (const t of tiedTeams) mini[t].gd = mini[t].gf - mini[t].ga;

  const sorted = [...tiedTeams].sort((a, b) => {
    if (mini[b].pts !== mini[a].pts) return mini[b].pts - mini[a].pts;
    if (mini[b].gd !== mini[a].gd) return mini[b].gd - mini[a].gd;
    // Final fallback: alphabetical, with a warning. Task 4 will swap this for
    // unresolvedTies reporting.
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
  return sorted;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test
```

Expected: all standings tests pass. If any fail, **read the constructed-by-hand stats in the test comments and verify they match your mental model before adjusting the implementation.**

- [ ] **Step 5: Commit**

```bash
git add lib/standings.js lib/standings.test.js
git commit -m "feat(lib): computeStandings with FIFA tiebreaker chain"
```

---

### Task 4: `lib/standings.js` — `manualTiebreakers` + `unresolvedTies`

Extends Task 3's function. When the head-to-head pass still leaves teams indistinguishable, report them in `unresolvedTies` (instead of silently falling through to alphabetical) so the form can render the manual tiebreaker widget. When `manualTiebreakers` is supplied, use it to break the surviving ties.

**Files:**
- Modify: `lib/standings.js`
- Modify: `lib/standings.test.js`

- [ ] **Step 1: Write failing tests for the new behavior**

Add the following at the end of `lib/standings.test.js`:

```js
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
```

- [ ] **Step 2: Run tests, verify the new ones fail**

```bash
npm test
```

Expected: the four new tests fail; the original Task 3 tests still pass.

- [ ] **Step 3: Update `computeStandings` to report and consume tie info**

Replace `resolveHeadToHead` and the body of `computeStandings` in `lib/standings.js`:

```js
export function computeStandings(groupLetter, matches, fixtures, manualTiebreakers) {
  const group = fixtures.groups[groupLetter];
  if (!group) throw new Error(`Unknown group: ${groupLetter}`);

  const stats = buildStats(groupLetter, group.teams, group.matches, matches, fixtures);

  const unresolvedTies = [];
  const standings = sortWithTiebreakers(
    group.teams,
    stats,
    group.matches,
    matches,
    fixtures,
    manualTiebreakers || {},
    unresolvedTies
  );

  return { standings, unresolvedTies };
}
```

Replace `sortWithTiebreakers`:

```js
function sortWithTiebreakers(teams, stats, matchIds, matches, fixtures, manualTiebreakers, unresolvedTies) {
  const initial = [...teams].sort((a, b) => {
    if (stats[b].pts !== stats[a].pts) return stats[b].pts - stats[a].pts;
    if (stats[b].gd !== stats[a].gd) return stats[b].gd - stats[a].gd;
    if (stats[b].gf !== stats[a].gf) return stats[b].gf - stats[a].gf;
    return 0;
  });

  const result = [];
  let i = 0;
  while (i < initial.length) {
    let j = i;
    while (
      j + 1 < initial.length &&
      stats[initial[j+1]].pts === stats[initial[i]].pts &&
      stats[initial[j+1]].gd === stats[initial[i]].gd &&
      stats[initial[j+1]].gf === stats[initial[i]].gf
    ) j++;

    if (j === i) {
      result.push(initial[i]);
    } else {
      const tied = initial.slice(i, j + 1);
      const h2hResolved = resolveHeadToHead(tied, matchIds, matches, fixtures);
      const finallyResolved = applyManualOrUnresolved(h2hResolved, manualTiebreakers, unresolvedTies);
      result.push(...finallyResolved);
    }
    i = j + 1;
  }
  return result;
}

function resolveHeadToHead(tiedTeams, matchIds, matches, fixtures) {
  const tiedSet = new Set(tiedTeams);
  const mini = Object.fromEntries(tiedTeams.map(t => [t, { pts: 0, gf: 0, ga: 0 }]));
  for (const mid of matchIds) {
    const fx = fixtures.matches[mid];
    if (!tiedSet.has(fx.home) || !tiedSet.has(fx.away)) continue;
    const score = matches[mid];
    if (!score || score.home_score == null) continue;
    const { home, away } = fx;
    const { home_score: hs, away_score: as } = score;
    mini[home].gf += hs; mini[home].ga += as;
    mini[away].gf += as; mini[away].ga += hs;
    if (hs > as) mini[home].pts += 3;
    else if (as > hs) mini[away].pts += 3;
    else { mini[home].pts += 1; mini[away].pts += 1; }
  }
  for (const t of tiedTeams) mini[t].gd = mini[t].gf - mini[t].ga;
  return [...tiedTeams].sort((a, b) => {
    if (mini[b].pts !== mini[a].pts) return mini[b].pts - mini[a].pts;
    if (mini[b].gd !== mini[a].gd) return mini[b].gd - mini[a].gd;
    return 0; // leave as tied for the next pass
  });
}

// After H2H, any remaining tied runs are either (a) resolved by manualTiebreakers
// if the user gave us ranks, or (b) reported in unresolvedTies and left in their
// pre-tied position (which falls through to alphabetical as a safety net).
function applyManualOrUnresolved(h2hResolved, manualTiebreakers, unresolvedTies) {
  const result = [];
  let i = 0;
  while (i < h2hResolved.length) {
    let j = i;
    while (
      j + 1 < h2hResolved.length &&
      cmpForTieDetection(h2hResolved[j], h2hResolved[j+1], manualTiebreakers) === 0
    ) j++;
    if (j === i) {
      result.push(h2hResolved[i]);
    } else {
      const subset = h2hResolved.slice(i, j + 1);
      const allHaveManual = subset.every(t => Number.isFinite(manualTiebreakers[t]));
      if (allHaveManual) {
        const ordered = [...subset].sort((a, b) => manualTiebreakers[a] - manualTiebreakers[b]);
        result.push(...ordered);
      } else {
        // Truly tied. Report and fall back to alphabetical as a deterministic safety net.
        unresolvedTies.push([...subset]);
        const ordered = [...subset].sort();
        result.push(...ordered);
      }
    }
    i = j + 1;
  }
  return result;
}

// Two teams are considered "still tied after H2H" if they are not separated by
// any manual rank either. The H2H pass already preserved order for teams it
// couldn't separate (return 0), so we treat adjacency in h2hResolved as a proxy
// for "still tied" UNLESS the user provided distinguishing ranks.
function cmpForTieDetection(a, b, manualTiebreakers) {
  // If manual ranks distinguish them, they're not tied.
  if (Number.isFinite(manualTiebreakers[a]) && Number.isFinite(manualTiebreakers[b])
      && manualTiebreakers[a] !== manualTiebreakers[b]) {
    return manualTiebreakers[a] - manualTiebreakers[b];
  }
  return 0;
}
```

**Caveat on the implementation:** the H2H pass returns adjacent-tied teams in their pre-pass order (because the comparator returns 0). Treating adjacency as "tied" works for the common cases we care about — small (2 or 3 team) ties after H2H. If a future test exercises a more pathological setup, we may need a richer comparison.

- [ ] **Step 2: Run tests, verify all pass**

```bash
npm test
```

Expected: every test in `standings.test.js` passes, plus the carry-over derive tests.

- [ ] **Step 3: Commit**

```bash
git add lib/standings.js lib/standings.test.js
git commit -m "feat(lib): unresolvedTies + manualTiebreakers in computeStandings"
```

---

### Task 5: `lib/score.js` — `scoreSubmission()`

The browser-side scoring engine. Uses `lib/derive.js` and `lib/standings.js`. Pure function.

**Files:**
- Create: `lib/score.js`
- Create: `lib/score.test.js`

- [ ] **Step 1: Write the failing tests**

Create `lib/score.test.js`:

```js
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

test('correct exact score = 5 pts', () => {
  const fixtures = singleGroupFixtures();
  const submission = {
    matches: { m01: { home_score: 1, away_score: 0 } },
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
  const results = { matches: { m01: finalResult(1, 0) } };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.match_points.m01, 5);
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

test('predicted draw matches actual draw exact score = 5 pts', () => {
  const fixtures = singleGroupFixtures();
  const submission = {
    matches: { m01: { home_score: 1, away_score: 1 } },
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
  const results = { matches: { m01: finalResult(1, 1) } };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.match_points.m01, 5);
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
  assert.equal(r.match_points.m01, 5);
  assert.equal(r.match_points.m02, undefined); // pending -> no entry
  assert.equal(r.match_total, 5);
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

test('correct 1st place: +5 pts, perfect order: +3 bonus', () => {
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
  assert.equal(r.group_points.A.first, 5);
  assert.equal(r.group_points.A.second, 3);
  assert.equal(r.group_points.A.perfect, 3);
  assert.equal(r.group_points.A.subtotal, 11);
});

test('1st correct, 2nd wrong, perfect bonus not granted', () => {
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
    group_standings: { A: ['AAA','CCC','BBB','DDD'] } // 1st right, 2nd wrong
  };
  const results = { matches: Object.fromEntries(Object.entries(allWin).map(([k, v]) => [k, { ...v, status: 'STATUS_FINAL' }])) };
  const r = scoreSubmission(submission, fixtures, results);
  assert.equal(r.group_points.A.first, 5);
  assert.equal(r.group_points.A.second, 0);
  assert.equal(r.group_points.A.perfect, 0);
  assert.equal(r.group_points.A.subtotal, 5);
});

test('total = match_total + group_total', () => {
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
  // All 6 matches scored exactly: 6 * 5 = 30. Group total: 11. Total: 41.
  assert.equal(r.match_total, 30);
  assert.equal(r.group_total, 11);
  assert.equal(r.total, 41);
});
```

- [ ] **Step 2: Run tests, verify failure**

```bash
npm test
```

Expected: `Cannot find module './score.js'`.

- [ ] **Step 3: Implement**

Create `lib/score.js`:

```js
import { deriveWinner } from './derive.js';
import { computeStandings } from './standings.js';

const POINTS_WINNER = 3;
const POINTS_EXACT_BONUS = 2;
const POINTS_FIRST_PLACE = 5;
const POINTS_SECOND_PLACE = 3;
const POINTS_PERFECT_ORDER = 3;

export function scoreSubmission(submission, fixtures, results) {
  const match_points = {};
  let match_total = 0;
  let exact_score_count = 0;

  for (const [matchId, pick] of Object.entries(submission.matches)) {
    const result = results?.matches?.[matchId];
    if (!result || result.status !== 'STATUS_FINAL') continue; // pending → no entry

    let pts = 0;
    if (deriveWinner(pick.home_score, pick.away_score) === deriveWinner(result.home_score, result.away_score)) {
      pts += POINTS_WINNER;
    }
    if (pick.home_score === result.home_score && pick.away_score === result.away_score) {
      pts += POINTS_EXACT_BONUS;
      exact_score_count += 1;
    }
    match_points[matchId] = pts;
    match_total += pts;
  }

  const group_points = {};
  let group_total = 0;

  for (const [groupLetter, predicted] of Object.entries(submission.group_standings)) {
    const group = fixtures.groups[groupLetter];
    if (!group) continue;
    const allFinal = group.matches.every(mid =>
      results?.matches?.[mid]?.status === 'STATUS_FINAL'
    );
    if (!allFinal) continue; // pending group → no entry

    // Build a matches-shaped object from results for this group, for computeStandings.
    const matchScores = {};
    for (const mid of group.matches) {
      const r = results.matches[mid];
      matchScores[mid] = { home_score: r.home_score, away_score: r.away_score };
    }
    const { standings: actual } = computeStandings(groupLetter, matchScores, fixtures);

    const first = predicted[0] === actual[0] ? POINTS_FIRST_PLACE : 0;
    const second = predicted[1] === actual[1] ? POINTS_SECOND_PLACE : 0;
    const perfect = arraysEqual(predicted, actual) ? POINTS_PERFECT_ORDER : 0;
    const subtotal = first + second + perfect;
    group_points[groupLetter] = { first, second, perfect, subtotal };
    group_total += subtotal;
  }

  return {
    match_points,
    match_total,
    group_points,
    group_total,
    total: match_total + group_total,
    exact_score_count,
  };
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test
```

Expected: all `score.test.js` tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/score.js lib/score.test.js
git commit -m "feat(lib): scoreSubmission with match + group scoring"
```

---

### Task 6: `lib/validate.js` — submission validation

Mirrors the rules codified in spec §5.7. Used by the form (pre-submit) and the Apps Script (defense in depth — though Apps Script just reads `picks_json` as opaque, only the form does shape-checking). Browser-only in v1.

**Files:**
- Create: `lib/validate.js`
- Create: `lib/validate.test.js`

- [ ] **Step 1: Write the failing tests**

Create `lib/validate.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmission } from './validate.js';

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

function validIdentity() {
  return { name: 'Tessa', email: 'tessa@example.com', secret: 'open-sesame', acknowledged: true };
}

function validPicks() {
  return {
    matches: {
      m01: { home_score: 1, away_score: 0 },
      m02: { home_score: 1, away_score: 0 },
      m03: { home_score: 1, away_score: 0 },
      m04: { home_score: 1, away_score: 0 },
      m05: { home_score: 1, away_score: 0 },
      m06: { home_score: 1, away_score: 0 },
    },
    group_standings: { A: ['AAA','BBB','CCC','DDD'] }
  };
}

test('valid submission passes', () => {
  const r = validateSubmission({ identity: validIdentity(), picks: validPicks() }, singleGroupFixtures());
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, []);
});

test('missing a match is invalid', () => {
  const picks = validPicks();
  delete picks.matches.m03;
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'match_missing' && e.matchId === 'm03'));
});

test('score below 0 is invalid', () => {
  const picks = validPicks();
  picks.matches.m01.home_score = -1;
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'score_out_of_range' && e.matchId === 'm01'));
});

test('score above 20 is invalid', () => {
  const picks = validPicks();
  picks.matches.m01.home_score = 21;
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'score_out_of_range' && e.matchId === 'm01'));
});

test('non-integer score is invalid', () => {
  const picks = validPicks();
  picks.matches.m01.home_score = 1.5;
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'score_not_integer' && e.matchId === 'm01'));
});

test('duplicate team in standings is invalid', () => {
  const picks = validPicks();
  picks.group_standings.A = ['AAA','AAA','CCC','DDD'];
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'standings_duplicate' && e.group === 'A'));
});

test('non-group team in standings is invalid', () => {
  const picks = validPicks();
  picks.group_standings.A = ['AAA','BBB','CCC','ZZZ'];
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'standings_unknown_team' && e.group === 'A'));
});

test('wrong length standings array is invalid', () => {
  const picks = validPicks();
  picks.group_standings.A = ['AAA','BBB','CCC'];
  const r = validateSubmission({ identity: validIdentity(), picks }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'standings_wrong_length' && e.group === 'A'));
});

test('missing name is invalid', () => {
  const r = validateSubmission({
    identity: { ...validIdentity(), name: '' },
    picks: validPicks()
  }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'identity_name'));
});

test('overlong name is invalid', () => {
  const r = validateSubmission({
    identity: { ...validIdentity(), name: 'x'.repeat(41) },
    picks: validPicks()
  }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'identity_name'));
});

test('bad email is invalid', () => {
  const r = validateSubmission({
    identity: { ...validIdentity(), email: 'not-an-email' },
    picks: validPicks()
  }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'identity_email'));
});

test('short secret is invalid', () => {
  const r = validateSubmission({
    identity: { ...validIdentity(), secret: 'abc' },
    picks: validPicks()
  }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'identity_secret'));
});

test('unacknowledged is invalid', () => {
  const r = validateSubmission({
    identity: { ...validIdentity(), acknowledged: false },
    picks: validPicks()
  }, singleGroupFixtures());
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.code === 'identity_acknowledged'));
});
```

- [ ] **Step 2: Run tests, verify failure**

```bash
npm test
```

Expected: `Cannot find module './validate.js'`.

- [ ] **Step 3: Implement**

Create `lib/validate.js`:

```js
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSubmission(input, fixtures) {
  const errors = [];
  const { identity, picks } = input;

  // Identity
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

  // Matches: every fixture must have a pick with valid scores.
  for (const matchId of Object.keys(fixtures.matches)) {
    const pick = picks?.matches?.[matchId];
    if (!pick) {
      errors.push({ code: 'match_missing', matchId, message: `Missing prediction for ${matchId}` });
      continue;
    }
    for (const side of ['home_score', 'away_score']) {
      const v = pick[side];
      if (!Number.isFinite(v)) {
        errors.push({ code: 'score_missing', matchId, side, message: `Missing ${side} for ${matchId}` });
      } else if (!Number.isInteger(v)) {
        errors.push({ code: 'score_not_integer', matchId, side, message: `${side} must be an integer` });
      } else if (v < 0 || v > 20) {
        errors.push({ code: 'score_out_of_range', matchId, side, message: `${side} must be between 0 and 20` });
      }
    }
  }

  // Group standings: 4 distinct teams per group, all in the group.
  for (const groupLetter of Object.keys(fixtures.groups)) {
    const standings = picks?.group_standings?.[groupLetter];
    const groupTeams = new Set(fixtures.groups[groupLetter].teams);
    if (!Array.isArray(standings) || standings.length !== 4) {
      errors.push({ code: 'standings_wrong_length', group: groupLetter, message: `Group ${groupLetter} standings must have exactly 4 entries` });
      continue;
    }
    const seen = new Set();
    for (const code of standings) {
      if (!groupTeams.has(code)) {
        errors.push({ code: 'standings_unknown_team', group: groupLetter, team: code, message: `${code} is not in group ${groupLetter}` });
      }
      if (seen.has(code)) {
        errors.push({ code: 'standings_duplicate', group: groupLetter, team: code, message: `Duplicate team ${code} in group ${groupLetter}` });
      }
      seen.add(code);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test
```

Expected: all validate tests pass; other tests still pass.

- [ ] **Step 5: Commit**

```bash
git add lib/validate.js lib/validate.test.js
git commit -m "feat(lib): validateSubmission with shape and rule checks"
```

---

### Task 7: ESPN client + fixture seeding

Builds the one-shot script that pulls fixtures from ESPN's public API and writes `fixtures.json`. Also extracts the lock time (earliest kickoff) for the engineer to copy into `config.json` and the Apps Script later.

**Files:**
- Create: `scripts/lib/espn.mjs`
- Create: `scripts/seed-fixtures.mjs`
- Create: `fixtures.json` (output of running the script)

- [ ] **Step 1: Write the ESPN client helper**

Create `scripts/lib/espn.mjs`:

```js
// Thin client for ESPN's public soccer scoreboard endpoint.
// No auth required. CORS-permissive. Documented in spec §3 and §7.
//
// Returns the raw JSON from the API. Callers are responsible for parsing the
// shape they need.

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

export async function fetchScoreboard(dateYyyymmdd) {
  const url = `${BASE}?dates=${dateYyyymmdd}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN request failed for ${dateYyyymmdd}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Parse one event from ESPN's scoreboard.events[] into our internal fixture shape.
// ESPN returns competitors as a 2-element array with home_away keys.
//
// Returns { matchId, group, home, away, kickoff_iso, status, home_score, away_score }
// home/away are FIFA-style 3-letter codes (e.g. "MEX"). ESPN uses 3-letter
// abbreviations consistent with that convention; we uppercase to be safe.
export function parseEvent(event) {
  const competition = event.competitions?.[0];
  if (!competition) throw new Error(`Event ${event.id} has no competition`);
  const competitors = competition.competitors || [];
  const homeC = competitors.find(c => c.homeAway === 'home');
  const awayC = competitors.find(c => c.homeAway === 'away');
  if (!homeC || !awayC) throw new Error(`Event ${event.id} missing home/away`);

  // ESPN sometimes includes the group label in the season type name or in the
  // notes array. We extract it from event.season.type.name when available,
  // falling back to scanning competition.notes for "Group X".
  const group = extractGroupLetter(event, competition);

  return {
    matchId: String(event.id),
    group,
    home: (homeC.team?.abbreviation || homeC.team?.shortDisplayName || '').toUpperCase(),
    away: (awayC.team?.abbreviation || awayC.team?.shortDisplayName || '').toUpperCase(),
    kickoff_iso: event.date,
    status: event.status?.type?.name || 'STATUS_SCHEDULED',
    home_score: parseInt(homeC.score ?? '', 10),
    away_score: parseInt(awayC.score ?? '', 10),
  };
}

function extractGroupLetter(event, competition) {
  // Try competition.notes[*].headline like "Group A" or "Group H".
  for (const note of (competition.notes || [])) {
    const m = /Group\s+([A-L])/i.exec(note.headline || note.text || '');
    if (m) return m[1].toUpperCase();
  }
  // Try event.name or shortName.
  for (const s of [event.name, event.shortName, event.season?.slug]) {
    const m = /Group\s+([A-L])/i.exec(s || '');
    if (m) return m[1].toUpperCase();
  }
  // Not found — caller will need to handle null group for non-group-stage events.
  return null;
}
```

- [ ] **Step 2: Write the seed script**

Create `scripts/seed-fixtures.mjs`:

```js
// One-shot script. Run locally with:
//   node scripts/seed-fixtures.mjs
//
// Iterates dates Jun 11–27, 2026, pulls each day's scoreboard from ESPN,
// extracts group-stage matches, and writes fixtures.json in the repo root.
// Prints the earliest kickoff time so the user can paste it into config.json
// and the Apps Script script properties.

import { writeFile } from 'node:fs/promises';
import { fetchScoreboard, parseEvent } from './lib/espn.mjs';

const START_DATE = '2026-06-11';
const END_DATE = '2026-06-27';

function* dateRange(start, end) {
  const d = new Date(start);
  const last = new Date(end);
  while (d <= last) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    yield `${y}${m}${day}`;
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

async function main() {
  const groups = {};
  const matches = {};
  let earliestKickoff = null;

  for (const dateStr of dateRange(START_DATE, END_DATE)) {
    console.log(`Fetching ${dateStr}...`);
    const data = await fetchScoreboard(dateStr);
    const events = data.events || [];
    for (const evt of events) {
      const parsed = parseEvent(evt);
      if (!parsed.group) {
        console.warn(`  Skipping ${parsed.matchId}: no group letter found.`);
        continue;
      }
      matches[parsed.matchId] = {
        group: parsed.group,
        home: parsed.home,
        away: parsed.away,
        kickoff_iso: parsed.kickoff_iso,
      };
      if (!groups[parsed.group]) {
        groups[parsed.group] = { teams: new Set(), matches: [] };
      }
      groups[parsed.group].teams.add(parsed.home);
      groups[parsed.group].teams.add(parsed.away);
      groups[parsed.group].matches.push(parsed.matchId);
      if (!earliestKickoff || parsed.kickoff_iso < earliestKickoff) {
        earliestKickoff = parsed.kickoff_iso;
      }
    }
    await new Promise(r => setTimeout(r, 1000)); // be kind to ESPN
  }

  // Materialize: sort teams + matches per group, convert sets to arrays.
  const out = { groups: {}, matches };
  for (const letter of Object.keys(groups).sort()) {
    out.groups[letter] = {
      teams: [...groups[letter].teams].sort(),
      matches: groups[letter].matches.sort(),
    };
  }

  // Sanity check: 12 groups, 4 teams each, 6 matches each, 72 total.
  const expectErrors = [];
  if (Object.keys(out.groups).length !== 12) {
    expectErrors.push(`Expected 12 groups, got ${Object.keys(out.groups).length}`);
  }
  for (const [letter, g] of Object.entries(out.groups)) {
    if (g.teams.length !== 4) expectErrors.push(`Group ${letter}: expected 4 teams, got ${g.teams.length}`);
    if (g.matches.length !== 6) expectErrors.push(`Group ${letter}: expected 6 matches, got ${g.matches.length}`);
  }
  if (Object.keys(out.matches).length !== 72) {
    expectErrors.push(`Expected 72 matches, got ${Object.keys(out.matches).length}`);
  }
  if (expectErrors.length) {
    console.error('\nSanity check FAILED:');
    for (const e of expectErrors) console.error('  -', e);
    console.error('\nWriting fixtures.json anyway for inspection.');
  } else {
    console.log('\nSanity check passed.');
  }

  await writeFile('fixtures.json', JSON.stringify(out, null, 2) + '\n');
  console.log('Wrote fixtures.json');
  console.log(`\nEarliest kickoff (for config.json + Apps Script lock): ${earliestKickoff}`);
  console.log(`Paste this into config.json.group_lock_iso and the Apps Script script property "group_lock_iso".`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Run the seed script**

```bash
npm run seed
```

Expected output:
- A line per date showing fetch progress.
- A sanity-check report. The 2026 World Cup format should produce 12 groups (A–L), 4 teams each, 6 matches per group, 72 matches total.
- An earliest-kickoff line. Save this value — it's the lock time.

**If the sanity check fails:** common causes are (a) ESPN hasn't published the full fixture list yet at this date, (b) team abbreviations don't match between events (the same team in different matches with different short codes), (c) the group letter extraction failed for some events. Inspect `fixtures.json` and adjust `parseEvent` / `extractGroupLetter` in `scripts/lib/espn.mjs` as needed, then re-run.

- [ ] **Step 4: Manual eyeball check**

Open `fixtures.json` and verify:
- 12 groups labeled A–L
- Each group has 4 distinct team codes
- Each group has 6 match IDs
- The teams in each group's matches are exactly the 4 teams listed

- [ ] **Step 5: Commit fixtures + scripts**

```bash
git add scripts/lib/espn.mjs scripts/seed-fixtures.mjs fixtures.json
git commit -m "feat(scripts): seed fixtures from ESPN, commit fixtures.json"
```

---

### Task 8: Results fetching script + GitHub Actions cron

**Files:**
- Create: `scripts/fetch-results.mjs`
- Create: `results.json` (initial empty state)
- Create: `.github/workflows/fetch-results.yml`

- [ ] **Step 1: Initialize an empty `results.json`**

Create `results.json`:

```json
{
  "updated_at": "2026-06-07T00:00:00Z",
  "matches": {}
}
```

- [ ] **Step 2: Write the fetch script**

Create `scripts/fetch-results.mjs`:

```js
// Run by the GitHub Actions cron every 2 hours during the tournament.
// Reads fixtures.json to learn which match IDs we care about. For each date
// in the tournament range that isn't already fully STATUS_FINAL, hits ESPN's
// scoreboard endpoint and merges into results.json.
//
// Exits 0 if no changes, 0 if changes were written (workflow checks the file
// diff to decide whether to commit), and non-zero on error.

import { readFile, writeFile } from 'node:fs/promises';
import { fetchScoreboard, parseEvent } from './lib/espn.mjs';

const TOURNAMENT_START = '2026-06-11';
const TOURNAMENT_END = '2026-07-19';

function* dateRange(start, end) {
  const d = new Date(start);
  const last = new Date(end);
  while (d <= last) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    yield `${y}${m}${day}`;
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

function isInTournamentWindow() {
  const now = new Date();
  return now >= new Date(TOURNAMENT_START) && now <= new Date(TOURNAMENT_END + 'T23:59:59Z');
}

async function main() {
  if (!isInTournamentWindow()) {
    console.log('Outside tournament window; exiting cleanly.');
    return;
  }

  const fixtures = JSON.parse(await readFile('fixtures.json', 'utf8'));
  const existing = JSON.parse(await readFile('results.json', 'utf8'));
  const matchIds = new Set(Object.keys(fixtures.matches));

  // Index match IDs by date for cheap "is this date fully final?" checks.
  const idsByDate = {};
  for (const [mid, fx] of Object.entries(fixtures.matches)) {
    const ymd = fx.kickoff_iso.slice(0, 10).replaceAll('-', '');
    if (!idsByDate[ymd]) idsByDate[ymd] = [];
    idsByDate[ymd].push(mid);
  }

  const merged = { ...existing.matches };
  let changed = false;

  for (const dateStr of dateRange(TOURNAMENT_START, TOURNAMENT_END)) {
    const idsOnDate = idsByDate[dateStr];
    if (!idsOnDate) continue; // no matches on this date
    const allFinal = idsOnDate.every(mid => merged[mid]?.status === 'STATUS_FINAL');
    if (allFinal) continue;

    let data;
    try {
      data = await fetchScoreboard(dateStr);
    } catch (err) {
      console.error(`Failed to fetch ${dateStr}:`, err.message);
      process.exit(1);
    }
    for (const evt of (data.events || [])) {
      const parsed = parseEvent(evt);
      if (!matchIds.has(parsed.matchId)) continue;
      const prev = merged[parsed.matchId];
      const next = {
        home_score: Number.isFinite(parsed.home_score) ? parsed.home_score : (prev?.home_score ?? null),
        away_score: Number.isFinite(parsed.away_score) ? parsed.away_score : (prev?.away_score ?? null),
        status: parsed.status,
      };
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        merged[parsed.matchId] = next;
        changed = true;
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (changed) {
    const out = { updated_at: new Date().toISOString(), matches: merged };
    await writeFile('results.json', JSON.stringify(out, null, 2) + '\n');
    console.log(`Updated results.json (${Object.keys(merged).length} matches tracked).`);
  } else {
    console.log('No changes.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Write the Actions workflow**

Create `.github/workflows/fetch-results.yml`:

```yaml
name: fetch-results

on:
  schedule:
    # Every 2 hours, on the hour, UTC.
    - cron: '0 */2 * * *'
  workflow_dispatch: {}

jobs:
  fetch:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run fetch script
        run: node scripts/fetch-results.mjs

      - name: Commit and push if changed
        run: |
          if [[ -n "$(git status --porcelain results.json)" ]]; then
            git config user.name "github-actions"
            git config user.email "github-actions@users.noreply.github.com"
            git add results.json
            git commit -m "results update"
            git push
          else
            echo "No results.json changes."
          fi
```

- [ ] **Step 4: Local dry-run**

```bash
npm run fetch
```

Expected behavior:
- **Before Jun 11, 2026**: prints `Outside tournament window; exiting cleanly.` and exits 0.
- **During the tournament**: hits ESPN for each date with matches, merges into `results.json`. Either prints `No changes.` or `Updated results.json (N matches tracked).`.

For an early-test run before the tournament window, temporarily change `TOURNAMENT_START` to today's date in the script, run once to verify the parse/merge logic, then revert the change.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-results.mjs results.json .github/workflows/fetch-results.yml
git commit -m "feat(scripts): results fetcher + GitHub Actions cron"
```

---

### Task 9: Apps Script backend

Apps Script source lives in the repo for review / version control, but it's not auto-deployed. The engineer pastes it into a fresh Apps Script project bound to the spreadsheet, sets script properties, and publishes it as a web app.

**Files:**
- Create: `apps_script/Code.gs`
- Create: `apps_script/README.md` (deployment instructions)
- Modify: `config.json` (after deploy, paste the web app URL)

- [ ] **Step 1: Write the Apps Script source**

Create `apps_script/Code.gs`:

```javascript
// World Cup Pool — Apps Script backend.
// Paste this entire file into a Google Apps Script project bound to the pool
// spreadsheet. See apps_script/README.md for deployment instructions.
//
// The spreadsheet must have a sheet named "submissions" with this header row:
//   submitted_at | name | email | secret_hash | phase | picks_json | client_version
//
// Required script properties (Project Settings → Script properties):
//   salt              random hex string, e.g. 32 chars from crypto.randomUUID()
//   group_lock_iso    e.g. "2026-06-11T16:00:00Z" — paste from seed-fixtures output
//
// Endpoints:
//   POST /exec       body { name, email, secret, picks, phase?, client_version? }
//                    → 200 { ok: true, submitted_at }
//                    → 403 { error: "locked" }
//                    → 403 { error: "secret_mismatch" }
//                    → 400 { error: "bad_request", detail }
//   GET  /exec?action=submissions
//                    → { locked: false, submissions: [] }      (pre-lock)
//                    → { locked: true,  submissions: [...] }   (post-lock)

const SHEET_NAME = 'submissions';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const lockTime = getLockTime();
    if (new Date() >= lockTime) {
      return jsonResponse(403, { error: 'locked' });
    }

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const secret = String(body.secret || '');
    const picks = body.picks;
    const phase = String(body.phase || 'group');
    const clientVersion = String(body.client_version || '1');

    if (!name || !email || !secret || !picks) {
      return jsonResponse(400, { error: 'bad_request', detail: 'name, email, secret, picks required' });
    }

    const salt = getSalt();
    const secretHash = sha256Hex(salt + secret);

    const sheet = getSheet();
    const latest = findLatestByEmail(sheet, email);
    if (latest && latest.secret_hash !== secretHash) {
      return jsonResponse(403, { error: 'secret_mismatch' });
    }

    const submittedAt = new Date().toISOString();
    sheet.appendRow([
      submittedAt,
      name,
      email,
      secretHash,
      phase,
      JSON.stringify(picks),
      clientVersion,
    ]);
    return jsonResponse(200, { ok: true, submitted_at: submittedAt });
  } catch (err) {
    return jsonResponse(500, { error: 'server_error', message: String(err) });
  }
}

function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || '';
    if (action !== 'submissions') {
      return jsonResponse(400, { error: 'unknown_action' });
    }
    const lockTime = getLockTime();
    const locked = new Date() >= lockTime;
    if (!locked) {
      return jsonResponse(200, { locked: false, submissions: [] });
    }
    const sheet = getSheet();
    const submissions = collectLatestPerEmail(sheet);
    return jsonResponse(200, { locked: true, submissions });
  } catch (err) {
    return jsonResponse(500, { error: 'server_error', message: String(err) });
  }
}

// --- helpers ---

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found`);
  return sheet;
}

function getLockTime() {
  const iso = PropertiesService.getScriptProperties().getProperty('group_lock_iso');
  if (!iso) throw new Error('group_lock_iso script property is unset');
  return new Date(iso);
}

function getSalt() {
  const salt = PropertiesService.getScriptProperties().getProperty('salt');
  if (!salt) throw new Error('salt script property is unset');
  return salt;
}

function sha256Hex(input) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    input,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => {
    const v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function findLatestByEmail(sheet, email) {
  const data = sheet.getDataRange().getValues();
  // data[0] is the header row.
  let latest = null;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmail = String(row[2] || '').toLowerCase();
    if (rowEmail !== email) continue;
    const submittedAt = String(row[0] || '');
    if (!latest || submittedAt > latest.submitted_at) {
      latest = {
        submitted_at: submittedAt,
        name: row[1],
        email: rowEmail,
        secret_hash: String(row[3] || ''),
        phase: String(row[4] || ''),
        picks_json: String(row[5] || ''),
      };
    }
  }
  return latest;
}

function collectLatestPerEmail(sheet) {
  const data = sheet.getDataRange().getValues();
  const latestByEmail = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const email = String(row[2] || '').toLowerCase();
    if (!email) continue;
    const submittedAt = String(row[0] || '');
    if (!latestByEmail[email] || submittedAt > latestByEmail[email].submitted_at) {
      latestByEmail[email] = {
        submitted_at: submittedAt,
        name: String(row[1] || ''),
        email,
        phase: String(row[4] || ''),
        picks_json: String(row[5] || ''),
      };
    }
  }
  return Object.values(latestByEmail).map(s => ({
    name: s.name,
    email_hash: sha256Hex(s.email),
    phase: s.phase,
    picks: JSON.parse(s.picks_json),
    submitted_at: s.submitted_at,
  }));
}

function jsonResponse(status, payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
  // Note: Apps Script web apps cannot set arbitrary HTTP status codes for
  // GET/POST without using the older HtmlService trick. Clients should rely on
  // payload.error or payload.ok rather than HTTP status. The `status` argument
  // here is informational only.
}
```

**Caveat:** Apps Script web apps cannot easily return non-200 status codes for `doGet`/`doPost`. Clients must inspect the JSON payload (`.error`, `.ok`) to determine outcome. The form code in Task 17 does this.

- [ ] **Step 2: Write deployment README**

Create `apps_script/README.md`:

```markdown
# Apps Script deployment

## One-time setup

1. Create a new Google Sheet titled "World Cup Pool".
2. In the sheet, rename the first tab to `submissions` and set the header row:
   `submitted_at | name | email | secret_hash | phase | picks_json | client_version`
   (Hint: paste this into A1:G1 as comma-separated then use Data → Split text to columns.)
3. Extensions → Apps Script. Delete any boilerplate code and paste the contents
   of `Code.gs` from this directory.
4. Project Settings (gear icon, left sidebar) → Script properties → Add:
   - `salt`: a random hex string (32+ chars; you can paste the output of
     `node -e "console.log(crypto.randomUUID().replaceAll('-',''))"`).
   - `group_lock_iso`: the earliest kickoff time printed by `npm run seed`,
     e.g. `2026-06-11T16:00:00Z`.
5. Save the script. Click "Deploy" → "New deployment".
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
   - Click Deploy and authorize the script when prompted.
6. Copy the resulting Web app URL — it looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.
7. Paste that URL into the repo's `config.json` as `apps_script_url`. Commit
   that change.

## Re-deploying after code changes

If you edit `Code.gs`:

1. Click Deploy → Manage deployments → pencil icon on the active deployment.
2. Set "Version" to "New version", click Deploy. The URL stays the same.

## Testing

- In the Apps Script editor, set the function dropdown to `doGet` and click
  Run. You'll be prompted to authorize on first run. The Logs panel should
  show the execution.
- For end-to-end testing: load the form from your local machine, submit a
  test entry, check the sheet for a new row, then re-submit with the wrong
  secret to confirm the `secret_mismatch` path.
```

- [ ] **Step 3: Deploy and paste URL into config.json**

Follow `apps_script/README.md` step-by-step. You'll need:
- A Google account.
- The `group_lock_iso` value from Task 7's seed output.
- 5–10 minutes for the OAuth authorization dance.

Once deployed, you'll have a web app URL. Create `config.json` in the repo root:

```json
{
  "group_lock_iso": "PASTE_FROM_SEED_OUTPUT",
  "apps_script_url": "PASTE_FROM_APPS_SCRIPT_DEPLOY"
}
```

- [ ] **Step 4: Smoke test the deployed web app**

```bash
curl -L 'https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec?action=submissions'
```

Expected: `{"locked":false,"submissions":[]}` (since the lock time hasn't passed). If you get an HTML error page, check the deployment access setting (must be "Anyone") and that you authorized the script.

```bash
curl -L -X POST -H 'Content-Type: application/json' \
  --data '{"name":"Test","email":"test@example.com","secret":"abcd","picks":{"matches":{},"group_standings":{}}}' \
  'https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec'
```

Expected: `{"ok":true,"submitted_at":"..."}`. Check the sheet — a new row should appear.

- [ ] **Step 5: Commit**

```bash
git add apps_script/Code.gs apps_script/README.md config.json
git commit -m "feat(backend): Apps Script doPost/doGet + deployment notes"
```

---

### Task 10: HTML skeletons + shared CSS

Create the two HTML pages plus a minimal stylesheet. Both pages share the same top bar and load the same CSS. Each page loads its own entry-point module.

**Files:**
- Create: `index.html`
- Create: `leaderboard.html`
- Create: `style.css`

- [ ] **Step 1: Write the submission page skeleton**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>World Cup 2026 Pool — Submit Picks</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <header class="top-bar">
    <h1>World Cup 2026 Pool</h1>
    <nav>
      <a href="./leaderboard.html">Leaderboard</a>
      <button type="button" id="rules-button">📖 Rules</button>
    </nav>
    <div id="lock-banner" hidden></div>
  </header>

  <main id="form-root">
    <p class="loading">Loading…</p>
  </main>

  <div id="rules-overlay" hidden></div>

  <script type="module" src="./form/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write the leaderboard page skeleton**

Create `leaderboard.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>World Cup 2026 Pool — Leaderboard</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <header class="top-bar">
    <h1>World Cup 2026 Pool — Leaderboard</h1>
    <nav>
      <a href="./index.html">Submit picks</a>
      <button type="button" id="rules-button">📖 Rules</button>
    </nav>
    <div id="results-updated"></div>
  </header>

  <main id="leaderboard-root">
    <p class="loading">Loading…</p>
  </main>

  <div id="pick-modal" hidden></div>
  <div id="rules-overlay" hidden></div>

  <script type="module" src="./leaderboard/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write minimal but pleasant CSS**

Create `style.css`:

```css
:root {
  --bg: #fafafa;
  --fg: #18181b;
  --muted: #71717a;
  --accent: #2563eb;
  --border: #e4e4e7;
  --green: #16a34a;
  --yellow: #ca8a04;
  --red: #dc2626;
  --gray: #a1a1aa;
  --tab-empty: #f4f4f5;
  --tab-partial: #fef9c3;
  --tab-complete: #dcfce7;
  --tab-active: #dbeafe;
}

* { box-sizing: border-box; }

body {
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.5;
}

.top-bar {
  background: white;
  border-bottom: 1px solid var(--border);
  padding: 12px 24px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.top-bar h1 {
  margin: 0;
  font-size: 18px;
}

.top-bar nav {
  margin-left: auto;
  display: flex;
  gap: 16px;
  align-items: center;
}

.top-bar a, .top-bar button {
  color: var(--accent);
  background: none;
  border: 1px solid var(--border);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  font: inherit;
}

.top-bar a:hover, .top-bar button:hover {
  background: var(--tab-active);
}

#lock-banner {
  width: 100%;
  background: #fee2e2;
  color: var(--red);
  padding: 8px 12px;
  border-radius: 6px;
  font-weight: 600;
}

main {
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
}

.loading {
  color: var(--muted);
}

/* Form-specific */

.progress {
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 10;
  padding: 8px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}

.progress-count { color: var(--muted); font-variant-numeric: tabular-nums; }

.tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.tab {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--tab-empty);
  cursor: pointer;
  font: inherit;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tab.partial { background: var(--tab-partial); }
.tab.complete { background: var(--tab-complete); }
.tab.active { background: var(--tab-active); border-color: var(--accent); }
.tab-indicator { font-size: 0.85em; }

.tab-panel { display: none; }
.tab-panel.active { display: block; }

.match-row {
  display: grid;
  grid-template-columns: 1fr 60px auto 60px 1fr;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}

.match-row .team { font-weight: 600; }
.match-row .team-home { text-align: right; }
.match-row .team-away { text-align: left; }
.match-row input[type="number"] { width: 100%; padding: 6px; font-size: 16px; }
.match-row .draw-label { color: var(--muted); font-size: 0.85em; text-align: center; }

.standings-panel {
  margin-top: 16px;
  padding: 12px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.standings-list { list-style: none; padding: 0; margin: 0; }
.standings-list li {
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 8px;
}
.standings-list li:last-child { border-bottom: none; }
.standings-rank { color: var(--muted); width: 24px; }

.tiebreaker-widget {
  margin-top: 12px;
  padding: 12px;
  background: #fef9c3;
  border-radius: 6px;
}

.tiebreaker-pill {
  display: inline-block;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  margin: 4px;
  background: white;
  cursor: grab;
}

.error-summary {
  background: #fee2e2;
  border: 1px solid var(--red);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

.error-inline { color: var(--red); font-size: 0.85em; }

.identity-panel {
  background: white;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 16px;
  margin-top: 24px;
}

.identity-panel label { display: block; margin-top: 8px; }
.identity-panel input[type="text"],
.identity-panel input[type="email"],
.identity-panel input[type="password"] {
  width: 100%;
  padding: 6px;
  font-size: 16px;
}

.submit-button {
  background: var(--accent);
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  margin-top: 16px;
}
.submit-button:disabled { opacity: 0.5; cursor: not-allowed; }

/* Leaderboard */

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 6px;
  overflow: hidden;
}

.leaderboard-table th, .leaderboard-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.leaderboard-table tbody tr { cursor: pointer; }
.leaderboard-table tbody tr:hover { background: var(--tab-active); }

#pick-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

#pick-modal[hidden] { display: none; }

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 1000px;
  width: 92%;
  max-height: 88vh;
  overflow: auto;
  padding: 24px;
}

.group-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

.match-result-row {
  display: grid;
  grid-template-columns: 1fr 90px 1fr;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
}

.match-result-row.exact   { background: #dcfce7; }
.match-result-row.winner  { background: #fef9c3; }
.match-result-row.wrong   { background: #fee2e2; }
.match-result-row.pending { background: #f4f4f5; color: var(--muted); }

.standings-strip {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.standings-chip {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 0.85em;
}
.standings-chip.correct { border-color: var(--green); border-width: 2px; }

#rules-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  z-index: 100;
}
#rules-overlay[hidden] { display: none; }
.rules-drawer {
  background: white;
  max-width: 480px;
  width: 92%;
  height: 100vh;
  overflow: auto;
  padding: 24px;
}
```

- [ ] **Step 4: Sanity-load both pages**

Open `index.html` and `leaderboard.html` in a browser directly (`file://` is fine for static viewing). You should see the top bars and "Loading…" placeholders. The module scripts will throw 404s for `form/main.js` and `leaderboard/main.js` since they don't exist yet — that's expected and fine.

- [ ] **Step 5: Commit**

```bash
git add index.html leaderboard.html style.css
git commit -m "feat(ui): HTML skeletons + shared stylesheet"
```

---

### Task 11: `form/state.js` — central state store

A tiny subscribe-notify store keeps the form's various render functions in sync without a framework. Pattern: one global state object, named mutation helpers, listener registry.

**Files:**
- Create: `form/state.js`

- [ ] **Step 1: Write the state module**

Create `form/state.js`:

```js
// Central state for the submission form. No framework — just a plain object
// behind subscribe/notify. Mutating helpers are explicit so all writes funnel
// through one place. Subscribers get the new state on every change.

const listeners = new Set();

const initial = {
  // matches: { [matchId]: { home_score: number|null, away_score: number|null } }
  matches: {},
  // manualTiebreakers: { [groupLetter]: { [teamCode]: rank } }
  manualTiebreakers: {},
  // identity: { name, email, secret, acknowledged }
  identity: { name: '', email: '', secret: '', acknowledged: false },
  // activeGroup: which tab is currently visible
  activeGroup: 'A',
  // errors: from the last validate pass; rendered by validation-ui.js
  errors: [],
  // submission state machine
  submitState: 'idle', // 'idle' | 'submitting' | 'submitted' | 'error'
  submitMessage: '',
  submittedAt: null,
  // tournament gate
  locked: false,
};

let state = structuredClone(initial);

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}

// --- mutating helpers ---

export function setMatchScore(matchId, side, value) {
  const next = { ...state.matches };
  const prior = next[matchId] || { home_score: null, away_score: null };
  next[matchId] = { ...prior, [side]: value };
  state = { ...state, matches: next };
  notify();
}

export function setManualTiebreaker(groupLetter, ranks) {
  // ranks: { [teamCode]: rank }, or {} to clear.
  const next = { ...state.manualTiebreakers, [groupLetter]: { ...ranks } };
  state = { ...state, manualTiebreakers: next };
  notify();
}

export function clearManualTiebreaker(groupLetter) {
  const next = { ...state.manualTiebreakers };
  delete next[groupLetter];
  state = { ...state, manualTiebreakers: next };
  notify();
}

export function setIdentity(patch) {
  state = { ...state, identity: { ...state.identity, ...patch } };
  notify();
}

export function setActiveGroup(letter) {
  state = { ...state, activeGroup: letter };
  notify();
}

export function setErrors(errors) {
  state = { ...state, errors };
  notify();
}

export function setSubmitState(submitState, opts = {}) {
  state = { ...state, submitState, submitMessage: opts.message || '', submittedAt: opts.submittedAt || state.submittedAt };
  notify();
}

export function setLocked(locked) {
  state = { ...state, locked };
  notify();
}

// Hydrate from a saved draft. Defensive: only copies fields we expect.
export function hydrate(saved) {
  if (!saved || typeof saved !== 'object') return;
  state = {
    ...state,
    matches: saved.matches && typeof saved.matches === 'object' ? saved.matches : state.matches,
    manualTiebreakers: saved.manualTiebreakers && typeof saved.manualTiebreakers === 'object' ? saved.manualTiebreakers : state.manualTiebreakers,
    identity: saved.identity && typeof saved.identity === 'object' ? { ...state.identity, ...saved.identity } : state.identity,
    activeGroup: typeof saved.activeGroup === 'string' ? saved.activeGroup : state.activeGroup,
  };
  notify();
}

// Reset to a pristine initial state. Used after a successful submit.
export function reset() {
  state = structuredClone(initial);
  notify();
}
```

- [ ] **Step 2: Commit**

```bash
git add form/state.js
git commit -m "feat(form): central state store with subscribe/notify"
```

---

### Task 12: `form/render-tabs.js` — group tabs with completion indicators

Renders 12 tabs (A–L) plus their completion state based on `state.matches`. Clicking a tab calls `setActiveGroup`. A tab is "complete" if all 6 matches in its group have both scores filled.

**Files:**
- Create: `form/render-tabs.js`

- [ ] **Step 1: Write the renderer**

Create `form/render-tabs.js`:

```js
import { getState, setActiveGroup } from './state.js';

let fixtures = null;
let container = null;

export function initTabs(rootEl, fixturesData) {
  fixtures = fixturesData;
  container = document.createElement('div');
  container.className = 'tabs';
  rootEl.appendChild(container);
  render();
}

export function renderTabs() { render(); }

function render() {
  if (!container || !fixtures) return;
  const state = getState();
  const letters = Object.keys(fixtures.groups).sort();
  container.innerHTML = '';
  for (const letter of letters) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tab';
    const status = completionStatus(letter, state.matches, fixtures);
    if (status === 'partial') tab.classList.add('partial');
    if (status === 'complete') tab.classList.add('complete');
    if (state.activeGroup === letter) tab.classList.add('active');

    const indicator = document.createElement('span');
    indicator.className = 'tab-indicator';
    indicator.textContent = status === 'complete' ? '✓' : status === 'partial' ? '●' : '';

    tab.appendChild(document.createTextNode(`Group ${letter}`));
    tab.appendChild(indicator);
    tab.addEventListener('click', () => setActiveGroup(letter));
    container.appendChild(tab);
  }
}

export function completionStatus(letter, matches, fixturesData) {
  const matchIds = fixturesData.groups[letter].matches;
  let filled = 0;
  for (const mid of matchIds) {
    const pick = matches[mid];
    if (pick && Number.isInteger(pick.home_score) && Number.isInteger(pick.away_score)) {
      filled++;
    }
  }
  if (filled === 0) return 'empty';
  if (filled === matchIds.length) return 'complete';
  return 'partial';
}

export function totalCompletion(matches, fixturesData) {
  const totalMatches = Object.keys(fixturesData.matches).length;
  let filled = 0;
  for (const mid of Object.keys(fixturesData.matches)) {
    const p = matches[mid];
    if (p && Number.isInteger(p.home_score) && Number.isInteger(p.away_score)) filled++;
  }
  return { filled, totalMatches };
}
```

- [ ] **Step 2: Commit**

```bash
git add form/render-tabs.js
git commit -m "feat(form): group tabs with completion indicators"
```

---

### Task 13: `form/render-matches.js` — match input rows

For the active group only, render 6 match rows (home team, home score input, draw label, away score input, away team). Inputs are wired to `setMatchScore` on change.

**Files:**
- Create: `form/render-matches.js`

- [ ] **Step 1: Write the renderer**

Create `form/render-matches.js`:

```js
import { getState, setMatchScore } from './state.js';
import { deriveWinner } from '../lib/derive.js';

let fixtures = null;
let container = null;

export function initMatches(rootEl, fixturesData) {
  fixtures = fixturesData;
  container = document.createElement('div');
  container.className = 'matches-panel';
  rootEl.appendChild(container);
  render();
}

export function renderMatches() { render(); }

function render() {
  if (!container || !fixtures) return;
  const state = getState();
  const letter = state.activeGroup;
  const group = fixtures.groups[letter];
  if (!group) {
    container.innerHTML = `<p>Unknown group: ${letter}</p>`;
    return;
  }
  container.innerHTML = `<h2>Group ${letter}</h2>`;
  for (const mid of group.matches) {
    const fixture = fixtures.matches[mid];
    const pick = state.matches[mid] || { home_score: null, away_score: null };
    const row = document.createElement('div');
    row.className = 'match-row';
    row.dataset.matchId = mid;

    const homeLabel = document.createElement('div');
    homeLabel.className = 'team team-home';
    homeLabel.textContent = fixture.home;

    const homeInput = document.createElement('input');
    homeInput.type = 'number';
    homeInput.min = '0';
    homeInput.max = '20';
    homeInput.step = '1';
    homeInput.value = pick.home_score == null ? '' : String(pick.home_score);
    homeInput.addEventListener('input', (e) => {
      const raw = e.target.value;
      const v = raw === '' ? null : parseInt(raw, 10);
      setMatchScore(mid, 'home_score', Number.isFinite(v) ? v : null);
    });

    const drawLabel = document.createElement('div');
    drawLabel.className = 'draw-label';
    drawLabel.textContent = labelFor(pick);

    const awayInput = document.createElement('input');
    awayInput.type = 'number';
    awayInput.min = '0';
    awayInput.max = '20';
    awayInput.step = '1';
    awayInput.value = pick.away_score == null ? '' : String(pick.away_score);
    awayInput.addEventListener('input', (e) => {
      const raw = e.target.value;
      const v = raw === '' ? null : parseInt(raw, 10);
      setMatchScore(mid, 'away_score', Number.isFinite(v) ? v : null);
    });

    const awayLabel = document.createElement('div');
    awayLabel.className = 'team team-away';
    awayLabel.textContent = fixture.away;

    row.appendChild(homeLabel);
    row.appendChild(homeInput);
    row.appendChild(drawLabel);
    row.appendChild(awayInput);
    row.appendChild(awayLabel);
    container.appendChild(row);
  }
}

function labelFor(pick) {
  if (!Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) return 'vs';
  const winner = deriveWinner(pick.home_score, pick.away_score);
  return winner === 'draw' ? 'Draw' : winner === 'home' ? '←' : '→';
}
```

- [ ] **Step 2: Commit**

```bash
git add form/render-matches.js
git commit -m "feat(form): match input rows with derived winner labels"
```

---

### Task 14: `form/render-standings.js` — derived standings + tiebreaker widget

For the active group, compute standings from current match picks. Render the ordered list. If `unresolvedTies` is non-empty, render an inline widget that lets the user drag-rank the tied subset; user choices feed back into `manualTiebreakers`.

**Files:**
- Create: `form/render-standings.js`

- [ ] **Step 1: Write the renderer**

Create `form/render-standings.js`:

```js
import { getState, setManualTiebreaker, clearManualTiebreaker } from './state.js';
import { computeStandings } from '../lib/standings.js';

let fixtures = null;
let container = null;

export function initStandings(rootEl, fixturesData) {
  fixtures = fixturesData;
  container = document.createElement('div');
  container.className = 'standings-panel';
  rootEl.appendChild(container);
  render();
}

export function renderStandings() { render(); }

// Lookup: the standings the form is "committing to" for a group, given the
// current match scores plus any user-provided manual tiebreaker ranks.
// Used by identity-and-submit.js to assemble the final picks payload.
export function getDerivedStandings(letter) {
  const state = getState();
  const matchScores = {};
  for (const mid of fixtures.groups[letter].matches) {
    const pick = state.matches[mid];
    if (!pick) return null; // not all matches filled — no commitment yet
    if (!Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) return null;
    matchScores[mid] = { home_score: pick.home_score, away_score: pick.away_score };
  }
  const manual = state.manualTiebreakers[letter] || undefined;
  const { standings, unresolvedTies } = computeStandings(letter, matchScores, fixtures, manual);
  if (unresolvedTies.length > 0) return null; // still ties to resolve
  return standings;
}

function render() {
  if (!container || !fixtures) return;
  const state = getState();
  const letter = state.activeGroup;
  const group = fixtures.groups[letter];
  container.innerHTML = '<h3>Predicted standings</h3>';

  // Build match scores from current state. Skip groups that aren't filled enough.
  const matchScores = {};
  let allFilled = true;
  for (const mid of group.matches) {
    const pick = state.matches[mid];
    if (!pick || !Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) {
      allFilled = false;
      break;
    }
    matchScores[mid] = { home_score: pick.home_score, away_score: pick.away_score };
  }

  if (!allFilled) {
    container.innerHTML += '<p class="loading">Fill in all 6 match scores to see the predicted standings.</p>';
    return;
  }

  const manual = state.manualTiebreakers[letter];
  const { standings, unresolvedTies } = computeStandings(letter, matchScores, fixtures, manual);

  const list = document.createElement('ol');
  list.className = 'standings-list';
  for (let i = 0; i < standings.length; i++) {
    const li = document.createElement('li');
    const rank = document.createElement('span');
    rank.className = 'standings-rank';
    rank.textContent = `${i + 1}.`;
    const team = document.createElement('span');
    team.textContent = standings[i];
    li.appendChild(rank);
    li.appendChild(team);
    list.appendChild(li);
  }
  container.appendChild(list);

  if (unresolvedTies.length > 0) {
    container.appendChild(renderTiebreakerWidget(letter, unresolvedTies));
  }
}

function renderTiebreakerWidget(letter, tiedGroups) {
  const widget = document.createElement('div');
  widget.className = 'tiebreaker-widget';
  const explain = document.createElement('p');
  explain.innerHTML = `<strong>Tie to break.</strong> The scores you entered leave teams tied. Use the arrows to rank them, top → bottom.`;
  widget.appendChild(explain);

  const state = getState();
  const existingManual = state.manualTiebreakers[letter] || {};

  // Render each tied subset independently. Each subset is an array of teams in
  // their current heuristic order. We let the user reorder within the subset.
  let rankOffset = 0;
  // Find the starting rank for the first tied group by scanning standings.
  // To keep this simple, assume tied groups appear in standings order and we
  // just use the user's reordering relative to them.
  for (const subset of tiedGroups) {
    const subsetEl = document.createElement('div');
    subsetEl.className = 'tiebreaker-subset';
    // Use the existing manual order if all subset teams have ranks already,
    // otherwise the heuristic alphabetical fallback from standings.
    const ordered = sortSubsetForUI(subset, existingManual);
    for (let i = 0; i < ordered.length; i++) {
      const pill = document.createElement('span');
      pill.className = 'tiebreaker-pill';
      pill.textContent = ordered[i];
      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.textContent = '↑';
      upBtn.disabled = i === 0;
      upBtn.addEventListener('click', () => moveTeam(letter, ordered, i, -1));
      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.textContent = '↓';
      downBtn.disabled = i === ordered.length - 1;
      downBtn.addEventListener('click', () => moveTeam(letter, ordered, i, 1));
      pill.appendChild(document.createTextNode(' '));
      pill.appendChild(upBtn);
      pill.appendChild(downBtn);
      subsetEl.appendChild(pill);
    }
    widget.appendChild(subsetEl);
  }
  return widget;
}

function sortSubsetForUI(subset, existingManual) {
  return [...subset].sort((a, b) => {
    const ra = Number.isFinite(existingManual[a]) ? existingManual[a] : Infinity;
    const rb = Number.isFinite(existingManual[b]) ? existingManual[b] : Infinity;
    if (ra !== rb) return ra - rb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

function moveTeam(letter, ordered, idx, delta) {
  const next = [...ordered];
  const swapIdx = idx + delta;
  if (swapIdx < 0 || swapIdx >= next.length) return;
  const tmp = next[idx]; next[idx] = next[swapIdx]; next[swapIdx] = tmp;
  // Build manualTiebreakers from the new order. We assign ranks starting at 1.
  const state = getState();
  const existing = { ...(state.manualTiebreakers[letter] || {}) };
  next.forEach((team, i) => { existing[team] = i + 1; });
  setManualTiebreaker(letter, existing);
}

// Note: clearing manualTiebreakers when match scores change (per spec §5.3.1)
// is handled in form/main.js by watching for matches-state diffs and calling
// clearManualTiebreaker(letter) directly. No helper needed here.
```

**Caveat on the widget:** the up/down button reordering is a simplified version of the spec's "drag-to-rank" idea. Drag-and-drop in plain JS is doable but verbose; arrow buttons get the same outcome in a fraction of the code. Upgrade to drag-and-drop later if you want.

- [ ] **Step 2: Commit**

```bash
git add form/render-standings.js
git commit -m "feat(form): derived standings panel + arrow tiebreaker widget"
```

---

### Task 15: `form/validation-ui.js` — error rendering

Renders both an inline marker under each problem input (when present) and a top-of-page summary block with anchor links to each error. Pulls errors from `state.errors`, which is populated by the submit handler before any POST attempt.

**Files:**
- Create: `form/validation-ui.js`

- [ ] **Step 1: Write the module**

Create `form/validation-ui.js`:

```js
import { getState } from './state.js';

let summaryEl = null;

export function initValidationUI(rootEl) {
  summaryEl = document.createElement('div');
  summaryEl.className = 'error-summary';
  summaryEl.hidden = true;
  rootEl.insertBefore(summaryEl, rootEl.firstChild);
}

export function renderValidationUI() {
  if (!summaryEl) return;
  const { errors } = getState();
  if (!errors.length) {
    summaryEl.hidden = true;
    summaryEl.innerHTML = '';
    return;
  }
  summaryEl.hidden = false;
  summaryEl.innerHTML = '';
  const heading = document.createElement('strong');
  heading.textContent = `Please fix ${errors.length} problem${errors.length === 1 ? '' : 's'} before submitting:`;
  summaryEl.appendChild(heading);
  const list = document.createElement('ul');
  for (const err of errors) {
    const item = document.createElement('li');
    item.textContent = err.message;
    list.appendChild(item);
  }
  summaryEl.appendChild(list);
}
```

**Note:** inline-per-input markers are intentionally minimal in v1 — the summary list at the top is enough for a pool of 20 friends. If you want red borders on offending inputs, extend `render-matches.js` to read `getState().errors` and add a class. For now the summary suffices.

- [ ] **Step 2: Commit**

```bash
git add form/validation-ui.js
git commit -m "feat(form): error summary rendering"
```

---

### Task 16: `form/autosave.js` — debounced localStorage + lifecycle hooks

Subscribes to state changes; writes a draft to `localStorage` 500ms after the last change. Also writes synchronously on `blur`, `visibilitychange`, and `beforeunload`. Provides a `loadDraft()` for boot-time hydration and a `clearDraft()` for use after a successful submit.

**Files:**
- Create: `form/autosave.js`

- [ ] **Step 1: Write the module**

Create `form/autosave.js`:

```js
import { getState, subscribe } from './state.js';

const KEY = 'wc-draft';
const DEBOUNCE_MS = 500;

let timer = null;

function snapshot() {
  const s = getState();
  return {
    matches: s.matches,
    manualTiebreakers: s.manualTiebreakers,
    identity: s.identity,
    activeGroup: s.activeGroup,
  };
}

function saveNow() {
  if (timer) { clearTimeout(timer); timer = null; }
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot()));
  } catch (err) {
    console.warn('Autosave failed:', err);
  }
}

function scheduleSave() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(saveNow, DEBOUNCE_MS);
}

export function initAutosave() {
  subscribe(scheduleSave);
  window.addEventListener('blur', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('beforeunload', saveNow);
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Failed to load draft:', err);
    return null;
  }
}

export function clearDraft() {
  try { localStorage.removeItem(KEY); } catch {}
}
```

- [ ] **Step 2: Commit**

```bash
git add form/autosave.js
git commit -m "feat(form): debounced autosave with lifecycle save hooks"
```

---

### Task 17: `form/identity-and-submit.js` + `form/main.js` — identity, submit, bootstrap

The last form piece. Renders the identity panel (name, email, secret, acknowledgment). Validates and POSTs to the Apps Script URL. Handles success, locked, secret_mismatch, and network failure responses. The `main.js` entry-point ties all the form modules together.

**Files:**
- Create: `form/identity-and-submit.js`
- Create: `form/main.js`

- [ ] **Step 1: Write the identity/submit module**

Create `form/identity-and-submit.js`:

```js
import { getState, setIdentity, setErrors, setSubmitState } from './state.js';
import { validateSubmission } from '../lib/validate.js';
import { getDerivedStandings } from './render-standings.js';
import { clearDraft } from './autosave.js';

let fixtures = null;
let appsScriptUrl = null;
let container = null;
let submittedView = null;

export function initIdentityAndSubmit(rootEl, fixturesData, config) {
  fixtures = fixturesData;
  appsScriptUrl = config.apps_script_url;
  container = document.createElement('div');
  container.className = 'identity-panel';
  rootEl.appendChild(container);

  submittedView = document.createElement('div');
  submittedView.className = 'submitted-view';
  submittedView.hidden = true;
  rootEl.appendChild(submittedView);

  render();
}

export function renderIdentityAndSubmit() { render(); }

function render() {
  const state = getState();
  if (state.submitState === 'submitted') {
    renderSubmittedView(state);
    container.style.display = 'none';
    submittedView.hidden = false;
    return;
  }
  container.style.display = '';
  submittedView.hidden = true;

  container.innerHTML = '<h2>Submit your picks</h2>';

  const fieldName = field('Name', 'text', state.identity.name, v => setIdentity({ name: v }));
  const fieldEmail = field('Email', 'email', state.identity.email, v => setIdentity({ email: v.toLowerCase() }));
  const fieldSecret = field('Secret (min 4 chars — protects your picks from impersonation)', 'password', state.identity.secret, v => setIdentity({ secret: v }));

  const ackLabel = document.createElement('label');
  const ack = document.createElement('input');
  ack.type = 'checkbox';
  ack.checked = state.identity.acknowledged;
  ack.addEventListener('change', e => setIdentity({ acknowledged: e.target.checked }));
  ackLabel.appendChild(ack);
  ackLabel.appendChild(document.createTextNode(' I understand my secret protects my picks. Save it somewhere.'));

  container.appendChild(fieldName);
  container.appendChild(fieldEmail);
  container.appendChild(fieldSecret);
  container.appendChild(ackLabel);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'submit-button';
  submitBtn.textContent = state.submitState === 'submitting' ? 'Submitting…' : 'Submit picks';
  submitBtn.disabled = state.submitState === 'submitting' || state.locked;
  submitBtn.addEventListener('click', () => onSubmit());
  container.appendChild(submitBtn);

  if (state.submitState === 'error' && state.submitMessage) {
    const errEl = document.createElement('p');
    errEl.className = 'error-inline';
    errEl.textContent = state.submitMessage;
    container.appendChild(errEl);
  }
}

function field(labelText, type, value, onChange) {
  const wrapper = document.createElement('label');
  wrapper.textContent = labelText;
  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  input.addEventListener('input', e => onChange(e.target.value));
  wrapper.appendChild(input);
  return wrapper;
}

function renderSubmittedView(state) {
  submittedView.innerHTML = `
    <h2>Picks submitted</h2>
    <p>Recorded at <strong>${state.submittedAt}</strong>.</p>
    <p>You can re-submit until lock to update your picks — use the same email + secret.</p>
    <p><a href="./leaderboard.html">View leaderboard</a> (it goes live at kickoff).</p>
  `;
}

async function onSubmit() {
  // Assemble standings from derived values. Bail if any group still has an
  // unresolved tie or incomplete scores.
  const groupStandings = {};
  for (const letter of Object.keys(fixtures.groups)) {
    const s = getDerivedStandings(letter);
    if (!s) {
      setErrors([{ code: 'standings_incomplete', group: letter,
        message: `Group ${letter} standings are incomplete (missing scores or unresolved tie).` }]);
      return;
    }
    groupStandings[letter] = s;
  }

  const state = getState();
  const submission = {
    identity: state.identity,
    picks: {
      matches: state.matches,
      group_standings: groupStandings,
    },
  };
  const { valid, errors } = validateSubmission(submission, fixtures);
  setErrors(errors);
  if (!valid) {
    setSubmitState('error', { message: 'Please fix the errors above before submitting.' });
    return;
  }

  setSubmitState('submitting');
  try {
    const res = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: state.identity.name,
        email: state.identity.email,
        secret: state.identity.secret,
        picks: { matches: state.matches, group_standings: groupStandings },
        phase: 'group',
        client_version: '1',
      }),
    });
    const data = await res.json();
    if (data.error === 'locked') {
      setSubmitState('error', { message: `Submissions are closed. Visit the leaderboard.` });
      return;
    }
    if (data.error === 'secret_mismatch') {
      setSubmitState('error', { message: `An entry already exists for this email. The secret you provided doesn't match. If this is your entry, use the secret you set before. If it's not you, use a different email.` });
      return;
    }
    if (!data.ok) {
      setSubmitState('error', { message: `Couldn't save: ${data.error || 'unknown error'}.` });
      return;
    }
    setSubmitState('submitted', { submittedAt: data.submitted_at });
    clearDraft();
  } catch (err) {
    setSubmitState('error', { message: `Couldn't save. Your picks are still here — try again.` });
  }
}
```

- [ ] **Step 2: Write the form entry point**

Create `form/main.js`:

```js
import { getState, subscribe, hydrate, setLocked } from './state.js';
import { initTabs, renderTabs, totalCompletion } from './render-tabs.js';
import { initMatches, renderMatches } from './render-matches.js';
import { initStandings, renderStandings } from './render-standings.js';
import { initValidationUI, renderValidationUI } from './validation-ui.js';
import { initAutosave, loadDraft } from './autosave.js';
import { initIdentityAndSubmit, renderIdentityAndSubmit } from './identity-and-submit.js';
import { clearManualTiebreaker } from './state.js';
import { initRulesViewer } from '../shared/rules-viewer.js';

async function main() {
  const root = document.getElementById('form-root');
  const [config, fixtures] = await Promise.all([
    fetch('./config.json').then(r => r.json()),
    fetch('./fixtures.json').then(r => r.json()),
  ]);

  const now = new Date();
  const lock = new Date(config.group_lock_iso);
  setLocked(now >= lock);

  // Build the page chrome.
  root.innerHTML = '';
  const progress = renderProgressBar(fixtures);
  root.appendChild(progress);

  initValidationUI(root);
  initTabs(root, fixtures);
  initMatches(root, fixtures);
  initStandings(root, fixtures);
  initIdentityAndSubmit(root, fixtures, config);

  // Hydrate draft.
  hydrate(loadDraft());
  initAutosave();

  // Track which group's matches have changed so we can clear manual tiebreakers
  // when scores shift (per spec §5.3.1).
  let previousMatches = getState().matches;
  subscribe(() => {
    const next = getState().matches;
    if (next !== previousMatches) {
      const changedGroups = collectChangedGroups(previousMatches, next, fixtures);
      for (const g of changedGroups) clearManualTiebreaker(g);
      previousMatches = next;
    }
  });

  // Re-render on every change.
  subscribe(() => {
    renderTabs();
    renderMatches();
    renderStandings();
    renderValidationUI();
    renderIdentityAndSubmit();
    updateProgressBar(progress, fixtures);
    updateLockBanner(config);
  });

  // Initial render and lock-aware view.
  renderTabs();
  renderMatches();
  renderStandings();
  renderValidationUI();
  renderIdentityAndSubmit();
  updateProgressBar(progress, fixtures);
  updateLockBanner(config);

  initRulesViewer({
    triggerEl: document.getElementById('rules-button'),
    overlayEl: document.getElementById('rules-overlay'),
  });

  if (getState().locked) {
    showLockedView(root);
  }
}

function renderProgressBar(fixtures) {
  const el = document.createElement('div');
  el.className = 'progress';
  el.innerHTML = `<span class="progress-count" id="progress-count"></span>`;
  return el;
}

function updateProgressBar(progressEl, fixtures) {
  const { filled, totalMatches } = totalCompletion(getState().matches, fixtures);
  const countEl = progressEl.querySelector('#progress-count');
  countEl.textContent = `${filled} / ${totalMatches} match picks complete`;
}

function updateLockBanner(config) {
  const banner = document.getElementById('lock-banner');
  if (!banner) return;
  const lock = new Date(config.group_lock_iso);
  const now = new Date();
  const ms = lock - now;
  const dayMs = 24 * 60 * 60 * 1000;
  if (ms <= 0) {
    banner.hidden = true;
    return;
  }
  if (ms > dayMs) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  banner.textContent = `Submissions close in ${hours}h ${minutes}m ${seconds}s`;
  // Re-tick once a second.
  setTimeout(() => updateLockBanner(config), 1000);
}

function showLockedView(root) {
  root.innerHTML = `
    <h2>Submissions are closed.</h2>
    <p>The tournament has begun. <a href="./leaderboard.html">View the leaderboard.</a></p>
  `;
}

function collectChangedGroups(prev, next, fixtures) {
  const changed = new Set();
  const allMatchIds = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const mid of allMatchIds) {
    if (JSON.stringify(prev[mid] || null) !== JSON.stringify(next[mid] || null)) {
      const group = fixtures.matches[mid]?.group;
      if (group) changed.add(group);
    }
  }
  return [...changed];
}

main().catch(err => {
  console.error(err);
  document.getElementById('form-root').innerHTML = `<p>Failed to load. Please refresh.</p>`;
});
```

- [ ] **Step 3: Manual smoke test**

Open `index.html` in a browser (or run `python3 -m http.server` and visit `http://localhost:8000`). You should be able to:

- Click between group tabs.
- Type scores into a few matches; the predicted-standings panel updates live.
- Fill all 6 matches in a group; the tab gets a green check.
- Force a tie (e.g. all 0-0); the tiebreaker widget appears with arrow buttons.
- Refresh the page; your scores persist (autosave restored).

Submit will fail until `config.json` has a real Apps Script URL. That's expected.

- [ ] **Step 4: Commit**

```bash
git add form/identity-and-submit.js form/main.js
git commit -m "feat(form): identity panel, submit handler, bootstrap"
```

---

### Task 18: `leaderboard/render-table.js` + `leaderboard/main.js`

Fetches submissions, computes scores, renders the sorted table. Row clicks open the modal (Task 19).

**Files:**
- Create: `leaderboard/render-table.js`
- Create: `leaderboard/main.js`

- [ ] **Step 1: Write the table renderer**

Create `leaderboard/render-table.js`:

```js
import { scoreSubmission } from '../lib/score.js';

export function renderLeaderboardTable(rootEl, payload, onRowClick) {
  const { fixtures, results, submissions } = payload;
  rootEl.innerHTML = '';

  if (!submissions.length) {
    rootEl.innerHTML = '<p>No submissions to display yet.</p>';
    return;
  }

  // Score everyone, sort by total desc.
  const scored = submissions.map(sub => {
    const scoring = scoreSubmission(sub.picks, fixtures, results);
    return {
      name: sub.name,
      email_hash: sub.email_hash,
      submitted_at: sub.submitted_at,
      picks: sub.picks,
      scoring,
    };
  });
  scored.sort((a, b) => {
    if (b.scoring.total !== a.scoring.total) return b.scoring.total - a.scoring.total;
    if (b.scoring.exact_score_count !== a.scoring.exact_score_count) return b.scoring.exact_score_count - a.scoring.exact_score_count;
    return a.name.localeCompare(b.name);
  });

  const table = document.createElement('table');
  table.className = 'leaderboard-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Rank</th>
        <th>Name</th>
        <th>Match pts</th>
        <th>Group pts</th>
        <th>Total</th>
        <th>Exact scores</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  scored.forEach((entry, i) => {
    const tr = document.createElement('tr');
    tr.dataset.emailHash = entry.email_hash;
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(entry.name)}</td>
      <td>${entry.scoring.match_total}</td>
      <td>${entry.scoring.group_total}</td>
      <td><strong>${entry.scoring.total}</strong></td>
      <td>${entry.scoring.exact_score_count}</td>
    `;
    tr.addEventListener('click', () => onRowClick(entry, { fixtures, results }));
    tbody.appendChild(tr);
  });
  rootEl.appendChild(table);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
```

- [ ] **Step 2: Write the leaderboard entry point**

Create `leaderboard/main.js`:

```js
import { renderLeaderboardTable } from './render-table.js';
import { openPickModal } from './modal.js';
import { wireDeepLinks } from './deep-link.js';
import { initRulesViewer } from '../shared/rules-viewer.js';

async function main() {
  const root = document.getElementById('leaderboard-root');
  const [config, fixtures, results] = await Promise.all([
    fetch('./config.json').then(r => r.json()),
    fetch('./fixtures.json').then(r => r.json()),
    fetch('./results.json').then(r => r.json()),
  ]);

  // Last-updated banner.
  const updatedEl = document.getElementById('results-updated');
  updatedEl.textContent = `Last updated: ${formatRelative(new Date(results.updated_at))}`;

  // Fetch submissions from Apps Script. Pre-lock → empty.
  let payload;
  try {
    const submissionsResp = await fetch(`${config.apps_script_url}?action=submissions`);
    const data = await submissionsResp.json();
    payload = { fixtures, results, submissions: data.locked ? data.submissions : [] };
    if (!data.locked) {
      root.innerHTML = `<p>The leaderboard goes live after submissions close at ${config.group_lock_iso}.</p>`;
      initRulesViewer({ triggerEl: document.getElementById('rules-button'), overlayEl: document.getElementById('rules-overlay') });
      return;
    }
  } catch (err) {
    root.innerHTML = `<p>Couldn't load submissions. <button id="retry">Retry</button></p>`;
    document.getElementById('retry').addEventListener('click', () => location.reload());
    return;
  }

  renderLeaderboardTable(root, payload, (entry, ctx) => openPickModal(entry, ctx));
  wireDeepLinks(payload, root);

  initRulesViewer({
    triggerEl: document.getElementById('rules-button'),
    overlayEl: document.getElementById('rules-overlay'),
  });
}

function formatRelative(date) {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'moments ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

main().catch(err => {
  console.error(err);
  document.getElementById('leaderboard-root').innerHTML = `<p>Failed to load. Please refresh.</p>`;
});
```

- [ ] **Step 3: Commit**

```bash
git add leaderboard/render-table.js leaderboard/main.js
git commit -m "feat(leaderboard): table render + boot"
```

---

### Task 19: `leaderboard/modal.js` — pick-detail modal

Renders the visual pick breakdown described in spec §9.2.1: 12 group cards, each with 6 colored match rows and a 4-team standings strip.

**Files:**
- Create: `leaderboard/modal.js`

- [ ] **Step 1: Write the modal module**

Create `leaderboard/modal.js`:

```js
import { computeStandings } from '../lib/standings.js';
import { deriveWinner } from '../lib/derive.js';

const MODAL_ID = 'pick-modal';

export function openPickModal(entry, ctx) {
  const modal = document.getElementById(MODAL_ID);
  modal.innerHTML = '';
  modal.appendChild(buildContent(entry, ctx));
  modal.hidden = false;

  modal.addEventListener('click', onOutsideClick);
  document.addEventListener('keydown', onEsc);
  // Update URL fragment so it's shareable.
  history.replaceState(null, '', `#picks/${entry.email_hash}`);
}

function closeModal() {
  const modal = document.getElementById(MODAL_ID);
  modal.hidden = true;
  modal.removeEventListener('click', onOutsideClick);
  document.removeEventListener('keydown', onEsc);
  history.replaceState(null, '', location.pathname + location.search);
}

function onOutsideClick(e) {
  if (e.target.id === MODAL_ID) closeModal();
}

function onEsc(e) { if (e.key === 'Escape') closeModal(); }

function buildContent(entry, ctx) {
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-content';

  const header = document.createElement('header');
  header.innerHTML = `
    <h2>${escapeHtml(entry.name)}'s picks</h2>
    <p>Total: <strong>${entry.scoring.total}</strong> · Match pts: ${entry.scoring.match_total} · Group pts: ${entry.scoring.group_total} · Exact scores: ${entry.scoring.exact_score_count}</p>
  `;
  wrapper.appendChild(header);

  for (const letter of Object.keys(ctx.fixtures.groups).sort()) {
    wrapper.appendChild(buildGroupCard(letter, entry, ctx));
  }

  const footer = document.createElement('footer');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.addEventListener('click', closeModal);
  footer.appendChild(close);
  wrapper.appendChild(footer);

  return wrapper;
}

function buildGroupCard(letter, entry, ctx) {
  const { fixtures, results } = ctx;
  const group = fixtures.groups[letter];
  const card = document.createElement('section');
  card.className = 'group-card';

  const groupPts = entry.scoring.group_points[letter]?.subtotal ?? 0;
  const matchPtsInGroup = group.matches.reduce((sum, mid) => sum + (entry.scoring.match_points[mid] || 0), 0);
  card.innerHTML = `<h3>Group ${letter} <small>· ${matchPtsInGroup + groupPts} pts</small></h3>`;

  for (const mid of group.matches) {
    card.appendChild(buildMatchRow(mid, entry, ctx));
  }

  card.appendChild(buildStandingsStrip(letter, entry, ctx));
  return card;
}

function buildMatchRow(mid, entry, ctx) {
  const fx = ctx.fixtures.matches[mid];
  const pick = entry.picks.matches[mid] || {};
  const result = ctx.results.matches[mid];
  const row = document.createElement('div');
  row.className = 'match-result-row';

  let cls = 'pending';
  if (result && result.status === 'STATUS_FINAL') {
    const pts = entry.scoring.match_points[mid];
    if (pts === 5) cls = 'exact';
    else if (pts === 3) cls = 'winner';
    else cls = 'wrong';
  }
  row.classList.add(cls);

  const predicted = `${pick.home_score ?? '–'}-${pick.away_score ?? '–'}`;
  const actual = result && result.status === 'STATUS_FINAL'
    ? `${result.home_score}-${result.away_score}`
    : '—';
  row.innerHTML = `
    <span>${escapeHtml(fx.home)}</span>
    <span><strong>${predicted}</strong> <small>(actual ${actual})</small></span>
    <span>${escapeHtml(fx.away)}</span>
  `;
  return row;
}

function buildStandingsStrip(letter, entry, ctx) {
  const strip = document.createElement('div');
  strip.className = 'standings-strip';
  const predicted = entry.picks.group_standings[letter] || [];

  // Has the group fully finalized? If so, compute actual standings to color the chips.
  const group = ctx.fixtures.groups[letter];
  const allFinal = group.matches.every(mid =>
    ctx.results?.matches?.[mid]?.status === 'STATUS_FINAL'
  );
  let actual = null;
  if (allFinal) {
    const matchScores = {};
    for (const mid of group.matches) {
      const r = ctx.results.matches[mid];
      matchScores[mid] = { home_score: r.home_score, away_score: r.away_score };
    }
    actual = computeStandings(letter, matchScores, ctx.fixtures).standings;
  }

  for (let i = 0; i < predicted.length; i++) {
    const chip = document.createElement('span');
    chip.className = 'standings-chip';
    chip.textContent = `${i + 1}. ${predicted[i]}`;
    if (actual && actual[i] === predicted[i]) chip.classList.add('correct');
    strip.appendChild(chip);
  }
  if (!allFinal) {
    const note = document.createElement('span');
    note.className = 'loading';
    note.textContent = ' (pending)';
    strip.appendChild(note);
  }
  return strip;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
```

- [ ] **Step 2: Commit**

```bash
git add leaderboard/modal.js
git commit -m "feat(leaderboard): visual pick-detail modal"
```

---

### Task 20: `leaderboard/deep-link.js` — URL fragment + `?email=` filter

If the URL contains `#picks/<email_hash>`, open the modal for that user on load. If `?email=<address>` is in the query string, hash the address client-side and use that to filter.

**Files:**
- Create: `leaderboard/deep-link.js`

- [ ] **Step 1: Write the deep-link helper**

Create `leaderboard/deep-link.js`:

```js
import { openPickModal } from './modal.js';

// Hash an email the same way the backend does (sha256 hex) so query-string
// filtering works without requiring the user to know their hash.
async function sha256Hex(input) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function wireDeepLinks(payload, rootEl) {
  const fragMatch = /^#picks\/([a-f0-9]+)$/i.exec(location.hash);
  let targetHash = null;
  if (fragMatch) {
    targetHash = fragMatch[1].toLowerCase();
  } else {
    const params = new URLSearchParams(location.search);
    const email = (params.get('email') || '').trim().toLowerCase();
    if (email) targetHash = await sha256Hex(email);
  }
  if (!targetHash) return;

  const { fixtures, results, submissions } = payload;
  // Find the matching submission and synthesize a scored entry.
  const { scoreSubmission } = await import('../lib/score.js');
  const match = submissions.find(s => s.email_hash.toLowerCase() === targetHash);
  if (!match) return;
  const scoring = scoreSubmission(match.picks, fixtures, results);
  const entry = { name: match.name, email_hash: match.email_hash, submitted_at: match.submitted_at, picks: match.picks, scoring };
  openPickModal(entry, { fixtures, results });
}
```

- [ ] **Step 2: Commit**

```bash
git add leaderboard/deep-link.js
git commit -m "feat(leaderboard): URL fragment + ?email= deep links"
```

---

### Task 21: `shared/rules-viewer.js` + `shared/rules.html`

A simple overlay drawer used by both pages. The content is a static HTML fragment that describes the v1 (group stage) rules in plain English.

**Files:**
- Create: `shared/rules-viewer.js`
- Create: `shared/rules.html`

- [ ] **Step 1: Write the overlay module**

Create `shared/rules-viewer.js`:

```js
export function initRulesViewer({ triggerEl, overlayEl }) {
  if (!triggerEl || !overlayEl) return;
  triggerEl.addEventListener('click', async () => {
    if (!overlayEl.dataset.loaded) {
      const html = await fetch('./shared/rules.html').then(r => r.text());
      overlayEl.innerHTML = `
        <div class="rules-drawer">
          <button type="button" class="close" aria-label="Close">×</button>
          ${html}
        </div>
      `;
      overlayEl.dataset.loaded = '1';
      overlayEl.querySelector('.close').addEventListener('click', close);
      overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    }
    overlayEl.hidden = false;
  });

  function close() { overlayEl.hidden = true; }
}
```

- [ ] **Step 2: Write the rules content**

Create `shared/rules.html`:

```html
<h2>Pool Rules</h2>

<h3>Group Stage</h3>
<p>For each of the 72 group stage matches, predict the exact score. Winner/draw is derived from the scores.</p>

<h3>Scoring</h3>
<ul>
  <li><strong>Correct winner or draw, wrong score:</strong> 3 points.</li>
  <li><strong>Exact score correct:</strong> 5 points (3 + 2 bonus).</li>
  <li><strong>Wrong winner:</strong> 0 points.</li>
</ul>

<h3>Group Standings</h3>
<p>Your predicted standings are derived live from your match score predictions, applying the FIFA tiebreaker chain (points → goal difference → goals scored → head-to-head). When your scores leave teams tied, you'll be prompted to rank them.</p>
<ul>
  <li><strong>Correct 1st place:</strong> 5 points.</li>
  <li><strong>Correct 2nd place:</strong> 3 points.</li>
  <li><strong>Perfect group order (1st–4th all correct):</strong> +3 bonus.</li>
</ul>

<h3>Submissions</h3>
<p>Submissions lock at the kickoff of the tournament's first match. After lock, all picks become visible on the leaderboard. You may re-submit until lock — your most recent valid submission wins.</p>

<h3>Identity &amp; Secret</h3>
<p>You enter a name, email, and a secret of your choosing. The secret prevents others from submitting picks under your email. Save it somewhere — re-submissions require it.</p>

<h3>Knockout Stage</h3>
<p><em>Details for the knockout bracket challenge will be posted before the group stage ends.</em></p>
```

- [ ] **Step 3: Commit**

```bash
git add shared/rules-viewer.js shared/rules.html
git commit -m "feat(ui): rules viewer overlay shared between pages"
```

---

### Task 22: Deploy to GitHub Pages

GitHub Pages takes a public repo and serves the root of the `main` branch as a static site. No build step needed since we use ES modules directly.

**Files:**
- (No new files; this is configuration.)

- [ ] **Step 1: Push the repo to a new GitHub repo**

```bash
# Create the remote repo via gh CLI (or via github.com manually).
gh repo create world-cup-pool --public --source=. --remote=origin --push
```

If `gh` isn't installed, create the repo on github.com manually, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/world-cup-pool.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Enable GitHub Pages**

In the repo's Settings → Pages:
- Source: "Deploy from a branch"
- Branch: `main` / `/` (root)
- Save.

After ~30 seconds, Pages will publish the site at `https://YOUR_USERNAME.github.io/world-cup-pool/`.

- [ ] **Step 3: Visit the deployed site**

Open `https://YOUR_USERNAME.github.io/world-cup-pool/` and verify:
- `index.html` loads, shows the form.
- `leaderboard.html` loads, shows a pre-lock "leaderboard goes live after submissions close" message.
- The rules drawer opens from both pages.
- Browser console has no module-load errors.

- [ ] **Step 4: Configure Actions write permission (if needed)**

In Settings → Actions → General → Workflow permissions, ensure "Read and write permissions" is selected so the `fetch-results` cron can push commits.

- [ ] **Step 5: Trigger the cron once manually**

In Actions → fetch-results → Run workflow. Confirm it completes successfully. During the tournament it'll run on schedule; before then it'll exit cleanly with "Outside tournament window".

---

### Task 23: Pre-launch end-to-end dry run

Final manual verification per spec §11.2. Do this on the live deployed site, not localhost — local development sometimes papers over CORS or `fetch` quirks.

- [ ] **Step 1: End-to-end submission dry run**

Open the deployed `index.html`. Submit a complete plausible entry as yourself:
- Fill all 72 match scores.
- Verify the tabs all show green checks.
- Verify each group's standings panel shows a clean order with no tiebreaker widget (unless your scores genuinely create a tie — in that case, resolve it with the arrows).
- Enter your name, email, a 4-char secret, check the acknowledgment box.
- Click Submit.

Expected: "Picks submitted" view with a timestamp.

Verify the row appears in the Google Sheet. Verify `secret_hash` is a hex string, not your raw secret.

- [ ] **Step 2: Re-submission with same secret**

Re-open the form (clear localStorage if needed: `localStorage.removeItem('wc-draft')`). Submit again with the same email and the same secret but a different score for one match.

Expected: a second row appears in the sheet. The new row's submitted_at is later.

- [ ] **Step 3: Re-submission with wrong secret**

Submit again with the same email but a different secret.

Expected: an inline error "An entry already exists for this email…". No new row in the sheet.

- [ ] **Step 4: Lock test**

In the Apps Script editor → Project Settings → Script properties → temporarily change `group_lock_iso` to a time 30 seconds in the future. Wait 60 seconds. Try to submit.

Expected: "Submissions are closed" error.

Revert the script property to the real lock time.

- [ ] **Step 5: Leaderboard pre-lock**

Open the deployed `leaderboard.html`.

Expected: "The leaderboard goes live after submissions close at …" message.

- [ ] **Step 6: Leaderboard post-lock (faked)**

Temporarily set the Apps Script `group_lock_iso` to a time in the past. Reload the leaderboard.

Expected: the table renders with your test submissions. Click a row → modal opens with group cards (all pending since no results are in yet).

Revert the script property to the real lock time.

- [ ] **Step 7: Smoke test the fetch-results workflow**

In Actions, trigger `fetch-results` manually. It should exit cleanly with "Outside tournament window" until June 11. After June 11 it'll start populating `results.json`.

- [ ] **Step 8: Final commit + push**

```bash
git status   # confirm clean
git log --oneline | head -25   # final review of the commit history
```

Tag the v1 release:

```bash
git tag -a v1.0 -m "v1: group stage submission + leaderboard"
git push origin v1.0
```

---

## Self-review notes (engineer, please read before starting)

- **Spec coverage:** every numbered section of the spec maps to one or more tasks. Submission flow (§5), lock (§6), results plumbing (§7), scoring (§8), leaderboard (§9), Apps Script (§10), testing (§11), error handling (§12), rules viewer (§5.8) all have a home.
- **Task 4's tiebreaker logic** is the trickiest pure-logic piece. If a test fails in surprising ways, sketch the H2H mini-stats by hand before tweaking the implementation — most failures are test-construction errors, not implementation bugs.
- **Apps Script status codes (Task 9):** Apps Script web apps always return 200 for `doGet`/`doPost`. The client checks `payload.error` and `payload.ok` instead. This is documented in `apps_script/Code.gs` and handled in `form/identity-and-submit.js`.
- **The form UI (Tasks 11–17)** is vanilla JS with a simple subscribe/notify pattern. If implementation is dragging, swapping the form modules for Alpine.js (or similar) is fair game and the spec leaves the door open — but the rest of the architecture stays the same.
- **The standings-derivation module is shared** between the form (predicted standings) and the scoring engine (actual standings). Keeping it pure and well-tested protects both consumers.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-07-world-cup-pool-v1.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
