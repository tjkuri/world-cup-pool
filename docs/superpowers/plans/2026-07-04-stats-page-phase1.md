# Stats Page — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the "live trio" of the pool stats page — a new `stats.html` with a hero cumulative-points chart ("The Gap"), a Live Ceiling chart, and a Superlatives band — plus the git-history data pipeline that feeds them.

**Architecture:** New Vite multi-page entry `stats.html` + `src/stats/` (mirrors `bracket.html`/`leaderboard.html`). A Node build script walks the git history of `public/results.json`, replays each snapshot through the existing pure scorers, and emits `public/history.json`. New pure, tested lib helpers (`lib/history.js`, `lib/ceiling.js`) do the derivations; Nivo renders the charts, lazy-loaded on scroll.

**Tech Stack:** React 19, Vite 6, Tailwind v4, Nivo 0.99 (`@nivo/core`, `@nivo/line`, `@nivo/bar`), Node `node:test`, existing `lib/score.js` / `lib/bracket.js` pure functions.

## Global Constraints

- **Reuse the existing scorers; never duplicate scoring logic or point literals.** All scoring flows through `scoreSubmission` / `scoreBracket` in `lib/score.js`. Knockout point values are consumed by exporting the existing constants, not re-declaring them (per `CLAUDE.md`).
- **Node ESM everywhere.** `package.json` has `"type": "module"`; use `import`, not `require`.
- **Tests:** `npm test` runs `node --test lib/*.test.js`. New lib tests are `lib/<name>.test.js` and MUST be picked up by that glob. Scripts tests run via `node --test scripts/<name>.test.mjs`.
- **Submissions shape** (from Apps Script `?action=submissions` → `{ locked, submissions: [...] }`): each row is `{ email_hash, name, phase: 'group'|'knockout', picks }`. Group `picks = { matches: { [matchId]: { home_score, away_score } }, group_standings: { [letter]: [teamCode,...] } }`. Knockout `picks = { bracket: { [slot]: { advances, home, away, home_score, away_score } } }`.
- **results.json shape:** `{ updated_at, matches: { [matchId]: { home_score, away_score, status, advances? } } }`.
- **knockout.json shape:** `{ rounds: { R32: [{ slot, home, away, match_id }], R16|QF|SF|F: [{ slot, from:[slotA, slotB], match_id }] } }`.
- **Privacy:** `history.json` may ship names + scores in the static bundle — identical exposure to the post-lock leaderboard. Use `email_hash` + display name exactly as the leaderboard does. No emails, no secrets.
- **Graceful degrade:** every `fetch` on the stats page tolerates a missing/failed optional file (`history.json`, `odds.json`) without blanking the page.

---

## File Structure

- `scripts/build-history.mjs` — CLI: git-walk results.json, fetch submissions, call `buildHistorySeries`, write `public/history.json`.
- `scripts/build-history.test.mjs` — tests the CLI's git-walk parsing helper only (pure logic).
- `lib/history.js` — pure: `buildHistorySeries()`, `rankMovements()`. Tested.
- `lib/history.test.js`
- `lib/ceiling.js` — pure: `maxReachablePoints()`, `aliveTeams()`. Tested.
- `lib/ceiling.test.js`
- `lib/score.js` — MODIFY: export `KO_WINNER_POINTS`, `KO_CHAMPION_POINTS`.
- `stats.html` — new Vite entry.
- `vite.config.js` — MODIFY: add `stats` to rollup input.
- `src/stats/main.jsx` — React root.
- `src/stats/App.jsx` — fetch + compose.
- `src/stats/useStatsData.js` — data-loading hook (real + `?mockStats=1`).
- `src/stats/components/TheGap.jsx` — Nivo line.
- `src/stats/components/LiveCeiling.jsx` — Nivo bar.
- `src/stats/components/Superlatives.jsx` — award cards.
- `src/stats/mockStats.js` — fixture data for `?mockStats=1`.
- `src/form/components/TopBar.jsx` — MODIFY: add Stats nav link.
- `public/history.json` — generated artifact (committed).

---

## Task 1: Page scaffold, deps, and nav link

**Files:**
- Create: `stats.html`, `src/stats/main.jsx`, `src/stats/App.jsx`
- Modify: `vite.config.js`, `src/form/components/TopBar.jsx`, `package.json` (deps)

**Interfaces:**
- Produces: a reachable `/stats.html` route rendering a `<StatsApp>` shell; Nivo installed.

- [ ] **Step 1: Install Nivo packages**

Run:
```bash
npm install @nivo/core@0.99 @nivo/line@0.99 @nivo/bar@0.99
```
Expected: added to `dependencies`, no peer-dep errors (Nivo 0.99 lists `react ^19`).

- [ ] **Step 2: Read the two existing entry HTML files to copy the pattern**

Run: `cat leaderboard.html` — note the `<div id="root">` id and the `<script type="module" src="/src/leaderboard/main.jsx">` shape. Mirror it exactly.

- [ ] **Step 3: Create `stats.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9A%BD%3C/text%3E%3C/svg%3E" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pool Stats · World Cup 2026</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/stats/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `src/stats/main.jsx`**

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import '../styles/main.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 5: Create `src/stats/App.jsx` shell**

```jsx
export function App() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <h1 className="text-2xl font-bold">Pool Stats</h1>
      <p className="mt-2 text-slate-400">Charts coming online…</p>
    </div>
  );
}
```

- [ ] **Step 6: Add `stats` to the Vite rollup input**

In `vite.config.js`, find the `build.rollupOptions.input` object (it maps `main`/`leaderboard`/`bracket` to their HTML paths) and add:
```js
stats: resolve(__dirname, 'stats.html'),
```
Match the exact key/value style already used for `bracket`.

- [ ] **Step 7: Add a Stats link to `TopBar.jsx`**

Read `src/form/components/TopBar.jsx`. It already renders nav links (Leaderboard/Bracket). Add, in the same markup style as the existing links:
```jsx
<a href="/stats.html" className="/* copy the exact className of the sibling nav links */">Stats</a>
```

- [ ] **Step 8: Verify the page loads**

Run: `npm run dev` then open `http://localhost:5173/stats.html`.
Expected: "Pool Stats / Charts coming online…" renders; a "Stats" link appears in the TopBar on the form/leaderboard pages.

