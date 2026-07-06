# Stats Page — Phase 1.5 Design (interactive Gap + consensus superlatives)

Date: 2026-07-05
Status: Approved — ready for implementation plan

## Context

Phase 1 shipped `stats.html` with three charts (The Gap on Nivo line, Live
Ceiling on Nivo bar, Superlatives cards) — all merged on `feat/stats-page`.
Live review surfaced that The Gap (24 Nivo lines) is unreadable and lacks the
interactivity we designed, and that the Riser/Faller superlatives are opaquely
time-bound. Phase 1.5 addresses both.

## Goals

1. **Rebuild The Gap** as an interactive, explorable chart: per-line
   highlighting, phase bands, dots, free zoom, and a play/animate mode.
2. **Swap the two time-bound superlatives** (Biggest Riser/Faller) for
   non-temporal, self-explanatory awards driven by a new consensus engine.

## Non-goals (YAGNI)

- No change to Live Ceiling beyond the readability fixes already committed.
- No new backend / data pipeline — everything runs off the existing
  `history.json`, `submissions`, `results`, `knockout.json`, `odds.json`.
- Not building the remaining Phase-2 charts (Sankey, Twins network, heatmap,
  exact-count histogram, contrarian scatter) — those stay deferred.

## Key decision: The Gap graduates from Nivo to visx + d3

Nivo `ResponsiveLine` has no native zoom, hides the scales a play-mode must
animate, and its slice tooltip blocks per-line hover. All three requested
features fight the abstraction. The Gap is therefore **rebuilt on visx v4**
(`@visx/scale`, `@visx/shape`, `@visx/axis`, `@visx/group`, `@visx/zoom`,
plus `d3-scale`/`d3-shape` as needed) — verified React-19 compatible
(`react: ^18 || ^19`). Nivo stays for Live Ceiling and the Phase-2 charts.

The Phase-1 `TheGap.jsx` (Nivo) is **replaced**; its `toSeries` transform and
tied-bucket tooltip design are reused conceptually.

## The Gap — component design

Data: the existing `history.json` (`{ snapshots: [{ t, standings:[{email_hash,
name, total, ...}] }] }`). One line series per entrant of `{ x: Date(t), y: total }`.

Rendered as a set of focused units under `src/stats/gap/`:

- **`GapChart.jsx`** — the visx SVG: d3 `scaleTime` (x) + `scaleLinear` (y),
  one `<LinePath>` per entrant, axes, crosshair. Owns the visible x/y domains
  (driven by zoom + playback). Default paint: all lines faint slate, current
  leader gold.
- **`GapLegend.jsx`** — scrollable name list (sorted by current total). **Hover
  a name → spotlight** that entrant's line (bold + distinct color; all others
  dim to very faint). **Click → pin** (pins persist and stack, so several can be
  compared). Selecting none = default view. This is the "make it readable" core.
- **`PhaseBands.jsx`** — shaded vertical background regions for Group → R32 →
  R16 → QF → SF → Final. Boundaries derived from each round's **earliest
  `kickoff_iso`** in `knockout.json` (group band starts at the first snapshot).
  A small pure helper `lib/phases.js` (`phaseBoundaries(knockout)`) computes and
  is unit-tested.
- **Tied-bucket tooltip** — vertical crosshair at the nearest snapshot; a dark,
  `min-width` tooltip listing the standing there, bucketing entrants by equal
  `total` ("214 — Saky · Manuel"). Reuses the Phase-1 tooltip design, widened so
  rows no longer wrap.
- **Dots** — small circles at each snapshot, drawn **only on spotlighted/pinned
  lines** (not all 24 × 118).
- **Zoom** (`useGapZoom` via `@visx/zoom`) — drag-to-pan and scroll/pinch to
  zoom on both axes; a **Reset** button restores the full domain. Zoom is
  suspended while playback is running.
- **Play mode** (`usePlayback` hook + `PlayControls.jsx`) — play/pause + a
  scrubber. Playback reveals snapshots **cumulatively** (`snapshots[0..i]`); the
  x-domain grows to the current time and the y-domain auto-scales to the current
  max, so the view **naturally zooms out** as the tournament progresses. Lines
  animate as ranks cross. A speed control is optional (start with one speed).

State ownership: `GapPanel.jsx` composes GapChart + GapLegend + PhaseBands +
PlayControls and holds the shared UI state (`hovered`, `pinned:Set`, zoom
transform, playback index). Playback and zoom are mutually exclusive (playback
resets/inhibits manual zoom).

## Superlatives — consensus engine

New pure, tested **`lib/consensus.js`**:

- `pickConsensus(submissions, fixtures)` → per group match, the distribution of
  predicted outcomes (home/draw/away) across entrants, and the modal
  (consensus) outcome + its share.
- `contrarianCorrect(sub, fixtures, results, consensus)` → count of the
  entrant's **correct** predictions that were **low-consensus** (below a
  threshold, e.g. picked by < 33% of the pool). Powers **Hipster** (max).
- `chalkScore(sub, fixtures, odds)` → count of group matches where the entrant's
  predicted winner equals the **odds favorite** (argmax of
  `home_implied/draw_implied/away_implied` in `odds.json`). Powers **Chalk-Eater**
  (max).

`Superlatives.jsx` award set becomes: **Most 🎯 Exact** (kept), **Live Longshot**
(kept), **Hipster** (new), **Chalk-Eater** (new). Riser/Faller removed. Missing
data (e.g. no `odds.json`) → that card omitted, no crash (existing pattern).

## Dependencies

Add `@visx/scale @visx/shape @visx/axis @visx/group @visx/zoom` (v4) and, if not
transitively present, `d3-scale`/`d3-shape`/`d3-time-format`. Lazy-loaded with
the rest of the charts so first paint stays light.

## Testing

- Pure libs (`lib/phases.js`, `lib/consensus.js`) → `node --test` with
  deterministic fixtures, consistent with the (now 87-test) suite and the
  widened `npm test` glob.
- The visx chart + interactions are verified on the running dev server and
  iterated live with the user (build → refresh), the same loop used for the
  Phase-1 charts. `?mockStats=1` continues to exercise a small history.

## Rollout

Continues on `feat/stats-page`. Same subagent-driven execution loop: pure-logic
tasks are TDD'd by subagents; the visx Gap is built incrementally (base render →
highlighting → phases → dots → zoom → play) with a live review checkpoint after
the base render before layering interactions.
