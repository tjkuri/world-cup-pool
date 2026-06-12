# Leaderboard QoL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a by-match drilldown view (chip strip + native picker + modal) and a 3-stat narrative band to the leaderboard page.

**Architecture:** Pure helpers in `lib/leaderboardStats.js` (testable via existing `node --test` infra). Three new React components (`MatchStrip`, `MatchModal`, `StatBand`) in `src/leaderboard/components/`. Small App.jsx refactor lifts scoring into a shared `useMemo` so the new components don't re-score. URL hash `#match/{matchId}` for shareable links, mirroring the existing `#picks/{email_hash}` pattern.

**Tech Stack:** React 19, Tailwind v4, vanilla JS lib (node --test). Reuses `lib/score.js`, `lib/status.js`, `src/shared/teamNames.js`. No new deps.

**Files touched:**
- new `lib/leaderboardStats.js`
- new `lib/leaderboardStats.test.js`
- new `src/leaderboard/components/MatchStrip.jsx`
- new `src/leaderboard/components/MatchModal.jsx`
- new `src/leaderboard/components/StatBand.jsx`
- modify `src/leaderboard/components/LeaderboardTable.jsx` (accept pre-scored entries)
- modify `src/leaderboard/App.jsx` (lift scoring, wire components, hash routing)

**Important note on testing/pushing:** This plan ships in local commits only. Do NOT `git push` between tasks; the user wants to manually test the whole thing in the dev server before any push happens.

---

### Task 1: Create `lib/leaderboardStats.js` with `partitionFinishedMatches`

**Files:**
- Create: `lib/leaderboardStats.js`
- Create: `lib/leaderboardStats.test.js`

- [ ] **Step 1: Write the failing test**

Create `lib/leaderboardStats.test.js` with this content:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partitionFinishedMatches } from './leaderboardStats.js';

// Use noon-UTC anchors so .toDateString() lands on the same calendar day
// across most TZs (anything tighter than UTC±12 is consistent).
const fixtures = {
  matches: {
    'a': { kickoff_iso: '2026-06-12T12:00:00Z', home: 'KOR', away: 'CZE', group: 'A' },
    'b': { kickoff_iso: '2026-06-11T12:00:00Z', home: 'MEX', away: 'RSA', group: 'A' },
    'c': { kickoff_iso: '2026-06-10T12:00:00Z', home: 'OLD', away: 'MATCH', group: 'B' },
    'd': { kickoff_iso: '2026-06-12T12:00:00Z', home: 'NOT', away: 'YET', group: 'B' },
  },
};
const results = {
  matches: {
    'a': { home_score: 2, away_score: 1, status: 'STATUS_FULL_TIME' },
    'b': { home_score: 2, away_score: 0, status: 'STATUS_FULL_TIME' },
    'c': { home_score: 1, away_score: 0, status: 'STATUS_FULL_TIME' },
    'd': { home_score: 0, away_score: 0, status: 'STATUS_SCHEDULED' },
  },
};

test('partitionFinishedMatches buckets by today / yesterday / older', () => {
  const refDate = new Date('2026-06-12T12:00:00Z');
  const part = partitionFinishedMatches(fixtures, results, refDate);
  assert.deepEqual(part.today, ['a']);
  assert.deepEqual(part.yesterday, ['b']);
  assert.deepEqual(part.older, ['c']);
});

test('partitionFinishedMatches excludes non-final matches', () => {
  const refDate = new Date('2026-06-12T12:00:00Z');
  const part = partitionFinishedMatches(fixtures, results, refDate);
  const all = [...part.today, ...part.yesterday, ...part.older];
  assert.equal(all.includes('d'), false);
});

