# Stats Page — Phase 1.5 Implementation Plan (interactive Gap + consensus superlatives)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. UI tasks marked **[LIVE]** get a dev-server review checkpoint with the human before proceeding.

**Goal:** Rebuild The Gap as an interactive visx chart (highlight / phase bands / dots / zoom / play) and swap the time-bound superlatives for consensus-based ones (Hipster, Chalk-Eater).

**Architecture:** Pure logic in tested `lib/` helpers (`lib/phases.js`, `lib/consensus.js`); The Gap becomes a bespoke visx+d3 component tree under `src/stats/gap/`; Superlatives consumes the new consensus lib. Nivo stays for Live Ceiling.

**Tech Stack:** React 19, Vite 6, Tailwind v4, visx v4 (`@visx/scale`, `@visx/shape`, `@visx/axis`, `@visx/group`, `@visx/zoom`), d3-scale/d3-shape, Nivo 0.99 (Ceiling only), Node `node:test`.

## Global Constraints

- **Reuse existing pure logic; never duplicate scoring or point literals.** Consensus/phase helpers derive from `scoreSubmission`/`deriveWinner`/`resolveActualBracket` and the data files — no re-implemented scoring.
- **Node ESM.** `import`, not `require`. `npm test` globs `lib/*.test.js scripts/*.test.mjs` (already widened) — new lib tests must match `lib/*.test.js`.
- **Data shapes (verbatim):**
  - `history.json`: `{ snapshots: [{ t: ISO, standings: [{ email_hash, name, groupTotal, bracketTotal, total }] }] }`.
  - submissions row: `{ email_hash, name, phase:'group'|'knockout', picks }`; group `picks={matches:{[id]:{home_score,away_score}}, group_standings:{[L]:[codes]}}`; knockout `picks={bracket:{[slot]:{advances,home,away,home_score,away_score}}}`.
  - `results.json`: `{ matches: {[id]:{home_score,away_score,status,advances?}} }`.
  - `knockout.json`: `{ rounds:{R32:[{slot,home,away,match_id,kickoff_iso,feeds}], R16|QF|SF|F:[{slot,from|feeds,match_id,kickoff_iso}] } }` — **R32 slots carry `kickoff_iso`; all rounds carry `kickoff_iso`**.
  - `odds.json`: `{ matches: {[id]:{home_implied,draw_implied,away_implied,bookmaker_count}} }` (72 group matches).
- **visx v4** peer-deps `react ^18||^19` (verified). Charts lazy-loaded.
- **Graceful degrade:** any missing optional file (`odds.json`, `history.json`, `knockout.json`) → the dependent award/feature is omitted, never a crash.
- **Privacy:** unchanged — `email_hash` + display name only, as the leaderboard already exposes.

## File Structure

- `lib/phases.js` + `.test.js` — `phaseBoundaries(knockout)`.
- `lib/consensus.js` + `.test.js` — `pickConsensus`, `contrarianCorrect`, `chalkScore`.
- `src/stats/gap/GapPanel.jsx` — composition + shared UI state.
- `src/stats/gap/GapChart.jsx` — visx SVG (scales, LinePaths, axes, crosshair tooltip).
- `src/stats/gap/GapLegend.jsx` — name list; hover-spotlight / click-pin.
- `src/stats/gap/PhaseBands.jsx` — background phase regions.
- `src/stats/gap/PlayControls.jsx` — play/pause + scrubber.
- `src/stats/gap/usePlayback.js` — playback index state machine.
- `src/stats/gap/useGapZoom.js` — zoom transform → visible domains.
- `src/stats/gap/series.js` — `toSeries(history)` + `leaderEmail(history)` (ported from Phase-1 TheGap).
- Delete: `src/stats/components/TheGap.jsx` (replaced by `gap/`).
- Modify: `src/stats/App.jsx` (import `GapPanel` instead of `TheGap`), `src/stats/components/Superlatives.jsx`, `package.json` (deps).

---

## Task 1: Install visx + d3 deps

**Files:** Modify `package.json`.

- [ ] **Step 1:** `npm install @visx/scale@4 @visx/shape@4 @visx/axis@4 @visx/group@4 @visx/zoom@4 d3-scale d3-shape d3-time-format`
- [ ] **Step 2:** `npm run build` — succeeds, no peer-dep errors.
- [ ] **Step 3:** Commit: `git commit -am "chore(stats): add visx + d3 deps for interactive Gap"`

