# v2 Knockout Bracket — Design Spec

Date: 2026-06-13
Status: Approved (brainstorm), pending implementation plan
Branch: `feat/v2-knockout-bracket`

## Goal

Add the phase-2 knockout bracket to the World Cup pool: an entry page, scoring,
backend schema, and the leaderboard/reporting changes it implies. The scoring
rules are already **locked** and live in the Rules drawer (see
`docs/HANDOFF.md` → "Scoring rules"). This spec covers the data model, entry
UI, scoring engine, backend, and reporting — not the rules themselves.

Build on a **feature branch** (`feat/v2-knockout-bracket`) so the live
group-stage site on `main` is never broken mid-tournament. Cloudflare Pages
deploys on every push to `main`; the branch does not deploy.

## Format & timing (locked)

- **Whole bracket, filled once** against the *real* resolved field — classic
  March Madness model, not round-by-round.
- **Opens ~Jun 27** (when the group stage ends and the 32-team bracket
  resolves) and **locks at first R32 kickoff (~Jul 5).**
- **Connected bracket:** a winner picked in one match auto-advances into the
  next slot; later rounds are chosen from teams the player carried forward. A
  player's champion must be a team they advanced all the way.
- **Slot-based scoring (ESPN-style):** each bracket *position* is scored
  independently against reality. "R16 winner" credit means the team the player
  named as emerging from that R16 slot actually emerged — regardless of whether
  they nailed the opponent or earlier rounds. A busted champion can still earn
  later-round points if individual survivors keep winning their slots.

### Why this model (don't re-litigate without reason)

The locked scoring table rewards naming a champion (80) and finalists (50 each)
*from the R32 stage* — that long-odds payoff only exists if the whole bracket is
committed up front. Round-by-round would gut it (you'd "pick the champion" only
at the final, a 50/50). Slot-based (vs path-dependent) scoring keeps busted
brackets alive and engaging across the ~3-week knockout window, and is the
familiar bracket-pool behavior players expect.

## Architecture

```
[bracket.html]  ← new 3rd Vite entry point (group form + leaderboard unchanged)
  │  reads public/knockout.json (the resolved 32-team tree)
  │  POST submission { phase: 'knockout', ... }
  ▼
[Apps Script web app]  ← + new script property knockout_lock_iso
  │  appendRow (phase column already exists)
  ▼
[Google Sheet "submissions"]  ← one extra row per email, phase='knockout'

[seed-knockout.mjs]  ← one-shot, run ~Jun 27 → writes public/knockout.json
[fetch-results.mjs]  ← extended to also pull knockout match IDs (cron)
[leaderboard.html]   ← phase-aware: overall-first board, tabbed PickModal,
                        knockout-first match strip
```

External services and the $0/mo footprint are unchanged.

## Components

### 1. `public/knockout.json` (new data file)

The resolved knockout bracket: real teams + ESPN knockout match IDs + slot tree.
Produced once by `seed-knockout.mjs` after group stage ends. Shape (illustrative):

```json
{
  "seeded_at": "2026-06-27T...Z",
  "first_kickoff_iso": "2026-07-05T...Z",
  "rounds": {
    "R32": [
      { "slot": "R32-1", "match_id": "7605xx", "home": "BRA", "away": "KOR",
        "kickoff_iso": "...", "feeds": "R16-1" },
      ...16 entries
    ],
    "R16": [ { "slot": "R16-1", "match_id": null, "from": ["R32-1","R32-2"], "feeds": "QF-1" }, ...8 ],
    "QF":  [ ...4 ], "SF": [ ...2 ], "F": [ { "slot": "F-1", "from": ["SF-1","SF-2"] } ]
  }
}
```

- R32 slots have known teams + real match IDs from ESPN. Later rounds are slot
  templates (`from`) that the connected-bracket UI fills as the player picks.
- `match_id`s for R16+ may be `null` at seed time and backfilled by the cron as
  ESPN publishes them, OR the seeder fetches the full tree if ESPN exposes it.
  Decided at implementation; the scorer matches by `match_id` once present.
- Kept tournament-agnostic in shape so the file can be re-seeded for future
  tournaments.

### 2. `bracket.html` + `src/bracket/` (new entry app)

Mirrors `src/form/` patterns: `main.jsx`, `App.jsx`, a `useReducer`+Context
state module, `useAutosave.js` (localStorage draft, debounced), a `submit.js`,
and a `components/` dir. Shared shell (`TopBar`, `RulesDrawer`, `PotBar`,
`teamNames`, `formatKickoff`) imported from `src/shared/`.

