# World Cup 2026 Pool — Session Handoff

Last updated: 2026-06-12 (Day 1 + Day 2 in the books — MEX-RSA 2-0, KOR-CZE 2-1, CAN-BIH 1-1). Pool is **24 entrants / $720 pot** (Lisa added via brief admin-unlock; her MEX-RSA pick stripped from the sheet so she doesn't score on a match that already played). Leaderboard now has the by-match drilldown + 2-stat narrative band.

## TL;DR for next-session-Claude

> Friends pool for the 2026 World Cup, 24 entrants. Live at
> https://world-cup-pool.tjkuri99.workers.dev. Backend = Google Apps Script web
> app writing to a Google Sheet (URL in `public/config.json`). Frontend = React
> 19 + Vite 6 + **Tailwind v4** deployed to Cloudflare Pages via Workers Builds
> (`wrangler.toml`). Lib is vanilla JS pure functions with `node --test`. 43 lib
> tests pass.

> **Most recently shipped (Jun 12, Day 1 closed)**: Two bugs surfaced once
> matches actually started feeding results:
> 1. `lib/status.js` helper — ESPN soccer returns `STATUS_FULL_TIME` for
>    finished matches, not `STATUS_FINAL`. Scoring + PickModal + cron's "is
>    this date done?" early-out all silently treated full-time as pending.
>    Shared `isMatchFinal()` recognizes both; ready to extend for knockout
>    statuses. Caught after MEX-RSA finished 2-0.
> 2. `fetch-results.mjs` date-bucketing fix — ESPN serves late-evening
>    kickoffs from the *prior* broadcast day's scoreboard endpoint
>    (e.g. a 02:00 UTC match on Jun 12 lives on ESPN's Jun 11 page). The
>    "is this date all final?" optimization keyed on UTC kickoff day alone,
>    so it skipped fetching the date where ESPN was actually serving the
>    result. 28 of 72 group matches fall in this 00:00-06:00 UTC boundary.
>    Each match now registers under both its kickoff day AND the day before.
>    Caught after KOR-CZE 2-1 (02:00 UTC kickoff) stayed stranded as
>    STATUS_SCHEDULED through a manual cron trigger.
>
> Also: ARIA labels on all four dialogs (SubmitModal, RulesDrawer, PickModal,
> ClearPicksButton) and `role="alert"` on ErrorSummary. Pool grew to 24/$720
> after Lisa was added via a brief admin-unlock; her MEX-RSA pick was
> hand-stripped from picks_json so she doesn't score on a played match.
>
> **Leaderboard QoL (Jun 12 evening)**: by-match drilldown + narrative band.
> New `MatchStrip` (chips for Today/Yesterday's finished matches + native
> `<select>` picker for older), new `MatchModal` (per-match summary band +
> sorted-by-points list, with one-way cross-link into the existing
> `PickModal`), new `StatBand` (2 stateless callouts: "Most exact" and
> "Lead"; band hidden pre-tournament). `#match/{matchId}` URL hash mirrors
> the existing `#picks/{email_hash}`. Scoring was lifted from
> `LeaderboardTable` to App.jsx so all three new components share a single
> `entries` array. Spec at
> `docs/superpowers/specs/2026-06-12-leaderboard-by-match-and-stat-band-design.md`,
> plan at `docs/superpowers/plans/2026-06-12-leaderboard-by-match-and-stat-band.md`.
> Deferred to v2: "biggest contrarian who hit" + "biggest mover since last visit".
>
> Earlier today (pre-lock): Sort matches by `kickoff_iso` on both form and
> leaderboard PickModal — most groups were not chronological in the seed
> (Group A's tournament-opener MEX-RSA was rendering 2nd not 1st). Format
> leaderboard pre-lock message via `formatKickoff` (local TZ instead of raw
> ISO). Add `LockBanner` countdown to leaderboard TopBar (within-24h
> trigger, mirrors form page).
>
> Spot-checked submissions: real variance in Group D winner (TUR/USA/PAR
> 4-3-2 split), Group A 2nd (KOR/CZE 5-4 split), and contrarian standings
> calls (Saky's Morocco-over-Brazil, Manuel's Canada-over-Switzerland).
>
> Earlier in this push cycle: v2 scoring locked in (62% group / 38% knockout
> phase split), full knockout bracket rules in Rules drawer (backend still
> TBD), match exact-bonus bumped 2→3, group standings trimmed to 3 positions
> (15/8/4 + 8 perfect, no 4th). PotBar widget on both pages. Apps Script
> `?action=count` endpoint. GH Pages teardown. Leaderboard column tooltips,
> 🎯 emoji + emerald accent on exact-score picks (fixed stale `pts === 5`
> bug), ✨ Perfect Group badge, 3-letter codes on match rows, mock-data
> escape hatches (`?mockLeaderboard=1`, `?mockCount=N`). All on `main`.

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
│   │   └── components/                # LeaderboardTable, PickModal, MatchStrip, MatchModal, StatBand
│   └── shared/
│       ├── RulesDrawer.jsx           # Used by both pages
│       ├── PotBar.jsx                # "N entrants × $30 = $X pot" widget; sessionStorage 60s cache; ?mockCount= dev escape
│       ├── teamNames.js              # TEAM_NAMES + TEAM_FLAGS maps + teamName/teamFlag helpers
│       └── formatKickoff.js          # Date+time formatter for fixture.kickoff_iso
├── lib/                              # PURE LOGIC — 55 tests pass
│   ├── derive.js + .test.js
│   ├── standings.js + .test.js
│   ├── score.js + .test.js
│   ├── status.js + .test.js          # isMatchFinal(STATUS_FINAL | STATUS_FULL_TIME)
│   ├── leaderboardStats.js + .test.js  # partition/summary/most-exact/lead/latest-top
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
| 1 | **Live results polling — primary next-session task** | The fetch-results.yml cron runs every 2hr and commits public/results.json. During the tournament we want the leaderboard to feel "live" without users having to refresh. Two angles: (a) bump cron frequency from 2hr to 15-30min (cheap on GH Actions), (b) add client-side polling so the leaderboard re-fetches results.json + recomputes scoring every N seconds when a match is live. Likely both. Group stage windows: Jun 11 → ~Jun 27. |
| 2 | Refresh odds closer to tournament start | `ODDS_API_KEY=... npm run cache-odds`. Key lives in yggdrasil's `.env` (see memory). Costs 1 credit per refresh. Mostly moot once group stage starts since picks are locked. |
| 3 | v2 knockout backend | Rules are LOCKED + already in the UI (see "Scoring rules" section). Need: (a) bracket entry form mirroring `src/form/` patterns, (b) extend `lib/score.js` with knockout scoring per the locked table, (c) extend `picks_json` + Apps Script schema for bracket picks, (d) phase-2 lock at end of group stage. Window: ~Jun 27 (group end) → ~Jul 5 (R32 starts). |
| 4 | Input-className DRY cleanup | Score inputs repeat the same Tailwind class strings in MatchInputs and SubmitModal — extract to const if you're already editing those files. |

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
- **Tests**: `npm test`. 55 pass. Only `lib/` is tested. React components are
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