---

## Task 2: `lib/phases.js` — phase boundary timestamps

**Files:** Create `lib/phases.js`, `lib/phases.test.js`.

**Interfaces:**
- Produces `phaseBoundaries(knockout) -> [{ round: 'R32'|'R16'|'QF'|'SF'|'F', start: ISO }]` where `start` is the **earliest `kickoff_iso`** among that round's slots. Rounds with no slots or no kickoffs are omitted. Sorted ascending by `start`.

- [ ] **Step 1: Failing test**
```js
// lib/phases.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phaseBoundaries } from './phases.js';

const knockout = { rounds: {
  R32: [ { slot:'R32-1', kickoff_iso:'2026-06-29T20:30:00Z' }, { slot:'R32-2', kickoff_iso:'2026-06-28T19:00:00Z' } ],
  R16: [ { slot:'R16-1', kickoff_iso:'2026-07-03T19:00:00Z' } ],
  QF: [], SF: [], F: [ { slot:'F-1', kickoff_iso:'2026-07-19T19:00:00Z' } ],
} };

test('phaseBoundaries returns earliest kickoff per non-empty round, sorted', () => {
  const b = phaseBoundaries(knockout);
  assert.deepEqual(b.map(x=>x.round), ['R32','R16','F']);
  assert.equal(b[0].start, '2026-06-28T19:00:00Z'); // earliest of the two R32 slots
});

test('phaseBoundaries omits rounds with no kickoff data and tolerates missing rounds', () => {
  assert.deepEqual(phaseBoundaries({ rounds: {} }), []);
});
```
- [ ] **Step 2:** `node --test lib/phases.test.js` → FAIL (undefined).
- [ ] **Step 3: Implement**
```js
// lib/phases.js
// Phase-band boundaries for the stats "Gap" chart: the earliest kickoff of each
// knockout round, derived from knockout.json (slots carry kickoff_iso).
const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'F'];

export function phaseBoundaries(knockout) {
  const out = [];
  for (const round of ROUND_ORDER) {
    const slots = knockout?.rounds?.[round] || [];
    const kicks = slots.map((s) => s.kickoff_iso).filter(Boolean).sort();
    if (kicks.length) out.push({ round, start: kicks[0] });
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}
```
- [ ] **Step 4:** `node --test lib/phases.test.js` → PASS (2).
- [ ] **Step 5:** `npm test` → all pass.
- [ ] **Step 6:** Commit: `git commit -am "feat(lib): phases — knockout round boundary timestamps"`

---

## Task 3: `lib/consensus.js` — consensus, contrarian, chalk

**Files:** Create `lib/consensus.js`, `lib/consensus.test.js`.

**Interfaces:**
- `pickConsensus(submissions, fixtures) -> Map<matchId, { home:number, draw:number, away:number, modal:'home'|'draw'|'away', share:number }>` — over group-phase submissions only, tallies predicted outcome per match (via `deriveWinner(pick.home_score, pick.away_score)`), returns counts, the modal outcome, and its share of total picks for that match.
- `contrarianCorrect(sub, fixtures, results, consensus, threshold=0.34) -> number` — count of the group submission's predictions that are (a) correct (predicted winner === actual winner on a final match) AND (b) low-consensus (the entrant's predicted outcome had share < threshold). Powers Hipster.
- `chalkScore(sub, fixtures, odds) -> number` — count of group matches where the entrant's predicted winner equals the odds favorite (argmax of `home_implied/draw_implied/away_implied`; favorite outcome maps 'home'|'draw'|'away'). Powers Chalk-Eater.

Consumes `deriveWinner` from `lib/derive.js` and `isMatchFinal` from `lib/status.js`.

