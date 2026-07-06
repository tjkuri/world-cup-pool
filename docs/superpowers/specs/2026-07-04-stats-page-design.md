# World Cup Pool — Stats Page Design

Date: 2026-07-04
Status: Approved (brainstorming) → ready for implementation plan

## Overview

A new, standalone **Stats page** for the pool: a "for fun" set of data
visualizations and superlatives derived entirely from data we already have —
the 24 locked brackets, `public/results.json`, the 118 git snapshots of that
results file, and cached Vegas odds. No backend changes; no new runtime
dependencies on Apps Script beyond what the leaderboard already does.

The page is a nerd-bait companion to the leaderboard: where the leaderboard
answers "who's winning," the stats page answers "how did we get here, who
agreed with whom, and what were the fun outliers."

### Goals

- A distinctive, self-contained `stats.html` page linked from the leaderboard.
- A hero **rank/points-over-time** visualization ("The Gap") reconstructed from
  git history.
- A spread of fun breakdowns: pick distributions, bracket build-up, superlatives.
- All charts powered by **Nivo** (React-native, D3-under-the-hood).
- Ship in two phases so the time-sensitive charts go live while the tournament
  is still running.

### Non-goals (YAGNI)

- No new persisted backend state or Apps Script endpoints. History is
  reconstructed from git at build time, not stored live.
- No per-user auth / "log in to see your line." Everyone sees everything
  (same privacy posture as the post-lock leaderboard).
- No real-time streaming. The page is as fresh as the last `history.json` build
  + the client's live `results.json` fetch.
- Not rebuilding the leaderboard or bracket views — this is additive.

## Chosen approach

- **Charting backbone: Nivo `0.99`** (peer-deps `react ^19` — verified compatible
  with our React 19 / Vite 6 stack). Packages: `@nivo/core`, `@nivo/line`,
  `@nivo/heatmap`, `@nivo/bar`, `@nivo/sankey`, `@nivo/network`,
  `@nivo/scatterplot`. Rationale: it covers all seven chosen charts out of the
  box with the D3 idioms we want (slice tooltips, voronoi hover, force layout,
  enter animations, color scales) already wired — fastest path to "fancy" for a
  ship-fast, vibe-coded project. Bespoke behavior (e.g. The Gap's tied-bucket
  tooltip) is handled via Nivo's custom render-prop slots, not by dropping to
  raw D3.
- **Visual identity: deferred to the `frontend-design` skill at implementation
  time.** This spec fixes the *information architecture* (which charts, what
  they show, layout order); palette/typography/"non-templated look" is a
  build-time pass with `frontend-design`, not decided here.

## Architecture

### Page & routing

- New Vite multi-page entry `stats.html` + `src/stats/` (mirrors the existing
  `bracket.html` / `leaderboard.html` structure). Add to `vite.config.js`
  rollup input.
- `src/stats/main.jsx` + `App.jsx`: fetches `config.json`, `results.json`,
  `knockout.json`, `history.json`, `odds.json`, and the locked submissions
  (same `?action=submissions` call the leaderboard uses). Graceful-degrades if
  any optional file is missing.
- Nav link added to the leaderboard `TopBar` (and reciprocal link back).
- **Each chart is a self-contained component, lazy-loaded** (`React.lazy` +
  `IntersectionObserver` / suspense on scroll) so Nivo's weight doesn't bloat
  first paint. One chart = one file under `src/stats/components/`.

### Data pipeline (the only real new infra)

`scripts/build-history.mjs` (Node, run manually now; optionally wired into the
cron later):

1. `git log --format=... -- public/results.json` → ordered list of
   `{ sha, committed_iso }` for all ~118 snapshots.
2. For each sha, `git show <sha>:public/results.json` → parse the historical
   results blob.
3. Fetch the locked submissions **once** (Apps Script `?action=submissions`, or
   a saved TSV/JSON snapshot for reproducibility) and the static `fixtures.json`
   / `knockout.json`.
4. For each snapshot, for each entrant, replay
   `scoreSubmission(picks, fixtures, resultsAtSha)` +
   `scoreBracket(bracket, knockout, resultsAtSha)` → per-entrant
   `{ groupTotal, bracketTotal, total }`.
5. Emit compact **`public/history.json`**:
   ```
   {
     built_at: ISO,
     snapshots: [
       { t: ISO, standings: [ { email_hash, name, groupTotal, bracketTotal, total } ] },
       ...
     ]
   }
   ```

Deterministic because picks are locked — the same git history + same picks
always produces the same `history.json`. This reuses the existing pure scoring
functions verbatim; no scoring logic is duplicated.

### New pure lib helpers (tested with `node --test`, matching the existing suite)

- `lib/ceiling.js` — `maxReachablePoints(entry, knockout, results)`: given an
  entrant's current score and which of their still-alive picks can still cash,
  returns `{ current, ceiling }`. Powers Live Ceiling.
- `lib/consensus.js` — pick-agreement %, per-pick pool distribution, contrarian
  score (how far a pick is from consensus), and the superlative computations
  (biggest riser, hipster, most exact, live longshot, chalk-eater). Powers
  Superlatives + Contrarian scatter + the Consensus overlays on Sankey.
- Scoreline and exact-count distributions reuse existing group-pick parsing
  (no new lib needed beyond a small helper in `consensus.js` or a dedicated
  `lib/distributions.js` if it grows).