**Before group stage ends / no `knockout.json`:** page shows an "opens after the
group stage" state (mirrors the pre-lock leaderboard copy).

**Entry UI — round tabs + score-derived advancement:**
- Tabs: `R32 / R16 / QF / SF / 🏆` (reuses the `GroupTabs` visual pattern).
- Each round is a vertical list of matchup cards. Each card has two **score
  boxes** (reuses the `MatchInputs` score-input pattern and the
  extracted shared className — see Polish). Winner is **derived** from the
  score; the derived winner auto-advances into the next round's slot.
- **Ties:** knockout matches cannot end drawn. When the two scores are equal, a
  small "advances on pens" toggle selects who moves on. The toggle's pick is the
  advancer; the entered scoreline is still used for the exact-score bonus.
- **Review before submit:** a read-only **bracket-tree view** (the horizontal
  tree from brainstorm option B) summarizes the full bracket; on narrow screens
  it falls back to a stacked round-by-round summary. Submit confirms from here.
- Identity + secret form mirrors `SubmitModal` (name, email, **secret — a new
  one is allowed**, see Backend).

**Picks payload (`picks_json` for the knockout row):**

```json
{
  "bracket": {
    "R32-1": { "match_id": "7605xx", "home": "BRA", "away": "KOR",
               "home_score": 2, "away_score": 0, "advances": "BRA" },
    "R32-2": { ..., "home_score": 1, "away_score": 1, "advances": "FRA" },
    ...
    "F-1":   { "home": "BRA", "away": "ARG", "home_score": 1, "away_score": 0,
               "advances": "BRA" }
  },
  "champion": "BRA"
}
```

`advances` is explicit (derived from score, or the pens toggle on a tie) so the
scorer never re-derives ties. Team-code stubs (`home`/`away`) are embedded for
self-describing rows, matching the group-phase convention.

### 3. `lib/score.js` — new `scoreBracket(bracketPicks, knockout, results)`

Pure function, `node --test`. Group `scoreSubmission` is **untouched**. Adds
knockout point constants (sourced from the locked table) and computes,
slot-by-slot:

- **Round-winner points** for each KO match whose result `isMatchFinal`:
  R32 4 / R16 8 / QF 16 / SF 32. Awarded when `advances` for that slot equals
  the actual advancer.
- **Champion:** the final's actual winner; +80 if `champion` matches.
- **Finalists:** the two actual finalists (the SF winners); +50 each for each
  correctly predicted finalist (max 100). Additive on top of the SF-winner
  points, per the locked table.
- **Exact-score bonus:** +3 when the predicted `home_score`/`away_score` equals
  ESPN's reported full-time/end-of-ET score (penalty shootouts ignored for the
  score comparison); **+5 instead of +3 on the final.**
- Returns `{ slot_points, round_totals, champion_points, finalist_points,
  exact_bonus, bracket_total, ... }` — shaped for the Knockout drilldown tab.

This sums to the **~531 KO max** documented in the handoff (verified:
256 round-winner + 80 champion + 100 finalists + ~95 exact = ~531).

**`isMatchFinal` already recognizes `STATUS_FULL_TIME`**; extend `lib/status.js`
if knockout/ET/penalty statuses surface a new ESPN string.

### 4. Backend — `apps_script/Code.gs` (MANUAL redeploy required)

The `phase` column and `doPost`'s `phase` param already exist. Changes:

- **New script property `knockout_lock_iso`.**
- `doPost`: when `phase === 'knockout'`, gate on `knockout_lock_iso` (the group
  lock is long past). The secret check runs against the **latest knockout row
  for that email only** — so a player may set a **new secret** for phase 2
  (handles forgotten phase-1 secrets); their first knockout submission
  establishes it, later edits must match it. Email links the two phases.
- `GET ?action=submissions` already returns all rows post-lock; the client now
  receives both a group row and a knockout row per email and merges them.

**Accepted tradeoff:** any new secret is allowed for a first knockout
submission, so someone who knows your email could submit a bracket in your name.
Friends pool, low threat; they still cannot touch your group picks.

> ⚠️ Editing `Code.gs` in the repo does nothing until the user pastes it into
> the Apps Script editor and creates a new deployment version (URL unchanged).
> Flag this clearly at hand-off.

### 5. `scripts/seed-knockout.mjs` (new one-shot) + `fetch-results.mjs`