- [ ] **Step 1: Failing test**
```js
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
```
- [ ] **Step 2:** `node --test lib/consensus.test.js` → FAIL.
- [ ] **Step 3: Implement**
```js
// lib/consensus.js
// Pool-consensus analytics for the stats "Superlatives": how much the field
// agreed on each match, who was rewarded for correct low-consensus calls
// (Hipster), and who most backed the bookmakers' favorite (Chalk-Eater).
import { deriveWinner } from './derive.js';
import { isMatchFinal } from './status.js';

function predictedOutcome(pick) {
  return deriveWinner(pick.home_score, pick.away_score); // 'home'|'away'|'draw'
}

export function pickConsensus(submissions, fixtures) {
  const tally = new Map();
  for (const sub of submissions) {
    if (sub.phase === 'knockout') continue;
    for (const [mid, pick] of Object.entries(sub.picks?.matches || {})) {
      if (!fixtures?.matches?.[mid]) continue;
      const o = predictedOutcome(pick);
      const t = tally.get(mid) || { home: 0, draw: 0, away: 0 };
      t[o] += 1;
      tally.set(mid, t);
    }
  }
  const out = new Map();
  for (const [mid, t] of tally) {
    const total = t.home + t.draw + t.away;
    const modal = ['home', 'draw', 'away'].reduce((a, b) => (t[b] > t[a] ? b : a), 'home');
    out.set(mid, { ...t, modal, share: total ? t[modal] / total : 0 });
  }
  return out;
}

export function contrarianCorrect(sub, fixtures, results, consensus, threshold = 0.34) {
  if (sub.phase === 'knockout') return 0;
  let n = 0;
  for (const [mid, pick] of Object.entries(sub.picks?.matches || {})) {
    const r = results?.matches?.[mid];
    if (!r || !isMatchFinal(r.status)) continue;
    const predicted = predictedOutcome(pick);
    const actual = deriveWinner(r.home_score, r.away_score);
    if (predicted !== actual) continue; // must be correct
    const c = consensus.get(mid);
    if (!c) continue;
    const total = c.home + c.draw + c.away;
    const share = total ? c[predicted] / total : 0;
    if (share < threshold) n += 1; // correct AND low-consensus
  }
  return n;
}

export function chalkScore(sub, fixtures, odds) {
  if (sub.phase === 'knockout') return 0;
  let n = 0;
  for (const [mid, pick] of Object.entries(sub.picks?.matches || {})) {
    const o = odds?.matches?.[mid];
    if (!o) continue;
    const fav = ['home', 'draw', 'away'].reduce(
      (a, b) => (o[`${b}_implied`] > o[`${a}_implied`] ? b : a), 'home');
    if (predictedOutcome(pick) === fav) n += 1;
  }
  return n;
}
```
- [ ] **Step 4:** `node --test lib/consensus.test.js` → PASS (3).
- [ ] **Step 5:** `npm test` → all pass.
- [ ] **Step 6:** Commit: `git commit -am "feat(lib): consensus — pool agreement, contrarian-correct, chalk score"`

---

## Task 4: Superlatives — swap Riser/Faller for Hipster + Chalk-Eater

**Files:** Modify `src/stats/components/Superlatives.jsx`.

**Interfaces:** Awards become Most 🎯 Exact (kept), Live Longshot (kept), **Hipster** (max `contrarianCorrect` over group subs, > 0), **Chalk-Eater** (max `chalkScore`, > 0). Component now also takes `odds` prop; App passes `odds={data.odds}` (add `odds` to `useStatsData` if not already returned — it fetches `/odds.json` optionally, degrade to null).

- [ ] **Step 1:** Ensure `useStatsData` fetches `/odds.json` (optional, null on miss) and returns it. If already returned, skip.
- [ ] **Step 2:** In `Superlatives.jsx`, remove the Riser/Faller block (the `rankMovements` usage). Import `pickConsensus, contrarianCorrect, chalkScore` from `../../../lib/consensus.js`. In `computeAwards`, when `submissions`+`fixtures`+`results` present, compute `const consensus = pickConsensus(submissions, fixtures);` then pick the max-`contrarianCorrect` entrant (>0) → Hipster card (`detail: `${n} rare correct calls``). When `odds` present, pick max-`chalkScore` (>0) → Chalk-Eater card (`detail: `${n} favorites backed``). Keep Most Exact + Live Longshot exactly as-is. `rankMovements`/`history` no longer needed for awards (remove the import if now unused).
- [ ] **Step 3:** `npm run build` succeeds. **[LIVE]** refresh `/stats.html` — confirm four cards: Most Exact, Live Longshot, Hipster, Chalk-Eater, with real names; `?mockStats=1` degrades (no odds → no Chalk-Eater) without crashing.
- [ ] **Step 4:** Commit: `git commit -am "feat(stats): Superlatives — swap Riser/Faller for Hipster + Chalk-Eater"`

