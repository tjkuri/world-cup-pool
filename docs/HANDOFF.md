# World Cup 2026 Pool — Session Handoff

Last updated: 2026-06-07 (UI restyle complete — Tailwind v4, dark sports-app theme, gated submit modal; on branch `feat/ui-restyle`, not yet merged to main).

## TL;DR for next-session-Claude

> Friends pool for the 2026 World Cup, ~20 entrants. Live at
> https://world-cup-pool.tjkuri99.workers.dev. Backend = Google Apps Script web
> app writing to a Google Sheet (URL in `public/config.json`). Frontend = React
> 19 + Vite 6 + **Tailwind v4** deployed to Cloudflare Pages via Workers Builds
> (`wrangler.toml`). Lib is vanilla JS pure functions with `node --test`. 36 lib
> tests pass.

> **UI restyle is complete** (branch `feat/ui-restyle`). Dark sports-app theme,
> Tailwind v4, gated submit modal (SubmitModal + useReadyCount). Not yet merged
> to main — user controls the deploy.

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
│   │   ├── useReadyCount.js          # Counts filled match scores; gates submit modal
│   │   ├── resolveStandings.js       # SHARED logic for standings panel + submit
│   │   ├── submit.js                 # POST to Apps Script, response handling
│   │   └── components/
│   │       ├── TopBar.jsx, ProgressBar.jsx, LockBanner.jsx
│   │       ├── GroupTabs.jsx, MatchInputs.jsx
│   │       ├── PredictedStandings.jsx
│   │       ├── ErrorSummary.jsx, SubmittedView.jsx
│   │       ├── SubmitModal.jsx        # Gated submit modal (replaced IdentityPanel)
│   │       # deleted: IdentityPanel.jsx
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

## Currently in progress — UI restyle

Branch `feat/ui-restyle`. Not yet merged to main. Merging triggers a CF Pages
deploy. All work is committed and the branch is clean.

What shipped in this branch:
- Tailwind v4 (`@import "tailwindcss"` in `src/styles/main.css`)
- Dark sports-app theme across form + leaderboard
- `SubmitModal` component + `useReadyCount` hook replacing `IdentityPanel`
- Gated submit: modal opens only when all 72 match scores are filled
- Leaderboard restyled to match

## Pending items

| ID | What | Notes |
|---|---|---|
| 1 | ~~Verify latest tiebreaker fix works~~ | Fixed; tiebreaker UX complete. |
| 2 | Decide when to merge `feat/ui-restyle` to main | Merge triggers CF Pages deploy. User controls this. |
| 3 | Pre-launch smoke tests (full suite) | Lock test, secret_mismatch path, leaderboard pre/post-lock view. |
| 4 | Tear down old GH Pages | `gh api -X DELETE repos/tjkuri/world-cup-pool/pages`. Do AFTER CF deploy is fully smoke-tested. |
| 5 | v2 — knockout bracket challenge | Build between Jun 11 (group stage start) and ~Jun 27 (group stage end). Bracket only, no survivor. Sketch in spec §13. |
| 6 | Brother content decisions | Entry fee, payout split, R32 handling (recommend: skip R32, score from R16). |
| 7 | Input-className DRY cleanup | Score inputs repeat the same Tailwind class strings in MatchInputs — worth a quick extract-to-variable pass. |
| 8 | ARIA improvements | `aria-labelledby` on SubmitModal/RulesDrawer dialogs; `role="alert"` on ErrorSummary. Focus management is handled by native `<dialog>`; these are enhancement-level. |

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
3. Confirm with user where they are. Most likely: deciding whether to merge
   `feat/ui-restyle` to main and kick off a CF deploy.
4. If dev server isn't running, `npm run dev` to start it.

Memory entries from prior sessions:
- `user_stack_preferences` — React-ecosystem-leaning, values third-party libs
- `feedback_vibe_coded` — ship fast, low cost, willing to add infra if low-lift
- `feedback_collaboration_style` — pushes back on thin answers, likes concrete cost/time, comfortable with terse confirms once context shared