- [ ] **Step 9: Commit**

```bash
git add stats.html src/stats/main.jsx src/stats/App.jsx vite.config.js src/form/components/TopBar.jsx package.json package-lock.json
git commit -m "feat(stats): scaffold stats.html page + nav link + nivo deps"
```

---

## Task 2: Export knockout point constants from score.js

**Files:**
- Modify: `lib/score.js:16-17`

**Interfaces:**
- Produces: `export const KO_WINNER_POINTS = { R32:4, R16:16, QF:32, SF:64 }` and `export const KO_CHAMPION_POINTS = 128` — consumed by `lib/ceiling.js`.

- [ ] **Step 1: Add `export` to both constants**

In `lib/score.js`, change:
```js
const KO_WINNER_POINTS = { R32: 4, R16: 16, QF: 32, SF: 64 };
const KO_CHAMPION_POINTS = 128;
```
to:
```js
export const KO_WINNER_POINTS = { R32: 4, R16: 16, QF: 32, SF: 64 };
export const KO_CHAMPION_POINTS = 128;
```
(Leave every internal use as-is; adding `export` does not change local references.)

- [ ] **Step 2: Run the existing suite to confirm no regression**

Run: `npm test`
Expected: all existing lib tests still PASS (72 baseline).

- [ ] **Step 3: Commit**

```bash
git add lib/score.js
git commit -m "refactor(score): export KO point constants for reuse in ceiling"
```

---

## Task 3: `lib/ceiling.js` — alive teams + max reachable points

**Files:**
- Create: `lib/ceiling.js`, `lib/ceiling.test.js`

**Interfaces:**
- Consumes: `resolveActualBracket` from `lib/bracket.js`, `KO_ROUND_ORDER` from `lib/bracket.js`, `scoreBracket`/`KO_WINNER_POINTS`/`KO_CHAMPION_POINTS` from `lib/score.js`.
- Produces:
  - `aliveTeams(knockout, results) -> Set<string>` — team codes not yet eliminated (a team is eliminated once it is the non-advancing side of a *final* match).
  - `maxReachablePoints(bracket, knockout, results) -> { current, ceiling }` — `current` is the entrant's live `bracket_total`; `ceiling` adds the round-winner/champion points for every not-yet-final slot whose picked advancer is still alive (a loose but valid upper bound; exact-score bonuses are intentionally excluded — documented in the file header).

- [ ] **Step 1: Write the failing test**

```js
// lib/ceiling.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aliveTeams, maxReachablePoints } from './ceiling.js';

// Minimal 2-slot bracket: one R32 slot feeding a (degenerate) champion slot.
const knockout = {
  rounds: {
    R32: [
      { slot: 'r32-1', home: 'AAA', away: 'BBB', match_id: '1' },
      { slot: 'r32-2', home: 'CCC', away: 'DDD', match_id: '2' },
    ],
    R16: [], QF: [], SF: [],
    F: [{ slot: 'final', from: ['r32-1', 'r32-2'], match_id: '3' }],
  },
};

test('aliveTeams: losers of final matches are eliminated', () => {
  const results = { matches: {
    '1': { home_score: 2, away_score: 0, status: 'STATUS_FULL_TIME', advances: 'AAA' },
    '2': { home_score: 1, away_score: 3, status: 'STATUS_FULL_TIME', advances: 'DDD' },
  } };
  const alive = aliveTeams(knockout, results);
  assert.ok(alive.has('AAA'));
  assert.ok(alive.has('DDD'));
  assert.ok(!alive.has('BBB')); // lost r32-1
  assert.ok(!alive.has('CCC')); // lost r32-2
});

test('maxReachablePoints: adds champion points when picked champ still alive and final pending', () => {
  const results = { matches: {
    '1': { home_score: 2, away_score: 0, status: 'STATUS_FULL_TIME', advances: 'AAA' },
    '2': { home_score: 1, away_score: 3, status: 'STATUS_FULL_TIME', advances: 'DDD' },
    // final (match 3) NOT played yet
  } };
  const bracket = {
    'r32-1': { advances: 'AAA', home: 'AAA', away: 'BBB', home_score: 2, away_score: 0 },
    'r32-2': { advances: 'DDD', home: 'CCC', away: 'DDD', home_score: 1, away_score: 3 },
    'final': { advances: 'AAA', home: 'AAA', away: 'DDD', home_score: 1, away_score: 0 },
  };
  const { current, ceiling } = maxReachablePoints(bracket, knockout, results);
  // current: both R32 winners correct = 4 + 4 = 8. Final pending → champ not counted yet.
  assert.equal(current, 8);
  // ceiling: current + champion 128 (AAA still alive, final pending) = 136.
  assert.equal(ceiling, 136);
});

test('maxReachablePoints: does NOT add points for an eliminated picked advancer', () => {
  const results = { matches: {
    '1': { home_score: 0, away_score: 1, status: 'STATUS_FULL_TIME', advances: 'BBB' },
    '2': { home_score: 1, away_score: 3, status: 'STATUS_FULL_TIME', advances: 'DDD' },
  } };
  const bracket = {
    'r32-1': { advances: 'AAA', home: 'AAA', away: 'BBB', home_score: 2, away_score: 0 },
    'r32-2': { advances: 'DDD', home: 'CCC', away: 'DDD', home_score: 1, away_score: 3 },
    'final': { advances: 'AAA', home: 'AAA', away: 'DDD', home_score: 1, away_score: 0 },
  };
  const { current, ceiling } = maxReachablePoints(bracket, knockout, results);
  // current: r32-1 wrong (picked AAA, BBB advanced) = 0; r32-2 correct = 4.
  assert.equal(current, 4);
  // ceiling: AAA is eliminated → final champ points NOT addable → ceiling === current.
  assert.equal(ceiling, 4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/ceiling.test.js`