---

## Task 5: The Gap — visx base render **[LIVE]**

**Files:** Create `src/stats/gap/series.js`, `GapChart.jsx`, `GapPanel.jsx`; modify `src/stats/App.jsx`; delete `src/stats/components/TheGap.jsx`.

**Interfaces:**
- `series.js`: `toSeries(history) -> [{ email_hash, name, data:[{x:Date,y:number}] }]` (guard non-array snapshots → `[]`), `leaderEmail(history) -> email_hash|null` (final-snapshot top total).
- `GapChart.jsx`: props `{ series, leader, width, height, xDomain, yDomain, hovered, pinned }` — renders visx `Group`, `AxisBottom`(time)/`AxisLeft`, one `<LinePath>` per series (d3 `scaleTime`/`scaleLinear`), default stroke faint slate `#334155`, leader `#fbbf24`; spotlighted (hovered or in `pinned`) lines get a bright stroke + full opacity while non-spotlighted dim to `#1e293b` when any spotlight is active. Crosshair + tied-bucket tooltip on mouse-move over the plot (nearest snapshot; dark, `min-width:200px`, bucket by equal total).
- `GapPanel.jsx`: responsive width (ResizeObserver or a simple `useParentWidth`), holds `hovered`/`pinned` state, renders `GapChart`. (Legend/phases/zoom/play added in later tasks — keep the composition seam ready.)

- [ ] **Step 1:** Implement `series.js` (port `toSeries`/`leaderEmail` from the old `TheGap.jsx`, keeping the `Array.isArray` guard and Date conversion).
- [ ] **Step 2:** Implement `GapChart.jsx` with visx scales + LinePaths + axes + crosshair tied-bucket tooltip (dark, min-width). Full x/y domain by default (`xDomain`/`yDomain` derived from series if not provided).
- [ ] **Step 3:** Implement `GapPanel.jsx` (width measure + state stubs for hovered/pinned) rendering `GapChart`.
- [ ] **Step 4:** In `App.jsx`, replace the `TheGap` lazy import/render with `GapPanel` (`lazy(() => import('./gap/GapPanel.jsx').then(m => ({ default: m.GapPanel })))`), passing `history={data.history}`. Keep hook ordering (all hooks before early returns). Delete `src/stats/components/TheGap.jsx`.
- [ ] **Step 5:** `npm run build` succeeds; chart chunk still splits. **[LIVE]** refresh `/stats.html` — confirm all 24 lines render on a time axis, leader gold, crosshair tooltip buckets ties and no longer wraps. **Get human sign-off on the base before layering interactions.**
- [ ] **Step 6:** Commit: `git commit -am "feat(stats): rebuild The Gap base on visx (scales, lines, crosshair tooltip)"`

---

## Task 6: Legend highlighting + dots **[LIVE]**

**Files:** Create `src/stats/gap/GapLegend.jsx`; modify `GapPanel.jsx`, `GapChart.jsx`.

**Interfaces:** `GapLegend` props `{ series, hovered, pinned, onHover, onTogglePin }` — a scrollable name list sorted by current total; hovering a row calls `onHover(email_hash)`, leaving calls `onHover(null)`; clicking calls `onTogglePin(email_hash)`. `GapPanel` owns `hovered` + `pinned:Set` and passes them to both `GapChart` (for spotlight styling) and `GapLegend` (for active styling). `GapChart` draws snapshot **dots** only on spotlighted/pinned lines.

- [ ] **Step 1:** `GapLegend.jsx` (name list, hover + click handlers, active-state styling mirroring line colors).
- [ ] **Step 2:** `GapPanel.jsx`: add `hovered` state + `pinned` Set + `onTogglePin`; lay out chart + legend (legend right/below on mobile).
- [ ] **Step 3:** `GapChart.jsx`: draw dots on spotlighted/pinned lines; ensure spotlight styling reads from `hovered`/`pinned`.
- [ ] **Step 4:** `npm run build`. **[LIVE]** refresh — hover a name spotlights its line + dots, others dim; clicking pins multiple for comparison. Confirm readable.
- [ ] **Step 5:** Commit: `git commit -am "feat(stats): Gap legend hover-spotlight + click-pin + dots on active lines"`

---

## Task 7: Phase bands **[LIVE]**

