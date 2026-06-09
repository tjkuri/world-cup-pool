# World Cup 2026 Pool — Session Handoff

Last updated: 2026-06-08 (v2 scoring rules + pot-counter widget on form + leaderboard, all deployed to main).

## TL;DR for next-session-Claude

> Friends pool for the 2026 World Cup, ~20 entrants. Live at
> https://world-cup-pool.tjkuri99.workers.dev. Backend = Google Apps Script web
> app writing to a Google Sheet (URL in `public/config.json`). Frontend = React
> 19 + Vite 6 + **Tailwind v4** deployed to Cloudflare Pages via Workers Builds
> (`wrangler.toml`). Lib is vanilla JS pure functions with `node --test`. 36 lib
> tests pass.

> **Most recently shipped**: PotBar widget (`src/shared/PotBar.jsx`) on form +
> leaderboard pages — shows "N entrants × $30 = $X pot" via new Apps Script
> `?action=count` endpoint, sessionStorage-cached 60s. Earlier same session:
> v2 scoring locked in (62% group / 38% knockout phase split, see "Scoring
> rules" section), full knockout bracket rules in the Rules drawer (backend
> still TBD), match exact-bonus bumped 2→3, group standings trimmed to 3
> positions (15/8/4 + 8 perfect, dropped 4th place). Previously: dark
> sports-app theme, gated `SubmitModal`, country names + flag emoji + kickoff
> times, cached implied probabilities, picks_json team-code stubs, "Clear all
> picks" confirm modal, soccer-ball favicon, emerald decided-row border.
> All on `main`.

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

[Manual one-shot, refresh as needed]
  └─ npm run cache-odds → public/odds.json (h2h implied probs)
```

**External services:** CF Pages (free), GH Actions (free), Google Sheets +
Apps Script (free), ESPN public scoreboard API (no auth), The Odds API
(free tier 500 req/mo). $0/mo total.

## File map

```
world-cup-pool/
├── index.html, leaderboard.html      # Vite multi-page entry points (incl. soccer-ball favicon)
├── vite.config.js                    # Multi-page rollup input + @tailwindcss/vite plugin
├── wrangler.toml                     # CF Workers Builds (assets dir = ./dist)
├── package.json                      # type: module; deps react, vite, dnd-kit, tailwindcss
├── public/
│   ├── config.json                   # group_lock_iso, apps_script_url, buy_in_usd — SERVED AS-IS
│   ├── fixtures.json                 # 12 groups × 4 teams × 6 matches = 72 (seeded once)
│   ├── results.json                  # Updated by cron; empty pre-tournament
│   └── odds.json                     # Manually refreshed; vig-removed implied probs per match
├── src/
│   ├── styles/main.css               # Just `@import "tailwindcss";` + html/body base
│   ├── form/
│   │   ├── main.jsx, App.jsx         # App fetches config.json, fixtures.json, odds.json (graceful)
│   │   ├── state.jsx                 # useReducer + Context (actions: SET_MATCH_SCORE,
│   │   │                             #   SET_MANUAL_TIEBREAKER, CLEAR_MANUAL_TIEBREAKER,
│   │   │                             #   CLEAR_PICKS, SET_IDENTITY, SET_ACTIVE_GROUP,
│   │   │                             #   SET_ERRORS, SET_SUBMIT_STATE, HYDRATE)
│   │   ├── useAutosave.js            # Debounced 500ms localStorage + blur/visibility/unload
│   │   ├── useDerivedStandings.js    # Thin wrapper around resolveGroupStandings
│   │   ├── useReadyCount.js          # Returns {ready, total, byLetter}; gates submit modal
│   │   ├── resolveStandings.js       # SHARED logic for standings panel + submit
│   │   ├── submit.js                 # POST to Apps Script (text/plain to dodge CORS preflight)
│   │   └── components/
│   │       ├── TopBar.jsx, ProgressBar.jsx, LockBanner.jsx
│   │       ├── GroupTabs.jsx         # Centered responsive pill grid (3/4/6 cols)
│   │       ├── MatchInputs.jsx       # Flags + names + kickoff + implied-probs + decided border
│   │       ├── PredictedStandings.jsx
│   │       ├── ErrorSummary.jsx, SubmittedView.jsx
│   │       ├── SubmitModal.jsx       # Native <dialog>; compact recap (codes) + identity form
│   │       ├── ClearPicksButton.jsx  # Confirm modal; resets matches + ties, keeps identity
│   │       # deleted: IdentityPanel.jsx
│   ├── leaderboard/
│   │   ├── main.jsx, App.jsx, useDeepLink.js
│   │   └── components/{LeaderboardTable, PickModal}.jsx  # PickModal uses flags + names
│   └── shared/
│       ├── RulesDrawer.jsx           # Used by both pages
│       ├── PotBar.jsx                # "N entrants × $30 = $X pot" widget; sessionStorage 60s cache; ?mockCount= dev escape
│       ├── teamNames.js              # TEAM_NAMES + TEAM_FLAGS maps + teamName/teamFlag helpers
│       └── formatKickoff.js          # Date+time formatter for fixture.kickoff_iso
├── lib/                              # PURE LOGIC (untouched) — 36 tests pass
│   ├── derive.js + .test.js
│   ├── standings.js + .test.js
│   ├── score.js + .test.js
│   └── validate.js + .test.js
├── scripts/                          # Node-only dev/ops tools
│   ├── lib/espn.mjs
│   ├── seed-fixtures.mjs             # One-shot (done)
│   ├── fetch-results.mjs             # Cron-driven
│   └── cache-odds.mjs                # Manual; needs ODDS_API_KEY env var
├── apps_script/
│   ├── Code.gs                       # Pasted into Apps Script editor; doPost + doGet
│   └── README.md
├── .github/workflows/fetch-results.yml  # cron '0 */2 * * *'
└── docs/
    ├── superpowers/specs/2026-06-07-world-cup-pool-design.md   # v1 design spec
    ├── superpowers/specs/2026-06-07-ui-restyle-design.md       # Restyle spec
    ├── superpowers/plans/2026-06-07-world-cup-pool-v1.md       # v1 plan (historical)
    ├── superpowers/plans/2026-06-07-ui-restyle.md              # Restyle plan (historical)
    └── HANDOFF.md                    # This file