test('partitionFinishedMatches returns empty buckets when nothing finished', () => {
  const allScheduled = {
    matches: { 'a': { status: 'STATUS_SCHEDULED' } },
  };
  const part = partitionFinishedMatches(fixtures, allScheduled, new Date('2026-06-12T12:00:00Z'));
  assert.deepEqual(part, { today: [], yesterday: [], older: [] });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: tests fail with "Cannot find module './leaderboardStats.js'" or similar.

- [ ] **Step 3: Write minimal implementation**

Create `lib/leaderboardStats.js`:

```js
import { isMatchFinal } from './status.js';

// Partition the finished matches into today / yesterday / older buckets.
// Day comparison uses each viewer's local TZ via .toDateString(); pass `refDate`
// to make the function pure/testable.
export function partitionFinishedMatches(fixtures, results, refDate) {
  const ref = refDate.toDateString();
  const refMinus = new Date(refDate);
  refMinus.setDate(refDate.getDate() - 1);
  const refMinusStr = refMinus.toDateString();
  const out = { today: [], yesterday: [], older: [] };
  const finished = Object.entries(fixtures.matches)
    .filter(([mid]) => isMatchFinal(results?.matches?.[mid]?.status))
    .sort((a, b) => b[1].kickoff_iso.localeCompare(a[1].kickoff_iso));
  for (const [mid, fx] of finished) {
    const d = new Date(fx.kickoff_iso).toDateString();
    if (d === ref) out.today.push(mid);
    else if (d === refMinusStr) out.yesterday.push(mid);
    else out.older.push(mid);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass; total count grew by 3.

- [ ] **Step 5: Commit**

```bash
git add lib/leaderboardStats.js lib/leaderboardStats.test.js
git commit -m "feat(lib): add partitionFinishedMatches helper for leaderboard strip"
```

---

### Task 2: Add `computeMatchSummary` to `lib/leaderboardStats.js`

**Files:**
- Modify: `lib/leaderboardStats.js`
- Modify: `lib/leaderboardStats.test.js`

- [ ] **Step 1: Append failing tests**

Append to `lib/leaderboardStats.test.js`:

```js
import { computeMatchSummary } from './leaderboardStats.js';

function entryWith(matchPoints, picks) {
  return { scoring: { match_points: matchPoints }, picks: { matches: picks } };
}

test('computeMatchSummary counts exact, winner, and consensus pick', () => {
  const entries = [
    entryWith({ m1: 6 }, { m1: { home_score: 2, away_score: 0 } }),
    entryWith({ m1: 6 }, { m1: { home_score: 2, away_score: 0 } }),
    entryWith({ m1: 3 }, { m1: { home_score: 2, away_score: 1 } }),
    entryWith({ m1: 0 }, { m1: { home_score: 1, away_score: 1 } }),
  ];
  const s = computeMatchSummary('m1', entries);
  assert.equal(s.exactCount, 2);
  assert.equal(s.winnerCount, 3);
  assert.equal(s.totalCount, 4);
  assert.equal(s.consensus, '2-0');
});

test('computeMatchSummary returns null consensus on a top-tie', () => {
  const entries = [
    entryWith({ m1: 6 }, { m1: { home_score: 2, away_score: 0 } }),
    entryWith({ m1: 6 }, { m1: { home_score: 2, away_score: 1 } }),
  ];
  const s = computeMatchSummary('m1', entries);
  assert.equal(s.consensus, null);
});

test('computeMatchSummary tolerates entries with no pick for the match', () => {
  const entries = [
    { scoring: { match_points: {} }, picks: { matches: {} } },
  ];
  const s = computeMatchSummary('m1', entries);
  assert.equal(s.exactCount, 0);
  assert.equal(s.winnerCount, 0);
  assert.equal(s.totalCount, 1);
  assert.equal(s.consensus, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 3 new tests fail with "computeMatchSummary is not a function".

- [ ] **Step 3: Add implementation**

Append to `lib/leaderboardStats.js`:

```js
// Summary stats rendered in the MatchModal header band.
// Consensus is a strict plurality; if the top pick is tied with another, returns null.
export function computeMatchSummary(matchId, entries) {
  const totalCount = entries.length;
  let exactCount = 0;
  let winnerCount = 0;
  const pickCounts = new Map();
  for (const e of entries) {
    const pts = e.scoring?.match_points?.[matchId];
    if (pts >= 6) exactCount += 1;
    if (pts >= 3) winnerCount += 1;
    const pick = e.picks?.matches?.[matchId];
    if (pick && Number.isFinite(pick.home_score) && Number.isFinite(pick.away_score)) {
      const key = `${pick.home_score}-${pick.away_score}`;
      pickCounts.set(key, (pickCounts.get(key) || 0) + 1);
    }
  }
  let topKey = null;
  let topCount = 0;
  let tieAtTop = false;
  for (const [key, count] of pickCounts.entries()) {
    if (count > topCount) { topKey = key; topCount = count; tieAtTop = false; }
    else if (count === topCount && topCount > 0) { tieAtTop = true; }
  }
  return { exactCount, winnerCount, totalCount, consensus: tieAtTop ? null : topKey };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/leaderboardStats.js lib/leaderboardStats.test.js
git commit -m "feat(lib): add computeMatchSummary for MatchModal header stats"
```

---

### Task 3: Add three StatBand helpers to `lib/leaderboardStats.js`

**Files:**
- Modify: `lib/leaderboardStats.js`
- Modify: `lib/leaderboardStats.test.js`

- [ ] **Step 1: Append failing tests**

Append to `lib/leaderboardStats.test.js`:

```js
import { computeMostExact, computeLeadStat, computeLatestMatchTop } from './leaderboardStats.js';

function statEntry(name, total, exact, matchPoints = {}) {
  return {
    name,
    scoring: { total, exact_score_count: exact, match_points: matchPoints },
  };
}

test('computeMostExact returns single leader', () => {
  const entries = [statEntry('Alice', 10, 3), statEntry('Bob', 8, 1)];
  const r = computeMostExact(entries);
  assert.equal(r.count, 3);
  assert.deepEqual(r.names, ['Alice']);
  assert.equal(r.label, 'Alice (3 exact)');
});

test('computeMostExact lists ties up to 2 names then "and N others"', () => {
  const entries = [
    statEntry('Charlie', 10, 2),
    statEntry('Alice', 10, 2),
    statEntry('Bob', 10, 2),
    statEntry('Dave', 10, 2),
  ];
  const r = computeMostExact(entries);
  assert.equal(r.label, 'Alice, Bob and 2 others (2 exact)');
});

test('computeLeadStat formats gap-over-runner-up', () => {
  const entries = [statEntry('Alice', 15, 2), statEntry('Bob', 10, 1)];
  const r = computeLeadStat(entries);
  assert.equal(r.label, 'Alice +5 over Bob');
});

test('computeLeadStat formats N-way tie at top', () => {
  const entries = [statEntry('Alice', 15, 2), statEntry('Bob', 15, 1), statEntry('Carol', 15, 1)];
  const r = computeLeadStat(entries);
  assert.equal(r.label, '3-way tie at 15 pts');
});

test('computeLatestMatchTop picks the latest finished match', () => {
  const fixtures = {
    matches: {
      'old': { kickoff_iso: '2026-06-11T19:00Z', home: 'MEX', away: 'RSA', group: 'A' },
      'new': { kickoff_iso: '2026-06-12T02:00Z', home: 'KOR', away: 'CZE', group: 'A' },
      'pending': { kickoff_iso: '2026-06-13T19:00Z', home: 'BIH', away: 'CAN', group: 'B' },
    },
  };
  const results = {
    matches: {
      'old': { home_score: 2, away_score: 0, status: 'STATUS_FULL_TIME' },
      'new': { home_score: 2, away_score: 1, status: 'STATUS_FULL_TIME' },
      'pending': { status: 'STATUS_SCHEDULED' },
    },
  };
  const entries = [
    statEntry('Alice', 12, 2, { 'new': 6, 'old': 6 }),
    statEntry('Bob', 9, 1, { 'new': 3, 'old': 6 }),
  ];
  const r = computeLatestMatchTop(entries, fixtures, results);
  assert.equal(r.matchId, 'new');
  assert.equal(r.name, 'Alice');
  assert.equal(r.points, 6);
  assert.equal(r.matchLabel, 'KOR 2-1 CZE');
  assert.equal(r.label, 'Alice +6');
});

test('computeLatestMatchTop returns null when nothing is finished', () => {
  const fixtures = { matches: { 'x': { kickoff_iso: '2026-06-13T19:00Z', home: 'A', away: 'B' } } };
  const results = { matches: { 'x': { status: 'STATUS_SCHEDULED' } } };
  const r = computeLatestMatchTop([statEntry('Alice', 0, 0)], fixtures, results);
  assert.equal(r, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 6 new tests fail.

- [ ] **Step 3: Add implementation**

Append to `lib/leaderboardStats.js`:

```js
// "Most exact scores" callout: highest exact_score_count, names alpha-sorted.
// Format: "Alice (3 exact)" or "Alice, Bob and 2 others (2 exact)".
export function computeMostExact(entries) {
  if (!entries?.length) return { count: 0, names: [], label: '—' };
  let max = 0;
  for (const e of entries) {
    if (e.scoring.exact_score_count > max) max = e.scoring.exact_score_count;
  }
  const names = entries
    .filter((e) => e.scoring.exact_score_count === max)
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
  const head = names.slice(0, 2).join(', ');
  const rest = names.length > 2 ? ` and ${names.length - 2} others` : '';
  return { count: max, names, label: `${head}${rest} (${max} exact)` };
}

// "Lead" callout: leader's gap over runner-up, or N-way tie at top.
export function computeLeadStat(entries) {
  if (!entries?.length) return { label: '—' };
  const sorted = [...entries].sort((a, b) => b.scoring.total - a.scoring.total);
  const top = sorted[0].scoring.total;
  const topNames = sorted.filter((e) => e.scoring.total === top).map((e) => e.name);
  if (topNames.length > 1) {
    return { label: `${topNames.length}-way tie at ${top} pts` };
  }
  const second = sorted.find((e) => e.scoring.total < top);
  if (!second) return { label: `${sorted[0].name} (${top} pts)` };
  const gap = top - second.scoring.total;
  return { label: `${sorted[0].name} +${gap} over ${second.name}` };
}

// "Top on latest match" callout: highest match_points on the latest finished match.
// Ties broken alphabetically by name.
export function computeLatestMatchTop(entries, fixtures, results) {
  if (!entries?.length || !fixtures || !results) return null;
  let latestMid = null;
  let latestKick = '';
  for (const [mid, fx] of Object.entries(fixtures.matches)) {
    if (!isMatchFinal(results.matches?.[mid]?.status)) continue;
    if (fx.kickoff_iso > latestKick) {
      latestKick = fx.kickoff_iso;
      latestMid = mid;
    }
  }
  if (!latestMid) return null;
  const fx = fixtures.matches[latestMid];
  const r = results.matches[latestMid];
  let topName = null;
  let topPts = -1;
  for (const e of entries) {
    const pts = e.scoring.match_points?.[latestMid] ?? 0;
    if (pts > topPts) { topPts = pts; topName = e.name; }
    else if (pts === topPts && topName && e.name.localeCompare(topName) < 0) { topName = e.name; }
  }
  if (topName === null) return null;
  return {
    matchId: latestMid,
    matchLabel: `${fx.home} ${r.home_score}-${r.away_score} ${fx.away}`,
    name: topName,
    points: topPts,
    label: `${topName} +${topPts}`,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/leaderboardStats.js lib/leaderboardStats.test.js
git commit -m "feat(lib): add StatBand helpers (most exact, lead, latest-match top)"
```

---

### Task 4: Lift scoring to `App.jsx`, refactor `LeaderboardTable` to accept entries

**Files:**
- Modify: `src/leaderboard/App.jsx`
- Modify: `src/leaderboard/components/LeaderboardTable.jsx`

This is a refactor task — no behavior change. After this task, `LeaderboardTable` receives pre-scored, pre-sorted entries from App. The same `entries` array will be used by the new components in later tasks.

- [ ] **Step 1: Update `App.jsx` to compute `entries` and pass it down**

Modify `src/leaderboard/App.jsx`:

Add this import at the top (after the existing imports):

```js
import { scoreSubmission } from '../../lib/score.js';
```

Add this `useMemo` right after the existing `lastUpdated` `useMemo` (around line 83):

```js
const entries = useMemo(() => {
  if (!fixtures || !results || !submissions?.length) return [];
  const rows = submissions.map((sub) => ({
    ...sub,
    scoring: scoreSubmission(sub.picks, fixtures, results),
  }));
  rows.sort((a, b) => {
    if (b.scoring.total !== a.scoring.total) return b.scoring.total - a.scoring.total;
    if (b.scoring.exact_score_count !== a.scoring.exact_score_count) return b.scoring.exact_score_count - a.scoring.exact_score_count;
    return a.name.localeCompare(b.name);
  });
  return rows;
}, [fixtures, results, submissions]);
```

Find the `<LeaderboardTable ... />` JSX block (currently around line 116) and change its props from `submissions={submissions}` to `entries={entries}`:

```jsx
<LeaderboardTable
  fixtures={fixtures}
  results={results}
  entries={entries}
  onRowClick={setModalEntry}
/>
```

- [ ] **Step 2: Update `LeaderboardTable.jsx` to accept entries**

Replace the entire contents of `src/leaderboard/components/LeaderboardTable.jsx`:

```jsx
function InfoTip({ text }) {
  return (
    <span className="group/tip relative ml-1 inline-flex">
      <span
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-600 text-[9px] font-bold leading-none text-slate-400 group-hover/tip:border-emerald-400 group-hover/tip:text-emerald-400"
        aria-hidden="true"
      >
        i
      </span>
      <span className="pointer-events-none invisible absolute bottom-full right-0 z-20 mb-1.5 w-60 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-left text-xs font-normal normal-case text-slate-200 shadow-xl group-hover/tip:visible">
        {text}
      </span>
    </span>
  );
}

export function LeaderboardTable({ entries, onRowClick }) {
  if (!entries.length) return <p className="text-slate-400">No submissions to display yet.</p>;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-700 bg-slate-900 text-slate-300">
          <th className="px-3 py-2 text-left font-medium">Rank</th>
          <th className="px-3 py-2 text-left font-medium">Name</th>
          <th className="px-3 py-2 text-right font-medium">
            <span className="inline-flex items-center justify-end">
              Match pts
              <InfoTip text="Per-game predictions across the 72 group-stage matches. 3 pts for correct winner/draw, +3 bonus for exact score (6 max per match). Only counts matches that have a FINAL result." />
            </span>
          </th>
          <th className="px-3 py-2 text-right font-medium">
            <span className="inline-flex items-center justify-end">
              Group pts
              <InfoTip text="Standings predictions per group. 15/8/4 for correct 1st/2nd/3rd, +8 if you nail the entire 1–4 order. Only scores when all 6 matches in a group are FINAL." />
            </span>
          </th>
          <th className="px-3 py-2 text-right font-medium">
            <span className="inline-flex items-center justify-end">
              Total
              <InfoTip text="Match pts + Group pts. Ranks the leaderboard." />
            </span>
          </th>
          <th className="px-3 py-2 text-right font-medium">
            <span className="inline-flex items-center justify-end">
              Exact scores
              <InfoTip text="Tiebreaker. Count of matches where you nailed the exact final score." />
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => (
          <tr
            key={entry.email_hash}
            className="border-b border-slate-800 hover:bg-slate-900 cursor-pointer"
            onClick={() => onRowClick(entry)}
          >
            <td className="px-3 py-2 tabular-nums text-slate-400">{i + 1}</td>
            <td className="px-3 py-2 text-slate-100">{entry.name}</td>
            <td className="px-3 py-2 text-right tabular-nums text-slate-300">{entry.scoring.match_total}</td>
            <td className="px-3 py-2 text-right tabular-nums text-slate-300">{entry.scoring.group_total}</td>
            <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-300">{entry.scoring.total}</td>
            <td className="px-3 py-2 text-right tabular-nums text-slate-400">{entry.scoring.exact_score_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

(The `useMemo` and `useState` imports are gone — no longer needed. The `scoreSubmission` import is gone — scoring happens upstream.)

- [ ] **Step 3: Build to verify no syntax errors / broken imports**

Run: `npm run build`
Expected: build succeeds. Bundle sizes won't shift meaningfully.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 43 + 9 = 52 pass. No regressions.

- [ ] **Step 5: Commit**

```bash
git add src/leaderboard/App.jsx src/leaderboard/components/LeaderboardTable.jsx
git commit -m "refactor: lift leaderboard scoring to App; LeaderboardTable takes entries"
```

---

### Task 5: Create `MatchModal.jsx`

**Files:**
- Create: `src/leaderboard/components/MatchModal.jsx`

- [ ] **Step 1: Write the component**

Create `src/leaderboard/components/MatchModal.jsx`:

```jsx
import { useEffect, useMemo } from 'react';
import { teamFlag } from '../../shared/teamNames.js';
import { computeMatchSummary } from '../../../lib/leaderboardStats.js';

const OUTCOME_CLASSES = {
  exact: 'text-emerald-300',
  winner: 'text-sky-300',
  wrong: 'text-rose-400',
};

function classForPoints(pts) {
  if (pts >= 6) return OUTCOME_CLASSES.exact;
  if (pts === 3) return OUTCOME_CLASSES.winner;
  return OUTCOME_CLASSES.wrong;
}

export function MatchModal({ matchId, fixtures, results, entries, onClose, onSelectEntry }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    history.replaceState(null, '', `#match/${matchId}`);
    return () => {
      document.removeEventListener('keydown', onKey);
      history.replaceState(null, '', location.pathname + location.search);
    };
  }, [matchId, onClose]);

  const fx = fixtures.matches[matchId];
  const result = results.matches[matchId];
  const summary = useMemo(() => computeMatchSummary(matchId, entries), [matchId, entries]);

  const rows = useMemo(() => {
    return entries
      .map((e) => ({
        name: e.name,
        email_hash: e.email_hash,
        pick: e.picks.matches[matchId] || {},
        pts: e.scoring.match_points?.[matchId] ?? 0,
        entry: e,
      }))
      .sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        return a.name.localeCompare(b.name);
      });
  }, [matchId, entries]);

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-modal-title"
        className="w-full max-w-lg rounded-lg bg-slate-900 text-slate-100 ring-1 ring-slate-800 shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 id="match-modal-title" className="text-base font-semibold">
            {teamFlag(fx.home)} {fx.home} {result.home_score}–{result.away_score} {fx.away} {teamFlag(fx.away)}
            <span className="ml-2 text-xs font-normal text-slate-400">· Group {fx.group} · Final</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >×</button>
        </header>
        <div className="border-b border-slate-800 px-5 py-3 text-xs text-slate-300 space-y-1">
          <div>🎯 {summary.exactCount}/{summary.totalCount} nailed the exact score</div>
          <div>✅ {summary.winnerCount}/{summary.totalCount} picked the winner correctly</div>
          <div>Consensus: {summary.consensus ?? 'split — no consensus'}</div>
        </div>
        <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
          <ul className="space-y-1">
            {rows.map((r) => {
              const predictedStr = `${r.pick.home_score ?? '–'}-${r.pick.away_score ?? '–'}`;
              return (
                <li key={r.email_hash} className="flex items-center gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => onSelectEntry(r.entry)}
                    className="flex-1 truncate text-left text-slate-100 hover:text-emerald-300 hover:underline"
                  >
                    {r.name}
                  </button>
                  <span className={`font-mono ${classForPoints(r.pts)}`}>
                    {r.pts >= 6 && <span className="mr-1" aria-label="exact score">🎯</span>}
                    {predictedStr}
                  </span>
                  <span className="tabular-nums text-slate-400 w-8 text-right">{r.pts}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build succeeds. No errors.

- [ ] **Step 3: Commit**

```bash
git add src/leaderboard/components/MatchModal.jsx
git commit -m "feat: add MatchModal — per-match drilldown with summary + sorted picks"
```

---

### Task 6: Create `MatchStrip.jsx`

**Files:**
- Create: `src/leaderboard/components/MatchStrip.jsx`

- [ ] **Step 1: Write the component**

Create `src/leaderboard/components/MatchStrip.jsx`:

```jsx
import { partitionFinishedMatches } from '../../../lib/leaderboardStats.js';
import { teamFlag } from '../../shared/teamNames.js';

function chipLabel(fx, result) {
  return `${teamFlag(fx.home)} ${result.home_score}-${result.away_score} ${teamFlag(fx.away)}`;
}

function optionLabel(fx, result) {
  return `${fx.home} ${result.home_score}-${result.away_score} ${fx.away}`;
}

export function MatchStrip({ fixtures, results, onSelect }) {
  const { today, yesterday, older } = partitionFinishedMatches(fixtures, results, new Date());

  if (today.length + yesterday.length + older.length === 0) return null;

  function chips(mids) {
    return mids.map((mid) => {
      const fx = fixtures.matches[mid];
      const r = results.matches[mid];
      return (
        <button
          key={mid}
          type="button"
          onClick={() => onSelect(mid)}
          className="flex-shrink-0 rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-100 hover:bg-slate-700 whitespace-nowrap"
        >
          {chipLabel(fx, r)}
        </button>
      );
    });
  }

  // The picker covers only matches NOT in today/yesterday chips.
  const olderByGroup = {};
  for (const mid of older) {
    const fx = fixtures.matches[mid];
    const r = results.matches[mid];
    if (!olderByGroup[fx.group]) olderByGroup[fx.group] = [];
    olderByGroup[fx.group].push({ mid, label: optionLabel(fx, r) });
  }
  const olderGroupLetters = Object.keys(olderByGroup).sort();

  return (
    <div className="mb-4 space-y-2">
      {today.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Today</div>
          <div className="flex gap-2 overflow-x-auto">{chips(today)}</div>
        </div>
      )}
      {yesterday.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Yesterday</div>
          <div className="flex gap-2 overflow-x-auto">{chips(yesterday)}</div>
        </div>
      )}
      {older.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <label className="text-xs text-slate-500" htmlFor="match-picker">More:</label>
          <select
            id="match-picker"
            className="bg-slate-800 text-slate-100 text-sm rounded-md px-2 py-1 ring-1 ring-slate-700 hover:bg-slate-700"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onSelect(e.target.value);
                e.target.value = '';
              }
            }}
          >
            <option value="">All matches…</option>
            {olderGroupLetters.map((letter) => (
              <optgroup key={letter} label={`Group ${letter}`}>
                {olderByGroup[letter].map(({ mid, label }) => (
                  <option key={mid} value={mid}>{label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/leaderboard/components/MatchStrip.jsx
git commit -m "feat: add MatchStrip — chip strip with today/yesterday + older-match picker"
```

---

### Task 7: Wire `MatchStrip` + `MatchModal` into `App.jsx` with `#match/{id}` hash routing

**Files:**
- Modify: `src/leaderboard/App.jsx`

- [ ] **Step 1: Add imports and state**

In `src/leaderboard/App.jsx`, add to the existing imports:

```js
import { MatchStrip } from './components/MatchStrip.jsx';
import { MatchModal } from './components/MatchModal.jsx';
```

Add a new state hook below the existing `useState` calls in `App` (next to `const [modalEntry, setModalEntry] = useState(null);`):

```js
const [modalMatchId, setModalMatchId] = useState(null);
```

- [ ] **Step 2: Add `#match/{id}` hash routing**

Add a new `useEffect` right after the existing `useDeepLink(...)` call:

```js
useEffect(() => {
  if (!fixtures || !results) return;
  const m = /^#match\/(\d+)$/.exec(location.hash);
  if (m && fixtures.matches[m[1]]) {
    setModalMatchId(m[1]);
  }
}, [fixtures, results]);
```

This runs once on initial load when the data lands. It only triggers if the hash matches `#match/{numeric-id}` AND the fixtures contain that id.

- [ ] **Step 3: Render `MatchStrip` and `MatchModal`**

Inside the `<main>` element, render `MatchStrip` between `PotBar` and the locked-vs-leaderboard conditional. Replace this block:

```jsx
<main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
  <PotBar appsScriptUrl={config.apps_script_url} buyIn={config.buy_in_usd} />
  {!locked ? (
```

With this:

```jsx
<main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
  <PotBar appsScriptUrl={config.apps_script_url} buyIn={config.buy_in_usd} />
  {locked && <MatchStrip fixtures={fixtures} results={results} onSelect={setModalMatchId} />}
  {!locked ? (
```

At the bottom of the returned JSX, add `MatchModal` near the existing `PickModal` render (the conditional rendering for `modalEntry`):

```jsx
{modalEntry && (
  <PickModal entry={modalEntry} fixtures={fixtures} results={results} onClose={() => setModalEntry(null)} />
)}
{modalMatchId && (
  <MatchModal
    matchId={modalMatchId}
    fixtures={fixtures}
    results={results}
    entries={entries}
    onClose={() => setModalMatchId(null)}
    onSelectEntry={(entry) => { setModalMatchId(null); setModalEntry(entry); }}
  />
)}
{rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
```

The `onSelectEntry` handler closes the MatchModal and opens the PickModal — one-way cross-link as per the spec.

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all tests still pass (this task only touches App.jsx; lib tests are unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/leaderboard/App.jsx
git commit -m "feat: wire MatchStrip + MatchModal in leaderboard App with #match/{id} hash"
```

---

### Task 8: Create `StatBand.jsx` and wire in `App.jsx`

**Files:**
- Create: `src/leaderboard/components/StatBand.jsx`
- Modify: `src/leaderboard/App.jsx`

- [ ] **Step 1: Write the component**

Create `src/leaderboard/components/StatBand.jsx`:

```jsx
import { computeMostExact, computeLeadStat, computeLatestMatchTop } from '../../../lib/leaderboardStats.js';

export function StatBand({ entries, fixtures, results }) {
  if (!entries?.length) return null;
  const latest = computeLatestMatchTop(entries, fixtures, results);
  if (!latest) return null;
  const mostExact = computeMostExact(entries);
  const lead = computeLeadStat(entries);

  return (
    <div className="mb-4 rounded-md bg-slate-900 ring-1 ring-slate-800 px-4 py-3 text-sm text-slate-200">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>🎯 Most exact: <span className="font-semibold">{mostExact.label}</span></span>
        <span className="text-slate-600">·</span>
        <span>🥇 Lead: <span className="font-semibold">{lead.label}</span></span>
        <span className="text-slate-600">·</span>
        <span>📈 Top on {latest.matchLabel}: <span className="font-semibold">{latest.label}</span></span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `App.jsx`**

In `src/leaderboard/App.jsx`, add to the existing imports:

```js
import { StatBand } from './components/StatBand.jsx';
```

Render `StatBand` between `MatchStrip` and the locked-vs-leaderboard conditional. Find this block (after Task 7's edits):

```jsx
<PotBar appsScriptUrl={config.apps_script_url} buyIn={config.buy_in_usd} />
{locked && <MatchStrip fixtures={fixtures} results={results} onSelect={setModalMatchId} />}
{!locked ? (
```

Change to:

```jsx
<PotBar appsScriptUrl={config.apps_script_url} buyIn={config.buy_in_usd} />
{locked && <MatchStrip fixtures={fixtures} results={results} onSelect={setModalMatchId} />}
{locked && <StatBand entries={entries} fixtures={fixtures} results={results} />}
{!locked ? (
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/leaderboard/components/StatBand.jsx src/leaderboard/App.jsx
git commit -m "feat: add StatBand — 3 narrative callouts above the leaderboard"
```

---

### Task 9: Manual dev-server verification

**Files:** None (verification only). After this task hands off to the user for manual testing before any push.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Vite starts; note the URL (likely `http://localhost:5173/` or next available port).

- [ ] **Step 2: Verify happy path on leaderboard**

Open: `http://localhost:PORT/leaderboard.html`

Verify:
- MatchStrip renders above the leaderboard table with chips under "Today" / "Yesterday" headers.
- StatBand renders below MatchStrip with the 3 callouts (🎯 Most exact, 🥇 Lead, 📈 Top on …).
- Leaderboard table still renders correctly (same columns, same data).

- [ ] **Step 3: Verify MatchModal open/close**

Click a chip in MatchStrip:
- Modal opens with header `🇲🇽 MEX 2–0 RSA · Group A · Final` (or similar).
- Summary band shows three lines (exact / winner / consensus).
- Sorted list shows ~24 rows.
- Clicking outside the modal closes it.
- Pressing Escape closes it.
- Clicking the × button closes it.
- URL hash updates to `#match/{matchId}` when open; clears when closed.

- [ ] **Step 4: Verify the picker (only if older matches exist)**

If "More" picker appears: choose a Group A match from the dropdown:
- Same MatchModal opens.
- Dropdown value resets to empty after selection.

If no older matches yet (Day 1/2 of tournament), this step is a no-op — picker is hidden by design.

- [ ] **Step 5: Verify cross-link to PickModal**

Inside an open MatchModal, click an entrant's name:
- MatchModal closes.
- PickModal opens for that entrant.
- URL hash updates to `#picks/{email_hash}`.

- [ ] **Step 6: Verify mock-data path still works**

Open: `http://localhost:PORT/leaderboard.html?mockLeaderboard=1`

Verify:
- Strip + StatBand + table all render with mock data.
- No console errors.

- [ ] **Step 7: Verify shareable `#match/{id}` URL works on cold load**

Reload the page directly to: `http://localhost:PORT/leaderboard.html#match/760415`
- Page loads.
- MatchModal opens automatically once data loads.

- [ ] **Step 8: Stop dev server**

Stop the Vite process when satisfied.

- [ ] **Step 9: Hand off to user for push approval**

Report which tasks landed cleanly and which (if any) required tweaks. **Do not push.** The user explicitly wants to manually validate before any push happens.