Expected: FAIL — `aliveTeams`/`maxReachablePoints` not defined.

- [ ] **Step 3: Implement `lib/ceiling.js`**

```js
// lib/ceiling.js
// "Who can still win": which teams remain alive, and the maximum points an
// entrant could still reach. The ceiling is a loose upper bound — it grants a
// slot's round-winner/champion points to any not-yet-final slot whose picked
// advancer is still alive. Exact-score bonuses are intentionally excluded (they
// depend on an exact matchup+scoreline; the winner points dominate the ranking).
import { KO_ROUND_ORDER, resolveActualBracket } from './bracket.js';
import { scoreBracket, KO_WINNER_POINTS, KO_CHAMPION_POINTS } from './score.js';

export function aliveTeams(knockout, results) {
  const { matchInfo } = resolveActualBracket(knockout, results);
  const eliminated = new Set();
  const seen = new Set();
  for (const round of KO_ROUND_ORDER) {
    for (const slot of knockout.rounds[round] || []) {
      const info = matchInfo[slot.slot];
      if (!info) continue;
      for (const team of [info.home, info.away]) if (team) seen.add(team);
      if (info.final && info.advances) {
        for (const team of [info.home, info.away]) {
          if (team && team !== info.advances) eliminated.add(team);
        }
      }
    }
  }
  const alive = new Set();
  for (const team of seen) if (!eliminated.has(team)) alive.add(team);
  return alive;
}

export function maxReachablePoints(bracket, knockout, results) {
  const current = scoreBracket(bracket, knockout, results).bracket_total;
  const { matchInfo } = resolveActualBracket(knockout, results);
  const alive = aliveTeams(knockout, results);

  let upside = 0;
  for (const round of KO_ROUND_ORDER) {
    for (const slot of knockout.rounds[round] || []) {
      const info = matchInfo[slot.slot];
      const pick = bracket?.[slot.slot];
      if (!info || info.final || !pick || !pick.advances) continue; // only pending slots
      if (!alive.has(pick.advances)) continue; // dead pick can't score
      upside += round === 'F' ? KO_CHAMPION_POINTS : (KO_WINNER_POINTS[round] || 0);
    }
  }
  return { current, ceiling: current + upside };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/ceiling.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ceiling.js lib/ceiling.test.js
git commit -m "feat(lib): ceiling — alive teams + max reachable points"
```

---

## Task 4: `lib/history.js` — replay series + rank movements

**Files:**
- Create: `lib/history.js`, `lib/history.test.js`

**Interfaces:**
- Consumes: `scoreSubmission`, `scoreBracket` from `lib/score.js`.
- Produces:
  - `buildHistorySeries({ snapshots, submissions, fixtures, knockout }) -> { snapshots: [{ t, standings: [{ email_hash, name, groupTotal, bracketTotal, total }] }] }`. `snapshots` input is `[{ t: ISO, results }]` (results already parsed). Groups submissions by `email_hash` exactly like the leaderboard (`phase === 'knockout'` → knockout row, else group row).
  - `rankMovements(series) -> [{ email_hash, name, firstRank, lastRank, delta }]` where rank is 1-based on `total` (desc) within each snapshot; `delta = firstRank - lastRank` (positive = climbed). Uses the first snapshot in which *any* entrant has a non-zero total as `firstRank` baseline (pre-scoring snapshots are all ties and meaningless).

- [ ] **Step 1: Write the failing test**

```js
// lib/history.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHistorySeries, rankMovements } from './history.js';

const fixtures = {
  groups: { A: { matches: ['m1'] } },
  matches: { m1: {} },
};
const knockout = { rounds: { R32: [], R16: [], QF: [], SF: [], F: [] } };

const submissions = [
  { email_hash: 'h1', name: 'Ana', phase: 'group',
    picks: { matches: { m1: { home_score: 1, away_score: 0 } }, group_standings: {} } },
  { email_hash: 'h2', name: 'Bo', phase: 'group',
    picks: { matches: { m1: { home_score: 3, away_score: 3 } }, group_standings: {} } },
];

// two snapshots: pre-result (nothing final), then m1 final 1-0 (Ana nails winner+exact)
const snapshots = [
  { t: '2026-06-11T20:00:00Z', results: { matches: { m1: { status: 'STATUS_SCHEDULED' } } } },
  { t: '2026-06-11T22:00:00Z', results: { matches: { m1: { home_score: 1, away_score: 0, status: 'STATUS_FULL_TIME' } } } },
];

test('buildHistorySeries computes per-entrant totals per snapshot', () => {
  const series = buildHistorySeries({ snapshots, submissions, fixtures, knockout });
  assert.equal(series.snapshots.length, 2);
  const s2 = series.snapshots[1].standings;
  const ana = s2.find((x) => x.email_hash === 'h1');
  const bo = s2.find((x) => x.email_hash === 'h2');
  assert.equal(ana.total, 6);  // correct winner (3) + exact (3)
  assert.equal(bo.total, 0);   // predicted 3-3 draw, actual 1-0
});

test('rankMovements ranks by total and reports delta from first scored snapshot', () => {
  const series = buildHistorySeries({ snapshots, submissions, fixtures, knockout });
  const moves = rankMovements(series);
  const ana = moves.find((x) => x.email_hash === 'h1');
  // First scored snapshot is snapshot 2; Ana is rank 1 there, Bo rank 2.
  assert.equal(ana.lastRank, 1);
  assert.ok(ana.delta >= 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/history.test.js`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement `lib/history.js`**

