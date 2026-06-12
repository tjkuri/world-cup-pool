# Leaderboard QoL: By-match view + Stat band

## Background

Pool is 24 entrants. The leaderboard currently shows totals per entrant; clicking a row opens `PickModal` with that person's picks across all 12 groups. Day 1 of the tournament (MEX-RSA, KOR-CZE) made two new affordances obviously useful:

1. **A way to drill into one match across all entrants** — mirror of `PickModal`, pivoted match-first instead of person-first. Surfaces consensus picks and outliers; gives viewers a "let's see how everyone did on that one" path.
2. **A narrative band** — a few short callouts above the table that give the leaderboard a reason to load between match windows.

Both features share the data that `src/leaderboard/App.jsx` already loads (submissions, results, fixtures) — no new network calls, no schema changes. They ship together.

## Out of scope

- Biggest contrarian who hit — most fun stat but needs a deliberate definition pass; separate spec.
- Biggest mover since last visit — requires localStorage persistence of prior ranks; "Top on latest match" carries similar drama without state.
- Pending / in-progress matches in the by-match view — modal only makes sense post-FT.
- Search inside the match picker — `<optgroup>` by group letter A-L is enough for 72 group matches.
- Knockout-stage matches — group stage only; knockout backend is its own thread.

## Feature 1: By-match view

### Match strip

New component `src/leaderboard/components/MatchStrip.jsx`, rendered between the existing `TopBar`/`PotBar` and the leaderboard table.

- Horizontal scrollable chip row (`overflow-x-auto`, no visible scrollbar).
- Shows only finished matches: `isMatchFinal(result.status)` from `lib/status.js`.
- Chips grouped under day headers: **Today**, **Yesterday**. Older finished matches don't get chips; the picker (below) covers them.
- Chip label: `🇲🇽 2-0 🇿🇦` (flag + score). Uses existing `teamFlag()` from `src/shared/teamNames.js`.
- Click a chip → opens `MatchModal` for that match.

### Match picker (everything else)

At the end of the chip row, a native `<select>` styled to look like `[All matches ▾]`.

- `<optgroup>` by group letter A-L. Each `<option>`'s value is the matchId; label is `MEX 2-0 RSA` (compact).
- Only finished matches are listed (consistent with chip rule).
- Hidden when the strip already covers every finished match (no point showing an empty picker).
- Native `<select>` chosen for: free OS picker on mobile, built-in a11y, tiny code surface. Custom searchable popover is a v2 upgrade if asked for.

### `MatchModal`

New component `src/leaderboard/components/MatchModal.jsx`. Backdrop-div + content-div pattern, mirroring `PickModal`. Includes the same a11y markup shipped earlier (`role="dialog"`, `aria-modal="true"`, `aria-labelledby` on the heading).

URL hash: `#match/{matchId}` for shareability, mirroring `PickModal`'s `#picks/{email_hash}`.

Structure:

- **Header**: `🇲🇽 Mexico 2-0 South Africa · Group A · Final`
- **Summary band** (3 stats):
  - `🎯 12/24 nailed the exact score`
  - `✅ 22/24 picked the winner correctly`
  - `Consensus: 2-0` — most-common pick string. If there's no clear plurality (tie at the top of the pick distribution), render `split — no consensus`.
- **Sorted list**: `Name | Pick | Pts`, sorted by `match_points[matchId]` descending. Exact-score rows get the existing 🎯 emoji + emerald accent (reuse `OUTCOME_CLASSES` from `PickModal`).
- **Click a name** → opens that person's existing `PickModal`. One-way cross-link; `PickModal` doesn't get a link back to `MatchModal` (avoids a nav loop).

### Data flow

All data is already in memory from `App.jsx`'s existing fetches. No new endpoints, no schema changes.

- Strip: iterate `fixtures.matches`, filter `isMatchFinal(results.matches[mid]?.status)`, sort by `kickoff_iso` desc, partition by Today / Yesterday using local TZ; older matches go to the picker only.
- Modal: for the selected `matchId`, iterate `submissions`, read each entry's pick at `entry.picks.matches[matchId]` and score at `entry.scoring.match_points[matchId]`. Score is already computed upstream.
- Summary stats: count exact (`match_points === 6`), count winner-correct (`match_points >= 3`), tally pick distribution to find the consensus.

## Feature 2: Narrative stat band

New component `src/leaderboard/components/StatBand.jsx`, rendered between `MatchStrip` and the leaderboard table.

### Stats (3, all stateless, all computed from in-memory `entries`)

1. **🎯 Most exact scores** — max `entry.scoring.exact_score_count`. Format: `Emily (2 exact)`. On a tie, list first 2 names then `and N others`.
2. **🥇 Lead** — top scorer by `entry.scoring.total`. Format: `Emily +X over Diego`. On a top-position tie: `N-way tie at X pts`.
3. **📈 Top on latest match** — find the most recent FT'd match (latest `kickoff_iso` with `isMatchFinal`). For that match, find the entrant with max `match_points`. Format: `Emily +6 on MEX 2-0 RSA`.

### Layout

- Single line on desktop (`flex` + `flex-wrap`); wraps to 2-3 rows on mobile.
- Each callout: emoji + short label + value. Separator: `·` in `text-slate-600`.
- Container: `bg-slate-900` + `ring-1 ring-slate-800`, matching existing card aesthetic.
- Hidden when no finished matches yet (pre-tournament).

### Data flow

Inline in `StatBand.jsx`. If logic grows past ~50 lines, extract to `lib/leaderboardStats.js` (pure functions) and add `lib/leaderboardStats.test.js` in the existing `node --test` setup.

## Files touched

- new `src/leaderboard/components/MatchStrip.jsx`
- new `src/leaderboard/components/MatchModal.jsx`
- new `src/leaderboard/components/StatBand.jsx`
- modified `src/leaderboard/App.jsx` — wire the three components in; add `#match/{id}` hash routing alongside the existing `#picks/{email_hash}` handling
- *(optional)* new `lib/leaderboardStats.js` + `lib/leaderboardStats.test.js` — only if `StatBand` logic outgrows inline

## Testing

- Primary: manual via `npm run dev`, consistent with existing leaderboard testing conventions.
- If `lib/leaderboardStats.js` is extracted, add tests for:
  - empty submissions / empty results → band hidden
  - all entries tied at the top → tie-string format
  - one match played → "Top on latest match" picks that match

## Risks and open notes

- Strip + StatBand both add vertical space above the table. On phones this could push the first leaderboard row below the fold. Defer mitigation (collapsing one into an accordion) until we see it on real screens.
- "Consensus" is defined as a strict plurality. If the data is e.g. `2-0: 10, 2-1: 10, draws: 4`, we render `split — no consensus`. Don't over-engineer a tiebreaker rule for v1.

## Future v2 work (not in this spec)

- Biggest contrarian who hit (needs definition: <20% of picks? outside top-3? minimum sample threshold?)
- Biggest mover since last visit (localStorage of prior ranks)
- Pre-game consensus view for pending matches (different modal structure)
- Searchable match picker
- Knockout-stage matches in the strip + modal