## The charts (seven charts + one superlatives band)

Ordered by the final page layout (see below). Item 2 (Superlatives) is a card
band, not a chart; the seven charts are items 1, 3, 4, 5, 6, 7, 8.

1. **The Gap (hero)** — `@nivo/line`. Cumulative total points per entrant over
   time (X = snapshot time, Y = points; every line climbs). All 24 lines fan
   upward and cross on lead changes. Current leader highlighted gold; others
   dimmed until hover/name-search spotlights a line. **Tied-bucket hover:**
   Nivo `enableSlices="x"` with a custom slice tooltip that buckets entrants by
   exact score at that moment ("214 — tied: Saky · Manuel"). Phase dividers
   (R32/R16/QF/SF/Final) as reference lines. Source: `history.json`.

2. **Superlatives band** — plain React cards (no chart lib). A snackable row of
   awards: Biggest Riser (largest rank climb over the tournament, from
   `history.json`), The Hipster (most correct low-consensus picks), Most 🎯
   Exact (group exact-score count), Live Longshot (lowest-consensus champion
   pick still alive), Chalk-Eater (most favorites-per-odds picked). Source:
   `consensus.js` + `history.json` + `odds.json`.

3. **Live Ceiling** — `@nivo/bar` (or custom range bars). Per entrant: current
   points (marker) → max reachable points (bar end) given who's still alive in
   their bracket. Sorted by ceiling; entrants who can no longer catch the
   current leader visually greyed. **Time-sensitive — only meaningful while the
   tournament is live.** Source: `ceiling.js`.

4. **Champion / Advancement Flow** — `@nivo/sankey`. Ribbons of how many
   brackets routed each team through R16 → QF → SF → Final → 🏆. Ribbon width =
   consensus. Source: brackets + `consensus.js`.

5. **Bracket Twins** — `@nivo/network` (d3-force). Nodes = entrants, edges link
   the most pick-similar pairs; contrarians float to the edges. Hover a node to
   highlight its nearest twins. Source: `consensus.js` similarity matrix.

6. **Scoreline Distribution Heatmap** — `@nivo/heatmap`. Home-goals × away-goals
   grid of every group-stage scoreline prediction; cell intensity = how often
   the pool picked it. Actual results marked 🎯. (Friend-requested.) Group stage
   only. Source: group picks.

7. **Exact-Score Count Histogram** — `@nivo/bar`. Distribution across the 24
   entrants of "how many group-stage exact scores did you nail" — the bell curve
   of exact-hit volume. Group stage only. Source: group picks + results.

8. **Contrarian Payoff scatter** — `@nivo/scatterplot`. X = pick boldness
   (distance from consensus), Y = points earned. Voronoi hover for the small
   dots. Shows whether contrarianism paid off. Source: `consensus.js`.

## Layout & ordering

Single scrollable page, ordered by **timeliness** (live-decaying value up top,
evergreen retrospective below):

1. Hero: **The Gap** (full width)
2. **Superlatives** band (quick dopamine)
3. **Live Ceiling** (full width — now-or-never)
4. **Retrospective grid** (2-col, collapses to 1 on mobile): Champion Sankey,
   Bracket Twins, Scoreline Heatmap, Exact-count Histogram, Contrarian scatter.

## Phasing

- **Phase 1 — the live trio (ship ASAP while the tournament runs):**
  data pipeline (`build-history.mjs` + `history.json`), **The Gap**,
  **Live Ceiling** (`lib/ceiling.js`), **Superlatives band** (`lib/consensus.js`
  core). Rationale: The Gap grows richer over time and Live Ceiling is
  genuinely now-or-never (meaningless after the final). Shippable on its own.
- **Phase 2 — the retrospective (evergreen, ship anytime):** Champion Sankey,
  Bracket Twins, Scoreline Heatmap, Exact-count Histogram, Contrarian scatter.
  These read just as well after the final.

Each phase gets its own implementation plan.

## Testing

- New `lib/*.js` helpers (`ceiling.js`, `consensus.js`, any `distributions.js`)
  tested with `node --test lib/*.test.js`, consistent with the existing 72-test
  suite. Pure functions, deterministic fixtures.
- `scripts/build-history.mjs` gets a small test on the git-walk + replay logic
  (mirrors `scripts/seed-knockout.test.mjs` precedent).
- Chart components are eyeballed on the dev server (`npm run dev` →
  `/stats.html`), consistent with how the rest of the React UI is verified.
- Mock escape hatch: a `?mockStats=1` param loading a fixture `history.json` +
  sample brackets, mirroring the existing `?mockLeaderboard=1` / `?mockKnockout=1`
  pattern, so the page is developable without live data.

## Privacy / ops notes

- `history.json` ships names + scores in the static bundle. This matches the
  post-lock leaderboard's existing exposure (brackets are already revealed and
  public), so no new privacy surface. Uses `email_hash` + display name exactly
  as the leaderboard does.
- `build-history.mjs` is a manual one-shot for now (like `cache-odds`). If we
  want the Gap to stay live, a follow-up wires it into the cron workflow after
  the results commit. Out of scope for Phase 1.

## Open questions

None blocking. Visual identity (palette/type) is intentionally deferred to the
`frontend-design` skill at build time.