```js
// lib/history.js
// Reconstructs the leaderboard at every historical results snapshot by replaying
// the (locked) submissions through the existing pure scorers. Picks never change,
// so given the same git history this is deterministic.
import { scoreSubmission, scoreBracket } from './score.js';

function groupByEmail(submissions) {
  const byEmail = new Map();
  for (const sub of submissions) {
    const row = byEmail.get(sub.email_hash) || { email_hash: sub.email_hash, name: sub.name, group: null, knockout: null };
    if (sub.phase === 'knockout') row.knockout = sub; else row.group = sub;
    row.name = sub.name; // latest name wins
    byEmail.set(sub.email_hash, row);
  }
  return [...byEmail.values()];
}

export function buildHistorySeries({ snapshots, submissions, fixtures, knockout }) {
  const rows = groupByEmail(submissions);
  const out = snapshots.map(({ t, results }) => {
    const standings = rows.map((row) => {
      const g = row.group ? scoreSubmission(row.group.picks, fixtures, results) : null;
      const b = (row.knockout && knockout) ? scoreBracket(row.knockout.picks.bracket, knockout, results) : null;
      const groupTotal = g ? g.total : 0;
      const bracketTotal = b ? b.bracket_total : 0;
      return { email_hash: row.email_hash, name: row.name, groupTotal, bracketTotal, total: groupTotal + bracketTotal };
    });
    return { t, standings };
  });
  return { snapshots: out };
}

function rankSnapshot(standings) {
  const sorted = [...standings].sort((a, b) => b.total - a.total);
  const rankByEmail = new Map();
  sorted.forEach((s, i) => rankByEmail.set(s.email_hash, i + 1));
  return rankByEmail;
}

export function rankMovements(series) {
  const snaps = series.snapshots;
  if (!snaps.length) return [];
  const firstScoredIdx = snaps.findIndex((s) => s.standings.some((x) => x.total > 0));
  const baseIdx = firstScoredIdx === -1 ? 0 : firstScoredIdx;
  const firstRanks = rankSnapshot(snaps[baseIdx].standings);
  const lastRanks = rankSnapshot(snaps[snaps.length - 1].standings);
  return snaps[snaps.length - 1].standings.map((s) => {
    const firstRank = firstRanks.get(s.email_hash);
    const lastRank = lastRanks.get(s.email_hash);
    return { email_hash: s.email_hash, name: s.name, firstRank, lastRank, delta: firstRank - lastRank };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/history.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/history.js lib/history.test.js
git commit -m "feat(lib): history — replay series + rank movements"
```

---

## Task 5: `scripts/build-history.mjs` — git walk → public/history.json

**Files:**
- Create: `scripts/build-history.mjs`, `scripts/build-history.test.mjs`

**Interfaces:**
- Consumes: `buildHistorySeries` from `lib/history.js`; git CLI; `public/config.json` (for `apps_script_url`), `public/fixtures.json`, `public/knockout.json`.
- Produces: `public/history.json` matching `buildHistorySeries` output plus `built_at`. Exports a pure helper `parseGitLog(stdout) -> [{ sha, t }]` for testing.

- [ ] **Step 1: Write the failing test (pure git-log parser)**

```js
// scripts/build-history.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitLog } from './build-history.mjs';

test('parseGitLog turns "sha<TAB>iso" lines into ordered oldest-first records', () => {
  const stdout = [
    'aaa111\t2026-07-04T21:48:25+00:00',
    'bbb222\t2026-06-11T20:11:04+00:00',
  ].join('\n');
  const recs = parseGitLog(stdout);
  // git log is newest-first; parser reverses to oldest-first for a time series.
  assert.deepEqual(recs.map((r) => r.sha), ['bbb222', 'aaa111']);
  assert.equal(recs[0].t, '2026-06-11T20:11:04+00:00');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/build-history.test.mjs`
Expected: FAIL — `parseGitLog` not exported.

- [ ] **Step 3: Implement `scripts/build-history.mjs`**

```js
// scripts/build-history.mjs
// Walk the git history of public/results.json, replay each snapshot through the
// pure scorers, and write public/history.json (the time series behind "The Gap").
// Deterministic: picks are locked, so same history in → same file out.
//
// Usage:
//   node scripts/build-history.mjs
// Requires network access to the Apps Script submissions endpoint (post-lock).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildHistorySeries } from '../lib/history.js';

export function parseGitLog(stdout) {
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, t] = line.split('\t');
      return { sha, t };
    })
    .reverse(); // git log is newest-first; we want oldest-first
}

function gitShowJson(sha, path) {
  const raw = execFileSync('git', ['show', `${sha}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(raw);
}

async function main() {
  const config = JSON.parse(readFileSync('public/config.json', 'utf8'));
  const fixtures = JSON.parse(readFileSync('public/fixtures.json', 'utf8'));
  let knockout = null;
  try { knockout = JSON.parse(readFileSync('public/knockout.json', 'utf8')); } catch {}

  const log = execFileSync('git', ['log', '--format=%H\t%cI', '--', 'public/results.json'], { encoding: 'utf8' });
  const commits = parseGitLog(log);

  const snapshots = [];
  for (const { sha, t } of commits) {
    let results;
    try { results = gitShowJson(sha, 'public/results.json'); } catch { continue; }
    if (!results?.matches) continue;
    snapshots.push({ t, results });
  }

  const resp = await fetch(`${config.apps_script_url}?action=submissions`);
  const data = await resp.json();
  if (!data.locked) throw new Error('submissions not unlocked yet — cannot build history');
  const submissions = data.submissions;

  const series = buildHistorySeries({ snapshots, submissions, fixtures, knockout });
  const output = { built_at: new Date().toISOString(), ...series };
  writeFileSync('public/history.json', JSON.stringify(output));
  console.log(`Wrote public/history.json — ${series.snapshots.length} snapshots, ${series.snapshots.at(-1)?.standings.length ?? 0} entrants.`);
}

