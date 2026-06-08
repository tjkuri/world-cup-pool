# World Cup 2026 Pool — Session Handoff

Last updated: 2026-06-07 (during long conversation, after refactor + Cloudflare deploy + tiebreaker UX iterations).

## TL;DR for next-session-Claude

> Friends pool for the 2026 World Cup, ~20 entrants. Live at
> https://world-cup-pool.tjkuri99.workers.dev. Backend = Google Apps Script web
> app writing to a Google Sheet (URL in `public/config.json`). Frontend = React
> 19 + Vite 6 deployed to Cloudflare Pages via Workers Builds (`wrangler.toml`).
> Lib is vanilla JS pure functions with `node --test`. 36 lib tests pass.

> **Right now we're in the middle of polishing the standings tiebreaker UX.**
> Latest known state: just fixed a runtime crash (`scoreOnlyTies is not
> iterable`) in `src/form/resolveStandings.js`. User had not yet confirmed
> whether the drag now sticks the way they want. **Resume by asking them to
> confirm.**

## Architecture

```
[Participant browser]
  │
  ▼
[React form / leaderboard on Cloudflare Pages]
  │  POST submission (or GET submissions)
  ▼
[Apps Script web app]  ←─ script properties: salt, group_lock_iso
  │  appendRow / readRows
  ▼
[Google Sheet "World Cup Pool", tab "submissions"]

[GitHub Actions cron, every 2hr Jun 11→Jul 19]
  ├─ fetch ESPN scoreboard public API (no auth)
  └─ commit public/results.json to repo

[Cloudflare Pages on every push to main]
  └─ npm run build → npx wrangler deploy → live site
```

**External services:** CF Pages (free), GH Actions (free), Google Sheets +
Apps Script (free), ESPN public scoreboard API (no auth). $0/mo total.

## File map

```
world-cup-pool/
├── index.html, leaderboard.html      # Vite multi-page entry points
├── vite.config.js                    # Multi-page rollup input config
├── wrangler.toml                     # CF Workers Builds (assets dir = ./dist)
├── package.json                      # type: module; deps react, vite, dnd-kit; devDep wrangler
├── public/
│   ├── config.json                   # group_lock_iso, apps_script_url — SERVED AS-IS
│   ├── fixtures.json                 # 12 groups × 4 teams × 6 matches = 72 (seeded once)
│   └── results.json                  # Updated by cron; empty pre-tournament
├── src/
│   ├── styles/main.css               # Global stylesheet
│   ├── form/
│   │   ├── main.jsx, App.jsx         # Entry + top-level component
│   │   ├── state.jsx                 # useReducer + Context (actions: SET_MATCH_SCORE,
│   │   │                             #   SET_MANUAL_TIEBREAKER, CLEAR_MANUAL_TIEBREAKER,
│   │   │                             #   SET_IDENTITY, SET_ACTIVE_GROUP, SET_ERRORS,
│   │   │                             #   SET_SUBMIT_STATE, HYDRATE)
│   │   ├── useAutosave.js            # Debounced 500ms localStorage + blur/visibility/unload
│   │   ├── useDerivedStandings.js    # Thin wrapper around resolveGroupStandings
│   │   ├── resolveStandings.js       # SHARED logic for standings panel + submit
│   │   ├── submit.js                 # POST to Apps Script, response handling
│   │   └── components/
│   │       ├── TopBar.jsx, ProgressBar.jsx, LockBanner.jsx
│   │       ├── GroupTabs.jsx, MatchInputs.jsx
│   │       ├── PredictedStandings.jsx  # The current iteration ground zero
│   │       ├── ErrorSummary.jsx, IdentityPanel.jsx, SubmittedView.jsx
│   ├── leaderboard/
│   │   ├── main.jsx, App.jsx, useDeepLink.js
│   │   └── components/{LeaderboardTable, PickModal}.jsx
│   └── shared/RulesDrawer.jsx        # Used by both pages
├── lib/                              # PURE LOGIC (untouched since v1) — 36 tests pass
│   ├── derive.js + .test.js          # deriveWinner(h,a) → 'home'|'away'|'draw'
│   ├── standings.js + .test.js       # computeStandings(letter, matches, fixtures, manualTiebreakers)
│   ├── score.js + .test.js           # scoreSubmission(submission, fixtures, results)
│   └── validate.js + .test.js        # validateSubmission(submission, fixtures)
├── scripts/                          # Node-only dev/ops tools
│   ├── lib/espn.mjs                  # fetchScoreboard, parseEvent(evt, teamGroupMap), fetchTeamGroupMap
│   ├── seed-fixtures.mjs             # One-shot — already ran; wrote public/fixtures.json
│   └── fetch-results.mjs             # Cron-driven — writes public/results.json
├── apps_script/
│   ├── Code.gs                       # Pasted into Apps Script editor; doPost + doGet
│   └── README.md                     # Deployment instructions
├── .github/workflows/fetch-results.yml  # cron '0 */2 * * *'
└── docs/
    ├── superpowers/specs/2026-06-07-world-cup-pool-design.md   # Full design spec
    ├── superpowers/plans/2026-06-07-world-cup-pool-v1.md       # v1 implementation plan (historical)
    └── HANDOFF.md                    # This file
```

## Deployment URLs

| What | URL |
|---|---|
| Live site | https://world-cup-pool.tjkuri99.workers.dev |
| GitHub repo | https://github.com/tjkuri/world-cup-pool |
| Old GH Pages (broken — needs teardown) | https://tjkuri.github.io/world-cup-pool/ |
| Apps Script web app | In `public/config.json` (`apps_script_url`) |
| Google Sheet | User's Google account, titled "World Cup Pool", tab "submissions" |