**Files:** Create `src/stats/gap/PhaseBands.jsx`; modify `GapPanel.jsx`/`GapChart.jsx` to render bands behind the lines.

**Interfaces:** `PhaseBands` props `{ boundaries, xScale, innerHeight }` — from `phaseBoundaries(knockout)` (Task 2), draws a labeled shaded `<rect>` per phase segment (Group→R32→…→Final) behind the lines, alternating subtle fills. `GapPanel` computes boundaries from `knockout` and passes them down; group band starts at the first snapshot x.

- [ ] **Step 1:** `PhaseBands.jsx` renders the rects + small round labels.
- [ ] **Step 2:** Wire into `GapChart` as the first (back) layer; pass `knockout` through `GapPanel`.
- [ ] **Step 3:** `npm run build`. **[LIVE]** refresh — confirm phase regions read clearly behind the lines and align with when rounds started.
- [ ] **Step 4:** Commit: `git commit -am "feat(stats): Gap phase bands from knockout kickoff boundaries"`

---

## Task 8: Zoom **[LIVE]**

**Files:** Create `src/stats/gap/useGapZoom.js`; modify `GapPanel.jsx`/`GapChart.jsx`; add a Reset button.

**Interfaces:** `useGapZoom` wraps `@visx/zoom` to produce visible `xDomain`/`yDomain` from the zoom transform applied to the full-data domains; exposes `{ xDomain, yDomain, containerProps, reset, isZoomed }`. Drag = pan, scroll/pinch = zoom (both axes). `GapPanel` feeds the derived domains into `GapChart`. Zoom is disabled while playback runs (Task 9).

- [ ] **Step 1:** `useGapZoom.js` (transform → domains; clamp to data extent).
- [ ] **Step 2:** Wire zoom container + Reset button into `GapPanel`; pass domains to `GapChart`.
- [ ] **Step 3:** `npm run build`. **[LIVE]** refresh — drag-pan and scroll-zoom into a date/point range on both axes; Reset restores full view.
- [ ] **Step 4:** Commit: `git commit -am "feat(stats): Gap bidirectional zoom + reset"`

---

## Task 9: Play / animate mode **[LIVE]**

**Files:** Create `src/stats/gap/usePlayback.js`, `PlayControls.jsx`; modify `GapPanel.jsx`.

**Interfaces:** `usePlayback(snapshotCount) -> { index, playing, play, pause, toggle, seek, reset }` — a `requestAnimationFrame`/interval stepper advancing `index` 0→count-1 while playing, then stops. `PlayControls` renders play/pause + a scrubber bound to `seek`. `GapPanel`: when `playing` or `index < count-1`, slice each series to `data[0..index]`, and derive `xDomain`/`yDomain` from that slice so the view auto-zooms-out as the reveal grows; manual zoom is suspended while playing. Dots/spotlight still apply to the revealed slice.

- [ ] **Step 1:** `usePlayback.js` (rAF stepper + seek/reset; cleanup on unmount).
- [ ] **Step 2:** `PlayControls.jsx` (play/pause button + range scrubber).
- [ ] **Step 3:** `GapPanel.jsx`: integrate playback — slice series to `index`, compute slice domains, inhibit `useGapZoom` while playing, wire controls.
- [ ] **Step 4:** `npm run build`. **[LIVE]** refresh — press play: lines grow snapshot-by-snapshot, ranks cross, axes auto-zoom-out; pause/scrub works; on finish the full interactive chart (zoom re-enabled) remains.
- [ ] **Step 5:** Commit: `git commit -am "feat(stats): Gap play/animate mode with cumulative reveal + auto-zoom"`

---

## Self-Review notes

- Spec coverage: visx decision → Task 1,5; phase bands → Task 2,7; consensus superlatives → Task 3,4; highlighting/dots → Task 6; zoom → Task 8; play → Task 9. Ceiling readability fixes already committed (dc6f803, a3b57f2, + label-drop) outside this plan.
- No duplicated scoring: consensus/phases derive from `deriveWinner`/`isMatchFinal`/data files only.
- The visx UI tasks (5–9) each end with a **[LIVE]** dev-server checkpoint because interaction/animation correctness is not provable by `npm run build` alone; Task 5 explicitly gates human sign-off on the base render before interactions are layered.
- `TheGap.jsx` deletion (Task 5) — confirm no other importer via grep before removing.