// Only run main() when invoked directly, not when imported by the test.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/build-history.test.mjs`
Expected: PASS.

- [ ] **Step 5: Generate the real artifact**

Run: `node scripts/build-history.mjs`
Expected: prints "Wrote public/history.json — N snapshots, 24 entrants." and creates `public/history.json`. If it errors on submissions not unlocked, confirm the pool is post-lock (it is, per HANDOFF).

- [ ] **Step 6: Sanity-check the artifact**

Run: `node -e "const h=require('./public/history.json'); console.log(h.snapshots.length, 'snaps'); const last=h.snapshots.at(-1).standings; console.log('top:', [...last].sort((a,b)=>b.total-a.total)[0]);"`
Expected: dozens of snapshots; top entrant's `total` matches the current live leaderboard leader.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-history.mjs scripts/build-history.test.mjs public/history.json
git commit -m "feat(scripts): build-history — reconstruct leaderboard time series from git"
```

---

## Task 6: Stats data hook (`useStatsData`) + mock fixtures

**Files:**
- Create: `src/stats/useStatsData.js`, `src/stats/mockStats.js`
- Modify: `src/stats/App.jsx`

**Interfaces:**
- Produces: `useStatsData() -> { config, fixtures, results, knockout, history, submissions, loading, error }`. On `?mockStats=1`, returns `mockStats.js` fixtures without any network calls.
- Consumes: fetches `/config.json`, `/fixtures.json`, `/results.json`, `/knockout.json` (optional), `/history.json` (optional), and `${config.apps_script_url}?action=submissions`.

- [ ] **Step 1: Create `src/stats/mockStats.js`**

```js
// Minimal fixtures so the stats page is developable without live data.
// Two entrants, three snapshots. Shapes mirror the real files.
export const mockStats = {
  config: { apps_script_url: '', buy_in_usd: 30 },
  fixtures: { groups: {}, matches: {} },
  knockout: { rounds: { R32: [], R16: [], QF: [], SF: [], F: [] } },
  results: { updated_at: new Date().toISOString(), matches: {} },
  submissions: [
    { email_hash: 'h1', name: 'Ana', phase: 'group', picks: { matches: {}, group_standings: {} } },
    { email_hash: 'h2', name: 'Bo', phase: 'group', picks: { matches: {}, group_standings: {} } },
  ],
  history: {
    built_at: new Date().toISOString(),
    snapshots: [
      { t: '2026-06-15T00:00:00Z', standings: [
        { email_hash: 'h1', name: 'Ana', groupTotal: 12, bracketTotal: 0, total: 12 },
        { email_hash: 'h2', name: 'Bo', groupTotal: 9, bracketTotal: 0, total: 9 },
      ] },
      { t: '2026-06-25T00:00:00Z', standings: [
        { email_hash: 'h1', name: 'Ana', groupTotal: 40, bracketTotal: 0, total: 40 },
        { email_hash: 'h2', name: 'Bo', groupTotal: 44, bracketTotal: 0, total: 44 },
      ] },
      { t: '2026-07-03T00:00:00Z', standings: [
        { email_hash: 'h1', name: 'Ana', groupTotal: 40, bracketTotal: 60, total: 100 },
        { email_hash: 'h2', name: 'Bo', groupTotal: 44, bracketTotal: 40, total: 84 },
      ] },
    ],
  },
};
```

- [ ] **Step 2: Create `src/stats/useStatsData.js`**

```js
import { useEffect, useState } from 'react';
import { mockStats } from './mockStats.js';

export function useStatsData() {
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mockStats') === '1') {
      setState({ loading: false, error: null, ...mockStats });
      return;
    }
    (async () => {
      try {
        const [config, fixtures, results] = await Promise.all([
          fetch('/config.json').then((x) => x.json()),
          fetch('/fixtures.json').then((x) => x.json()),
          fetch('/results.json').then((x) => x.json()),
        ]);
        const knockout = await fetch('/knockout.json').then((x) => (x.ok ? x.json() : null)).catch(() => null);
        const history = await fetch('/history.json').then((x) => (x.ok ? x.json() : null)).catch(() => null);
        let submissions = [];
        try {
          const data = await fetch(`${config.apps_script_url}?action=submissions`).then((x) => x.json());
          submissions = data.locked ? data.submissions : [];
        } catch { /* leave empty; charts degrade */ }
        setState({ loading: false, error: null, config, fixtures, results, knockout, history, submissions });
      } catch (e) {
        setState({ loading: false, error: String(e) });
      }
    })();
  }, []);

  return state;
}
```

- [ ] **Step 3: Wire the hook into `App.jsx` (still shell UI)**

```jsx
import { useStatsData } from './useStatsData.js';

export function App() {
  const data = useStatsData();
  if (data.loading) return <div className="mx-auto max-w-5xl px-4 py-8 text-slate-400">Loading stats…</div>;
  if (data.error) return <div className="mx-auto max-w-5xl px-4 py-8 text-red-400">Couldn’t load stats: {data.error}</div>;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100 space-y-8">
      <h1 className="text-2xl font-bold">Pool Stats</h1>
      <p className="text-slate-400">{data.history?.snapshots?.length ?? 0} snapshots · {data.submissions?.length ?? 0} submissions loaded.</p>
    </div>
  );
}
```

- [ ] **Step 4: Verify both modes**

Run: `npm run dev`, open `http://localhost:5173/stats.html?mockStats=1` (shows "3 snapshots · 2 submissions") and `http://localhost:5173/stats.html` (shows live counts).
Expected: no console errors in either mode.

- [ ] **Step 5: Commit**

```bash
git add src/stats/useStatsData.js src/stats/mockStats.js src/stats/App.jsx
git commit -m "feat(stats): data-loading hook + mockStats escape hatch"
```