```

## Deployment URLs

| What | URL |
|---|---|
| Live site | https://world-cup-pool.tjkuri99.workers.dev |
| GitHub repo | https://github.com/tjkuri/world-cup-pool |
| Apps Script web app | In `public/config.json` (`apps_script_url`) |
| Google Sheet | User's Google account, titled "World Cup Pool", tab "submissions" |
| The Odds API console | https://the-odds-api.com (free tier; 500 req/mo) |

## Scoring rules (LOCKED — brother-approved 2026-06-08)

Pool format: two phases, points carry over. Prize split: **30% to group-stage
points leader**, **70% to overall (group + knockout) points leader**. No
survivor, no R32 advancement bonus, everyone plays both phases.

### Group stage (implemented in `lib/score.js`)

| | Pts |
|---|---|
| Correct winner/draw, wrong score | 3 |
| Exact score | 6 (3 + 3 bonus) |
| Wrong winner | 0 |
| Standings 1st correct | 15 |
| Standings 2nd correct | 8 |
| Standings 3rd correct | 4 |
| Perfect 1-2-3-4 order | +8 bonus |

Per-group max: 71. × 12 groups = **852 pts group-stage max**.

### Knockout (rules in UI, **backend not yet implemented**)

| | Pts |
|---|---|
| R32 winner (16 matches) | 4 each |
| R16 winner (8 matches) | 8 each |
| QF winner (4 matches) | 16 each |
| SF winner (2 matches) | 32 each |
| Correct finalist | 50 each (100 max) |
| Correct champion | 80 |
| Exact score on knockout match | +3 bonus |
| Exact score on the Final | +5 bonus (replaces +3) |

Knockout max: **~531 pts**. Total tournament max: **~1,383 pts**.

Phase split: **62% group / 38% knockout** — group leader has a real edge for
the overall title but the bracket is heavy enough that comebacks are possible.

Why these numbers (don't re-litigate without reason):
- Original spec had standings at 5/3/2/1 + 3 perfect — too small relative to
  match scoring with 12 groups.
- Brother proposed 20/10/5 + no 4th. We trimmed to 15/8/4 + 8 perfect to push
  the phase split from 65/35 closer to the 30/70 prize split.
- 4th-place pt dropped because it was the most token reward and brother's
  original spec didn't include it.
- Bracket scoring uses the doubling pattern (industry standard) at 2x the
  brother's original bracket weights so knockout has real swing on the title.

## Lock time

`2026-06-11T19:00:00Z` — pinned to ESPN's earliest group-stage kickoff (South
Africa @ Mexico). Stored in two places that MUST stay in sync:

1. `public/config.json` → `group_lock_iso` (frontend countdown, used for UX)
2. Apps Script script property `group_lock_iso` (server-side enforcement)

To extend the lock, edit the Apps Script script property in the UI; client UI
will follow after redeploy of config.json.

## Recent additions (post-restyle)

In rough commit order. All on main:
- Tie resolution is **optional** — submit doesn't gate on unresolved ties.
  `useReadyCount` only requires `allFilled`; standings panel hint copy softened.
  Within still-tied subsets, the FIFA chain + alphabetical fallback determines
  the submitted order if the user doesn't drag.
- CORS preflight on submit is dodged by sending `Content-Type:
  text/plain;charset=utf-8`. Apps Script still parses `e.postData.contents`.
- Full country names + flag emoji rendered everywhere (form match inputs,
  standings panel, PickModal); SubmitModal recap stays as 3-letter codes for
  density.
- `public/odds.json` cached via `npm run cache-odds`. Vig-removed implied
  probabilities for h2h (home / draw / away), averaged across all bookmakers
  returned by The Odds API for region=us. Rendered under each match row as
  `Mexico 67% · Draw 21% · South Africa 11%`. Small "odds cached <date>" stamp
  appears at the top of the group heading. Graceful degrade if `odds.json` is
  missing.
- picks_json now includes `home`/`away` team-code stubs per match so the
  Google Sheet row is self-describing even if ESPN fixture IDs ever drift.
  Scoring path is unchanged (still matches by ID).
- `ClearPicksButton` with confirm modal: wipes `state.matches`,
  `state.manualTiebreakers`, localStorage draft. Keeps identity.
- Soccer ball ⚽ favicon via SVG data URI in both HTML files.
- Decided match rows (both scores filled) get an emerald-500/70 left border.
- `SubmitModal` `<dialog>` centered via `fixed inset-0 m-auto h-fit
  max-h-[90vh]` (Tailwind preflight kills the default `margin: auto`).
- `.claude/settings.local.json` gitignored (it captured the Odds API key in
  the permission allowlist).

## Pending items

| ID | What | Notes |
|---|---|---|
| 1 | Pre-launch smoke tests (full suite) | Lock test, secret_mismatch path, leaderboard pre/post-lock view. |
| 2 | Refresh odds closer to tournament start | `ODDS_API_KEY=... npm run cache-odds`. Key lives in yggdrasil's `.env` (see memory). Costs 1 credit per refresh. |
| 3 | **v2 knockout backend — primary next-session task** | Rules are LOCKED + already in the UI (see "Scoring rules" section). Need: (a) bracket entry form mirroring `src/form/` patterns, (b) extend `lib/score.js` with knockout scoring per the locked table, (c) extend `picks_json` + Apps Script schema for bracket picks, (d) phase-2 lock at end of group stage. Window: Jun 11 → ~Jul 5 (R32 starts). |
| 4 | Brother content decisions | Entry fee TBD. Payout split = **30/70** (locked). R32 handling = **included** (4 pts per winner, locked). |
| 5 | Input-className DRY cleanup | Score inputs repeat the same Tailwind class strings in MatchInputs and SubmitModal — extract to const if you're already editing those files. |
| 6 | ARIA improvements | `aria-labelledby` on SubmitModal/RulesDrawer/PickModal/ClearPicksButton dialogs; `role="alert"` on ErrorSummary. Focus management is handled by native `<dialog>`. Enhancement-level. |

## Important quirks / gotchas

- **`npm test`**: runs `node --test lib/*.test.js` — NOT `node --test lib/`.
  The directory form treats `lib` as a single file argument and fails.
- **CORS on submit**: Apps Script web apps don't respond to preflight. We
  send `Content-Type: text/plain;charset=utf-8` so the browser skips
  preflight. Don't switch back to `application/json` without first verifying
  Apps Script can return CORS headers (it can't on standard web apps).
- **ESPN group letters**: scoreboard events don't include group info in their
  notes/name. We hit the standings endpoint separately and build a
  teamId→group map (`fetchTeamGroupMap` in `scripts/lib/espn.mjs`). The seed
  worked; the cron doesn't need it.
- **Apps Script HTTP status codes**: web apps always return 200. The client
  checks `payload.error` and `payload.ok` instead.
- **Apps Script endpoints (3 of them)**: `POST` for submit;
  `GET ?action=submissions` returns picks **only post-lock** (empty array
  pre-lock by design — protects picks from being scraped);
  `GET ?action=count` returns unique-email count **any time, no identities
  exposed** (powers PotBar pre-lock). If you change Code.gs you must redeploy
  via Apps Script editor → Deploy → Manage deployments → pencil-edit → New
  version → Deploy. Same URL.
- **PotBar cache**: sessionStorage key `wc-pot-count` shape
  `{ count, at }`, 60s TTL. Cache-first (skips fetch if fresh). Dev escape
  hatch: `?mockCount=N` URL param bypasses the fetch entirely.
- **Tie resolution is OPTIONAL**: `useReadyCount` and `submit.js` both ignore
  unresolved ties. If the user doesn't drag, `resolveGroupStandings` still
  returns a fully ordered array (FIFA chain → H2H → alphabetical fallback).
- **localStorage draft schema**: `wc-draft` key. Shape evolved during
  refactor — current version uses `manualTiebreakers: { [groupLetter]: {
  [teamCode]: rank } }`. HYDRATE action is defensive about old shapes.
- **React 19 StrictMode**: enabled in both `main.jsx` files. Effects run twice
  in dev mode. Doesn't affect prod.
- **Dev server**: `npm run dev` → http://localhost:5173/ + /leaderboard.html
- **Build**: `npm run build` → `dist/`. Output is what CF deploys via wrangler.
- **Tests**: `npm test`. 36 pass. Only `lib/` is tested. React components are
  manually tested via the dev server.
- **Apps Script salt**: random hex string in the Apps Script's script
  properties. User generated their own — not stored in repo.
- **Odds API key**: NOT in this repo. Lives in yggdrasil's `.env`. Run via
  `ODDS_API_KEY=$(grep ODDS_API_KEY ../yggdrasil/.env | cut -d= -f2) npm run
  cache-odds` or just paste the key in inline. See memory entry
  `reference_odds_api_key`.
- **Native `<dialog>` centering**: Tailwind v4 preflight zeroes out the
  default `margin: auto` on `dialog`. All modals (`SubmitModal`,
  `ClearPicksButton`) explicitly center via `fixed inset-0 m-auto h-fit`.

## How to resume next session

1. Read this file.
2. `git log --oneline -10` to see what's most recent.
3. (Optional) Read the v1 design spec or the restyle spec if context is
   needed about historical choices.
4. Confirm with user what they want to work on. Likely candidates: v2
   bracket, GH Pages teardown, pre-launch smoke pass, or brother-content
   decisions.
5. `npm run dev` if you need the dev server.

Memory entries:
- `user_stack_preferences` — React + modern tooling, third-party libs OK
- `feedback_vibe_coded` — ship fast, low cost, willing to add infra if low-lift
- `feedback_collaboration_style` — pushes back on thin answers, likes concrete cost/time, comfortable with terse confirms
- `reference_odds_api_key` — Odds API key lives in yggdrasil's `.env`