- `seed-knockout.mjs`: mirrors `seed-fixtures.mjs`. Run once ~Jun 27 when the
  bracket resolves; fetches the 32 qualifiers + R32 pairings (incl. the 8
  best-third-placed lookup) from ESPN and writes `public/knockout.json` with the
  first-kickoff ISO (which the user pastes into `config.json` and the Apps Script
  `knockout_lock_iso` property).
- `fetch-results.mjs`: currently iterates group fixture IDs. Extend to also read
  knockout match IDs from `knockout.json` so KO results land in `results.json`
  and score. (Date-bucketing fix from Jun 12 still applies.)

### 6. Leaderboard / reporting — `src/leaderboard/`

**Phase detection:** the board is "in knockout phase" once `knockout.json`
exists and its first kickoff has passed (or simpler: once any KO match is
final). Pre-knockout (Jun 27–Jul 5) it shows a "🗳️ N/24 brackets submitted"
line (reuses the PotBar count pattern, phase-2 flavored).

**Overall-first board (phase 2):**
- Two **prize cards**: Group (30%, frozen/DECIDED, names the locked winner) and
  Overall (70%, live, accent). 
- One table sorted by **Total**, columns **Group / Knockout / Total**. Group is
  a quiet frozen column; Knockout is the live accent column.
- `entries` useMemo in `App.jsx` now **groups submissions by `email_hash`**,
  pairing each player's group row + knockout row, and computes
  `total = group_scoring.total + bracket_scoring.bracket_total`.

**Tabbed `PickModal`:** `[Group] / [Knockout]` tabs. Group tab = today's content
unchanged. Knockout tab renders the player's bracket with slot-by-slot
points/status (alive / busted / hit), sourced from `scoreBracket` output.

**Match strip:** in phase 2, knockout matches become the prominent chips (same
`MatchModal` per-match drilldown, now "who picked this slot right"); group
matches demote into the existing `<select>`, kept but less front-and-center.

Pre-phase-2, the leaderboard is unchanged.

## Polish folded in (from the v1 sweep)

- **`pts ===` / `pts >=` literal gotcha (CLAUDE.md):** the new Knockout
  drilldown tab needs row flair (hit/exact). Source thresholds from `score.js`
  constants — do **not** re-hardcode literals. Add a note to CLAUDE.md covering
  the knockout renderer too.
- **Pending #4 (input-className DRY):** extract the repeated score-input Tailwind
  class string to a shared const while building the bracket score boxes; reuse
  it in `MatchInputs` and `SubmitModal`.

Out of scope (noted, not touched): `lib/leaderboardStats.js` dead code,
`jsonResponse`'s informational `status` arg.

## Data flow

1. Group stage ends ~Jun 27 → user runs `seed-knockout.mjs` → `knockout.json`
   committed; user pastes first-kickoff ISO into `config.json` +
   `knockout_lock_iso` and redeploys Apps Script.
2. `bracket.html` goes live; players fill brackets (autosaved), submit
   (`phase:'knockout'`, own secret, linked by email).
3. First R32 kickoff ~Jul 5 → knockout lock; submissions close.
4. Cron fetches KO results into `results.json`; leaderboard recomputes
   `scoreBracket` per email, overall-first board updates live.

## Error handling

- Missing/empty `knockout.json` → bracket page and leaderboard phase-2 features
  degrade to "opens after group stage" (mirrors existing graceful-degrade for
  `odds.json`).
- Incomplete bracket on submit → validation blocks (mirrors group form's
  `validateSubmission` + `ErrorSummary`), listing unfilled slots.
- Locked (`knockout_lock_iso` passed) → same "submissions closed" handling as
  the group phase.
- Apps Script always returns 200; client keys on `payload.ok` / `payload.error`
  (unchanged convention).

## Testing

- `lib/score.js` new `scoreBracket` paths: round-winner credit, slot
  independence (busted champion still scores later slots), champion/finalist
  additivity, exact-score bonus (+3 / +5 final, pens ignored), tie/advancer
  handling, pending matches excluded. `node --test lib/*.test.js`.
- `seed-knockout.mjs` / cron extension: spot-checked against ESPN output (the
  group seed was validated the same way).
- React (`src/bracket/`, leaderboard changes): manual via `npm run dev` +
  `?mock` escape hatches; extend mock data for a knockout phase.

## Open implementation details (resolve in the plan, no design impact)

- Whether R16+ `match_id`s are seeded up front or backfilled by the cron.
- Exact ESPN status string(s) for ET/penalty finishes (extend `lib/status.js`
  if needed).
- The precise narrow-screen fallback for the read-only bracket-tree review.