---

## Task 7: The Gap chart (`TheGap.jsx`)

**Files:**
- Create: `src/stats/components/TheGap.jsx`
- Modify: `src/stats/App.jsx`

**Interfaces:**
- Consumes: `history` (`{ snapshots: [{ t, standings:[{email_hash,name,total,...}] }] }`).
- Produces: `<TheGap history={history} />` — a Nivo `ResponsiveLine` of cumulative `total` per entrant over time, gold-highlighted leader, slice tooltip that buckets tied entrants.

> **Before implementing:** confirm current `@nivo/line` prop names against live docs via the `context7` MCP (`resolve-library-id` → `@nivo/line`, then `query-docs` for "ResponsiveLine sliceTooltip enableSlices"). The code below targets Nivo 0.99's documented API.

- [ ] **Step 1: Implement `TheGap.jsx`**

```jsx
import { ResponsiveLine } from '@nivo/line';
import { useMemo } from 'react';

// Transform history → Nivo series. Each entrant = one line of {x: ISO, y: total}.
function toSeries(history) {
  const byEmail = new Map();
  for (const snap of history.snapshots) {
    for (const s of snap.standings) {
      if (!byEmail.has(s.email_hash)) byEmail.set(s.email_hash, { id: s.name, email_hash: s.email_hash, data: [] });
      byEmail.get(s.email_hash).data.push({ x: snap.t, y: s.total });
    }
  }
  return [...byEmail.values()];
}

function leaderEmail(history) {
  const last = history.snapshots.at(-1)?.standings ?? [];
  return [...last].sort((a, b) => b.total - a.total)[0]?.email_hash ?? null;
}

export function TheGap({ history }) {
  const series = useMemo(() => (history ? toSeries(history) : []), [history]);
  const leader = useMemo(() => (history ? leaderEmail(history) : null), [history]);
  if (!series.length) return <p className="text-slate-500">No history yet.</p>;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">The Gap</h2>
      <p className="text-sm text-slate-400 mb-3">Every entrant’s cumulative points over the tournament. Leader in gold — hover a moment for the standing there.</p>
      <div style={{ height: 380 }}>
        <ResponsiveLine
          data={series}
          margin={{ top: 20, right: 90, bottom: 50, left: 50 }}
          xScale={{ type: 'time', format: '%Y-%m-%dT%H:%M:%S%Z', precision: 'hour' }}
          xFormat="time:%b %-d"
          yScale={{ type: 'linear', min: 0, max: 'auto' }}
          axisBottom={{ format: '%b %-d', tickValues: 6 }}
          axisLeft={{ legend: 'points', legendOffset: -40, legendPosition: 'middle' }}
          curve="monotoneX"
          enablePoints={false}
          enableSlices="x"
          colors={(d) => (d.email_hash === leader ? '#fbbf24' : '#475569')}
          lineWidth={1.5}
          theme={{ text: { fill: '#cbd5e1' }, axis: { ticks: { text: { fill: '#94a3b8' } } }, grid: { line: { stroke: '#1e293b' } } }}
          sliceTooltip={({ slice }) => {
            // Bucket points → names for a "tied at N" tooltip.
            const buckets = new Map();
            for (const p of slice.points) {
              const y = p.data.y;
              if (!buckets.has(y)) buckets.set(y, []);
              buckets.get(y).push(p.seriesId);
            }
            const rows = [...buckets.entries()].sort((a, b) => b[0] - a[0]).slice(0, 6);
            return (
              <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 6, padding: 8, fontSize: 12, color: '#e2e8f0' }}>
                <div style={{ color: '#94a3b8', marginBottom: 4 }}>{String(slice.points[0]?.data?.xFormatted ?? '')}</div>
                {rows.map(([pts, names]) => (
                  <div key={pts}><strong style={{ color: '#fbbf24' }}>{pts}</strong> — {names.join(' · ')}</div>
                ))}
              </div>
            );
          }}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render `<TheGap>` in `App.jsx`**

Add `import { TheGap } from './components/TheGap.jsx';` and, inside the main `div`, replace the placeholder `<p>` with:
```jsx
<TheGap history={data.history} />
```

- [ ] **Step 3: Verify with mock + real data**

Run: `npm run dev`, open `http://localhost:5173/stats.html?mockStats=1`.
Expected: two lines climbing, gold leader; hovering shows a vertical slice with a tied-bucket tooltip. Then check `http://localhost:5173/stats.html` — all 24 real lines render.

- [ ] **Step 4: Commit**

```bash
git add src/stats/components/TheGap.jsx src/stats/App.jsx
git commit -m "feat(stats): The Gap — cumulative points line with tied-bucket slice tooltip"
```

---

## Task 8: Live Ceiling chart (`LiveCeiling.jsx`)

**Files:**
- Create: `src/stats/components/LiveCeiling.jsx`
- Modify: `src/stats/App.jsx`

**Interfaces:**
- Consumes: `submissions`, `knockout`, `results` (to compute `maxReachablePoints` per entrant), plus `fixtures` (for group `current` via the leaderboard total). For Phase 1 the ceiling bar uses the *knockout* current/ceiling from `maxReachablePoints`; the group points are already frozen and are added as a constant base per entrant.
- Produces: `<LiveCeiling submissions groupTotalsByEmail knockout results />` — a Nivo `ResponsiveBar` showing, per entrant sorted by ceiling: `current` (solid) and `upside = ceiling - current` (faded) stacked.

> **Before implementing:** confirm `@nivo/bar` props (`keys`, `indexBy`, `layout`, `valueFormat`) via `context7` for Nivo 0.99.

- [ ] **Step 1: Implement `LiveCeiling.jsx`**

