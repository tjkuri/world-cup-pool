# Stats Page — Phase 2 Design (retrospective charts)

Date: 2026-07-06
Status: Design — pending confirm, then build chart-by-chart

## Context

Phase 1 + 1.5 shipped (The Gap, Live Ceiling, Superlatives). Phase 2 adds the
deferred "retrospective" charts in a new section **below** the live trio. The
user chose four of the five originally-designed charts — **the scoreline
heatmap is dropped**; the exact-count histogram is kept.

## The four charts

All lazy-loaded, dark-theme, consistent with the existing stats page. New Nivo
packages: `@nivo/sankey`, `@nivo/network`, `@nivo/scatterplot` (`@nivo/bar`
already installed). All Nivo 0.99 (React 19 verified).

### 1. Champion / Advancement Sankey (`@nivo/sankey`)

The "waterway": how many brackets routed each team through the deep rounds.
- **Scope: R16 → QF → SF → Final → Champion** (R32's 32 teams are too dense).
- **Nodes:** one per `(round, team)`, id `"${round}:${team}"`, label = team name.
- **Links:** for each bracket and each round R in [R16, QF, SF, Final], if the
  player advanced team T out of round R (T is an `advances` value on an R slot)
  AND also advanced T out of the *next* round R+1, add 1 to link
  `(R:T) → (R+1:T)`. The Final→Champion link is the champion pick. Ribbon width =
  bracket count. Teams thin out rightward as brackets diverge.
- **Data:** all knockout submissions' `picks.bracket` + `knockout.json` round→slot
  structure. New tested pure helper `lib/advancement.js`:
  `advancementFlows(submissions, knockout) -> { nodes:[{id}], links:[{source,target,value}] }`.
- Interaction: Nivo sankey default hover (highlights a ribbon + shows count).

### 2. Bracket Twins network (`@nivo/network`)

Force-directed graph grouping entrants by bracket similarity.
- **Nodes:** entrants (knockout submissions). **Links:** between the most-similar
  pairs. Similarity = fraction of matching `advances` across all shared bracket
  slots. Build k-nearest edges (e.g. each node linked to its top-2 most-similar
  others, deduped) OR all pairs above a threshold — start with **top-2 nearest
  per node** to keep the graph legible; contrarians end up sparsely connected.
- **Data:** knockout submissions. New tested helper in `lib/consensus.js` (or new
  `lib/twins.js`): `bracketSimilarity(subs) -> pairwise map`, and a
  `twinsGraph(subs, k=2) -> { nodes, links }` builder.
- Interaction: Nivo network hover highlights a node + its links; node label =
  name. Node size could encode total points (optional).

### 3. Exact-count histogram (`@nivo/bar`)

Distribution across the 24 entrants of how many exact scores each nailed.
- **Whole-tournament** exact count per entrant (group `exact_score_count` +
  knockout `exact_count`), reusing the same computation as the "Most Exact"
  superlative. Bucket entrants by exact-count value → bar per bucket (x = "# exact
  scores", y = "# of players"). A short right-skewed distribution.
- **Data:** submissions + `scoreSubmission`/`scoreBracket`. Small helper
  `exactCountHistogram(submissions, fixtures, results, knockout) -> [{ exact, players }]`
  (in a new `lib/distributions.js` or alongside). Tested.

### 4. Contrarian Payoff scatter (`@nivo/scatterplot`)

Did boldness pay off?
- **X = boldness** — per entrant, the average "contrarianness" of their group
  picks = mean over their matches of `(1 − consensusShareOfTheirPickedOutcome)`
  (0 = always with the crowd, 1 = always alone). **Y = points earned** (total, or
  group total to match the X axis's group basis — use **group points** so X and Y
  share the group-stage basis). One dot per entrant; label on hover (voronoi mesh
  for easy hovering of small dots).
- **Data:** submissions + `pickConsensus` + `scoreSubmission`. New tested helper
  `contrarianPayoff(submissions, fixtures, results) -> [{ email_hash, name, boldness, points }]`.

## Layout

New `<section>` "Retrospective" below the Superlatives, in `src/stats/App.jsx`,
inside the existing `<ErrorBoundary><Suspense>`. Charts stacked (Sankey +
histogram full-width; Twins + Contrarian can share a 2-col row on desktop). Each
is a lazy-loaded component under `src/stats/components/` (or `src/stats/retro/`).

## Testing / rollout

- Pure helpers (`advancement`, `twins`, `distributions`, `contrarianPayoff`)
  TDD'd with `node --test`, matching the 96-test suite + `scripts/*.test.mjs` glob.
- Chart components verified on the dev server + live checkpoints, one chart at a
  time (same loop as Phase 1.5). Build-only for subagents; human live-review each.
- New branch `feat/stats-phase2` off `main`; land via the same finishing flow.

## Decisions locked (pending user confirm)
- Sankey R16→Champion (not R32). Histogram whole-tournament. Contrarian X on
  group-pick consensus, Y on group points (shared basis). Twins = top-2 nearest.
- Heatmap dropped.