## Lock time

`2026-06-11T19:00:00Z` — pinned to ESPN's earliest group-stage kickoff (South
Africa @ Mexico). Stored in two places that MUST stay in sync:

1. `public/config.json` → `group_lock_iso` (frontend countdown, used for UX)
2. Apps Script script property `group_lock_iso` (server-side enforcement)

To extend the lock, edit the Apps Script script property in the UI; client UI
will follow after redeploy of config.json.

## Currently in progress — tiebreaker UX

User iterated on this *three times* over the conversation. Final desired
semantics (codified in `src/form/resolveStandings.js`):

1. Predicted Standings panel **always renders all 4 rows**, even before any
   scores are entered (so the page layout never jumps).
2. Highlight + drag handle appear **only on rows that are part of a score-based
   tie** — i.e., subsets that the FIFA chain (pts → GD → GS → H2H pts → H2H GD)
   couldn't separate.
3. Tied rows stay **draggable forever** — no "lock" after the user has resolved
   a tie. They can keep changing their mind.
4. Score changes **do NOT wipe** the user's manual order. The `manualTiebreakers`
   map persists.
5. If scores change such that the tie naturally goes away, the highlight
   disappears and the derived order is shown. If scores change back to recreate
   the tie, the user's prior manual order comes back.

**Implementation note for next-session-Claude:** The `lib/standings.js`
`computeStandings` function has a quirk: it only applies `manualTiebreakers`
*within tied subsets*. Once teams have distinguishing manual ranks, the
function considers them "not tied" and falls back to FIFA-chain order, which
discards the manual ordering. That was a real bug.

**The fix is in `src/form/resolveStandings.js`** — we call `computeStandings`
*without* manual ranks to get the score-only standings + tied subsets, then we
manually reorder within each tied subset according to the user's ranks. This
bypasses the lib quirk entirely. **Do not change `lib/standings.js` — the lib
tests assume the old semantics.**

The most recent fix (just pushed via Vite HMR, not yet confirmed working) added
`scoreOnlyTies: []` to the early-return branches of `resolveGroupStandings` so
the destructure `{ scoreOnlyTies }` doesn't crash with "not iterable" before
scores are filled in.

**Resume by asking the user: "Did the drag stick after the latest fix?"**

## Pending items

| ID | What | Notes |
|---|---|---|
| 1 | Verify latest tiebreaker fix works | Just pushed; HMR delivered to the browser. Ask user. |
| 2 | Auto-scroll-to-bottom bug | Theory: page-grew-suddenly. Mitigated by always-rendered standings panel. User hadn't confirmed if still present. |
| 3 | Tear down old GH Pages | `gh api -X DELETE repos/tjkuri/world-cup-pool/pages`. Do AFTER CF deploy is fully smoke-tested. |
| 4 | v2 — knockout bracket challenge | Build between Jun 11 (group stage start) and ~Jun 27 (group stage end). Bracket only, no survivor. Sketch in spec §13. |
| 5 | Pre-launch smoke tests (full suite) | User did some of these manually. Lock test, secret_mismatch path, leaderboard pre/post-lock view. |
| 6 | Brother content decisions | Entry fee, payout split, R32 handling (recommend: skip R32, score from R16). |

## Important quirks / gotchas

- **`npm test`**: runs `node --test lib/*.test.js` — NOT `node --test lib/`. The
  directory form treats `lib` as a single file argument and fails. (Bug fixed
  early in v1 implementation.)
- **ESPN group letters**: scoreboard events don't include group info in their
  notes/name. We hit the standings endpoint separately and build a
  teamId→group map (`fetchTeamGroupMap` in `scripts/lib/espn.mjs`). The seed
  worked; the cron doesn't need it.
- **Apps Script HTTP status codes**: web apps always return 200. The client
  checks `payload.error` and `payload.ok` instead.
- **localStorage draft schema**: `wc-draft` key. Shape evolved during refactor
  — current version uses `manualTiebreakers: { [groupLetter]: { [teamCode]: rank } }`.
  HYDRATE action is defensive about old shapes (won't crash on arrays from
  earlier refactor attempts).
- **React 19 StrictMode**: enabled in both `main.jsx` files. Be aware effects
  run twice in dev mode. Doesn't affect prod.
- **Dev server**: `npm run dev` → http://localhost:5173/, http://localhost:5173/leaderboard.html
- **Build**: `npm run build` → `dist/`. Output is what CF deploys via wrangler.
- **Tests**: `npm test`. 36 pass. Only `lib/` is tested. React components are
  manually tested via the dev server.
- **Apps Script salt**: random hex string in the Apps Script's script
  properties. User generated their own — not stored in repo. Don't worry about
  it.

## How to resume next session

1. Read this file (`docs/HANDOFF.md`).
2. (Optional) Read the design spec: `docs/superpowers/specs/2026-06-07-world-cup-pool-design.md`.
3. Confirm with user where they are. Most likely: testing the latest tiebreaker
   fix on localhost:5173.
4. If dev server isn't running, `npm run dev` to start it.

Memory entries from prior sessions:
- `user_stack_preferences` — React-ecosystem-leaning, values third-party libs
- `feedback_vibe_coded` — ship fast, low cost, willing to add infra if low-lift
- `feedback_collaboration_style` — pushes back on thin answers, likes concrete cost/time, comfortable with terse confirms once context shared