```jsx
import { ResponsiveBar } from '@nivo/bar';
import { useMemo } from 'react';
import { maxReachablePoints } from '../../../lib/ceiling.js';

// groupTotalsByEmail: Map(email_hash -> frozen group points). knockout/results as loaded.
function buildRows({ submissions, groupTotalsByEmail, knockout, results }) {
  const byEmail = new Map();
  for (const sub of submissions) {
    const row = byEmail.get(sub.email_hash) || { email_hash: sub.email_hash, name: sub.name, knockout: null };
    if (sub.phase === 'knockout') row.knockout = sub;
    row.name = sub.name;
    byEmail.set(sub.email_hash, row);
  }
  const rows = [...byEmail.values()].map((row) => {
    const groupBase = groupTotalsByEmail.get(row.email_hash) ?? 0;
    const ko = (row.knockout && knockout) ? maxReachablePoints(row.knockout.picks.bracket, knockout, results) : { current: 0, ceiling: 0 };
    const current = groupBase + ko.current;
    const ceiling = groupBase + ko.ceiling;
    return { name: row.name, current, upside: Math.max(0, ceiling - current), ceiling };
  });
  rows.sort((a, b) => b.ceiling - a.ceiling);
  return rows;
}

export function LiveCeiling({ submissions, groupTotalsByEmail, knockout, results }) {
  const rows = useMemo(
    () => (knockout && results ? buildRows({ submissions, groupTotalsByEmail, knockout, results }) : []),
    [submissions, groupTotalsByEmail, knockout, results],
  );
  if (!rows.length) return null;
  const leaderCurrent = Math.max(...rows.map((r) => r.current));

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">Live Ceiling</h2>
      <p className="text-sm text-slate-400 mb-3">Solid = points now, faded = max still reachable given who’s alive in your bracket. Anyone whose ceiling is below the current leader’s {leaderCurrent} is out of it.</p>
      <div style={{ height: Math.max(240, rows.length * 22) }}>
        <ResponsiveBar
          data={rows}
          keys={['current', 'upside']}
          indexBy="name"
          layout="horizontal"
          margin={{ top: 10, right: 20, bottom: 30, left: 90 }}
          padding={0.25}
          colors={({ id }) => (id === 'current' ? '#4ade80' : '#1f3d2b')}
          markers={[{ axis: 'x', value: leaderCurrent, lineStyle: { stroke: '#fbbf24', strokeWidth: 1, strokeDasharray: '4 4' }, legend: 'leader now', legendOrientation: 'vertical' }]}
          enableGridY={false}
          valueFormat={(v) => `${v}`}
          theme={{ text: { fill: '#cbd5e1' }, axis: { ticks: { text: { fill: '#94a3b8' } } } }}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Compute `groupTotalsByEmail` in `App.jsx` and render**

In `App.jsx`, add:
```jsx
import { useMemo } from 'react';
import { LiveCeiling } from './components/LiveCeiling.jsx';
import { scoreSubmission } from '../../lib/score.js';
```
Then inside `App`, after `const data = useStatsData();` guards:
```jsx
const groupTotalsByEmail = useMemo(() => {
  const m = new Map();
  if (!data.submissions || !data.fixtures || !data.results) return m;
  for (const sub of data.submissions) {
    if (sub.phase === 'knockout') continue;
    m.set(sub.email_hash, scoreSubmission(sub.picks, data.fixtures, data.results).total);
  }
  return m;
}, [data.submissions, data.fixtures, data.results]);
```
And render after `<TheGap>`:
```jsx
<LiveCeiling submissions={data.submissions} groupTotalsByEmail={groupTotalsByEmail} knockout={data.knockout} results={data.results} />
```

- [ ] **Step 3: Verify**

Run: `npm run dev`, open `http://localhost:5173/stats.html` (real data — needs the seeded knockout to show upside).
Expected: horizontal bars sorted by ceiling, gold "leader now" marker line; the `?mockStats=1` mode renders an empty knockout gracefully (no bars, no crash).

- [ ] **Step 4: Commit**

```bash
git add src/stats/components/LiveCeiling.jsx src/stats/App.jsx
git commit -m "feat(stats): Live Ceiling — current vs max-reachable points bars"
```

---

## Task 9: Superlatives band (`Superlatives.jsx`)

**Files:**
- Create: `src/stats/components/Superlatives.jsx`
- Modify: `src/stats/App.jsx`

**Interfaces:**
- Consumes: `history` (for `rankMovements` → Biggest Riser/Faller), `submissions` + `fixtures` + `results` (for Most Exact via `scoreSubmission().exact_score_count`), `knockout` + `results` (for Live Longshot: rarest still-alive champion pick via `aliveTeams`).
- Produces: `<Superlatives .../>` — a responsive card grid. Phase 1 awards: **Biggest Riser**, **Biggest Faller**, **Most 🎯 Exact (group)**, **Live Longshot** (least-picked champion still alive). Consensus-heavy awards (Hipster, Chalk-Eater) are Phase 2.

- [ ] **Step 1: Implement `Superlatives.jsx`**

```jsx
import { useMemo } from 'react';
import { rankMovements } from '../../../lib/history.js';
import { scoreSubmission } from '../../../lib/score.js';
import { aliveTeams } from '../../../lib/ceiling.js';

function computeAwards({ history, submissions, fixtures, results, knockout }) {
  const awards = [];

  if (history?.snapshots?.length) {
    const moves = rankMovements(history);
    const riser = [...moves].sort((a, b) => b.delta - a.delta)[0];
    const faller = [...moves].sort((a, b) => a.delta - b.delta)[0];
    if (riser) awards.push({ title: 'Biggest Riser', who: riser.name, detail: `▲ ${riser.delta} spots` });
    if (faller && faller.delta < 0) awards.push({ title: 'Biggest Faller', who: faller.name, detail: `▼ ${-faller.delta} spots` });
  }

  if (submissions?.length && fixtures && results) {
    let best = null;
    for (const sub of submissions) {
      if (sub.phase === 'knockout') continue;
      const n = scoreSubmission(sub.picks, fixtures, results).exact_score_count;
      if (!best || n > best.n) best = { name: sub.name, n };
    }
    if (best && best.n > 0) awards.push({ title: 'Most 🎯 Exact', who: best.name, detail: `${best.n} exact scores` });
  }

  if (submissions?.length && knockout && results) {
    const alive = aliveTeams(knockout, results);
    const finalSlot = (knockout.rounds.F || [])[0]?.slot;
    if (finalSlot) {
      const tally = new Map(); // team -> [names]
      for (const sub of submissions) {
        if (sub.phase !== 'knockout') continue;
        const champ = sub.picks?.bracket?.[finalSlot]?.advances;
        if (champ && alive.has(champ)) {
          if (!tally.has(champ)) tally.set(champ, []);
          tally.get(champ).push(sub.name);
        }
      }
      // Rarest still-alive champion pick (fewest backers).
      const rarest = [...tally.entries()].sort((a, b) => a[1].length - b[1].length)[0];
      if (rarest) awards.push({ title: 'Live Longshot', who: rarest[1][0], detail: `${rarest[0]} 🏆 · ${rarest[1].length} backer${rarest[1].length > 1 ? 's' : ''}` });
    }
  }

  return awards;
}

export function Superlatives(props) {
  const awards = useMemo(() => computeAwards(props), [props]);
  if (!awards.length) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">🏅 Superlatives</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {awards.map((a) => (
          <div key={a.title} className="rounded-lg bg-slate-800 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">{a.title}</div>
            <div className="mt-1 font-semibold text-slate-100">{a.who}</div>
            <div className="text-sm text-emerald-400">{a.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render `<Superlatives>` between The Gap and Live Ceiling in `App.jsx`**

```jsx
import { Superlatives } from './components/Superlatives.jsx';
// ...
<Superlatives history={data.history} submissions={data.submissions} fixtures={data.fixtures} results={data.results} knockout={data.knockout} />
```
Place it right after `<TheGap>` (layout order: Gap → Superlatives → Live Ceiling).

- [ ] **Step 3: Verify**

Run: `npm run dev`, `http://localhost:5173/stats.html?mockStats=1` shows Riser/Faller cards; `http://localhost:5173/stats.html` shows all four with real names.
Expected: no crash when knockout/history absent (cards simply omitted).

- [ ] **Step 4: Commit**

```bash
git add src/stats/components/Superlatives.jsx src/stats/App.jsx
git commit -m "feat(stats): Superlatives band — riser/faller/most-exact/live-longshot"
```

---

## Task 10: Lazy-load charts + final layout polish

**Files:**
- Modify: `src/stats/App.jsx`

**Interfaces:**
- Produces: charts wrapped in `React.lazy` + `Suspense` so Nivo isn't in the first-paint bundle; final section ordering and spacing.

- [ ] **Step 1: Convert chart imports to lazy**

In `App.jsx`, replace the three direct component imports with:
```jsx
import { lazy, Suspense, useMemo } from 'react';
const TheGap = lazy(() => import('./components/TheGap.jsx').then((m) => ({ default: m.TheGap })));
const LiveCeiling = lazy(() => import('./components/LiveCeiling.jsx').then((m) => ({ default: m.LiveCeiling })));
const Superlatives = lazy(() => import('./components/Superlatives.jsx').then((m) => ({ default: m.Superlatives })));
```
(`Superlatives` is light but lazying it keeps the pattern uniform.)

- [ ] **Step 2: Wrap the rendered charts in Suspense**

```jsx
<Suspense fallback={<div className="text-slate-500">Loading chart…</div>}>
  <TheGap history={data.history} />
  <Superlatives history={data.history} submissions={data.submissions} fixtures={data.fixtures} results={data.results} knockout={data.knockout} />
  <LiveCeiling submissions={data.submissions} groupTotalsByEmail={groupTotalsByEmail} knockout={data.knockout} results={data.results} />
</Suspense>
```

- [ ] **Step 3: Build to confirm code-splitting**

Run: `npm run build`
Expected: build succeeds; the Nivo chunks appear as separate JS files in `dist/assets/` (not bundled into the stats entry chunk).

- [ ] **Step 4: Verify prod-style output**

Run: `npm run dev`, reload `http://localhost:5173/stats.html` — brief "Loading chart…" flashes, then all three sections render in order (Gap → Superlatives → Ceiling).

- [ ] **Step 5: Commit**

```bash
git add src/stats/App.jsx
git commit -m "feat(stats): lazy-load charts + final section ordering"
```

---

## Self-Review notes (addressed)

- **Spec coverage (Phase 1):** data pipeline → Tasks 4–5; The Gap → Task 7; Live Ceiling → Tasks 3, 8; Superlatives → Tasks 4, 9; page/routing/lazy-load → Tasks 1, 10; mock escape hatch → Task 6. Phase 2 charts (Sankey, Twins, Heatmap, Exact-count, Contrarian) are intentionally out of scope.
- **Scope refinement vs spec:** Phase 1 superlatives use only history/scoring-derived stats + a simple champion tally (Live Longshot). The full consensus engine (`lib/consensus.js`) and consensus-based awards (Hipster, Chalk-Eater) move to Phase 2 with the Contrarian scatter that also needs them — noted so Phase 2 planning picks them up.
- **No duplicated point literals:** Task 2 exports the KO constants; `ceiling.js` imports them (satisfies the `CLAUDE.md` gotcha).
- **Nivo API drift:** Tasks 7–8 flag a `context7` docs check before implementing, since Nivo prop names can shift between minor versions.

## Manual step callout

`public/history.json` is generated by `scripts/build-history.mjs` (Task 5) and committed. It is **not** auto-refreshed by the cron in Phase 1 — re-run the script manually to update the Gap. Wiring it into `.github/workflows/fetch-results.yml` is a Phase 2 follow-up.
