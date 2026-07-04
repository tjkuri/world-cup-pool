# World Cup 2026 Pool — Session Handoff

Last updated: 2026-06-29 (**knockout stage LIVE**). Pool is **24 entrants / $720 pot**. v2 knockout bracket is **merged to `main` and deployed**; all 24 knockout brackets are in, **revealed** on the leaderboard, and **submissions are locked** (see "Knockout lock / reveal / email-gate" below). R32 is underway and the cron is scoring it live. Remaining work is operational (judging late/edited picks, final tally), not feature work — see "Knockout live-ops" + "Pending items".

## TL;DR for next-session-Claude

> Friends pool for the 2026 World Cup, 24 entrants. Live at
> https://world-cup-pool.tjkuri99.workers.dev. Backend = Google Apps Script web
> app writing to a Google Sheet (URL in `public/config.json`). Frontend = React
> 19 + Vite 6 + **Tailwind v4** deployed to Cloudflare Pages via Workers Builds
> (`wrangler.toml`). Lib is vanilla JS pure functions with `node --test`. 69 lib
> tests pass (on `feat/v2-knockout-bracket`; 55 on `main`).

> **v2 knockout bracket (on branch `feat/v2-knockout-bracket`, not yet merged):**
> Full bracket entry form (`bracket.html` / `src/bracket/`), `lib/bracket.js`
> connected-bracket resolution, `scoreBracket` in `lib/score.js`, per-phase
> Apps Script lock (`knockout_lock_iso`), leaderboard merge-by-email,
> tabbed PickModal + KnockoutPicks, Overall-first table, PrizeCards, knockout-first
> MatchStrip/MatchModal. Awaiting go-live ~Jun 27 (end of group stage).
> See runbook below.

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
> **Leaderboard QoL (Jun 12 evening)**: by-match drilldown.
> New `MatchStrip` (chips for Today/Yesterday's finished matches + native
> `<select>` picker for older) and new `MatchModal` (per-match summary band
> + sorted-by-points list, with one-way cross-link into the existing
> `PickModal`). `#match/{matchId}` URL hash mirrors the existing
> `#picks/{email_hash}`. Scoring was lifted from `LeaderboardTable` to
> App.jsx so the new components share a single `entries` array.
> Spec at
> `docs/superpowers/specs/2026-06-12-leaderboard-by-match-and-stat-band-design.md`,
> plan at `docs/superpowers/plans/2026-06-12-leaderboard-by-match-and-stat-band.md`.
> Note: the spec also proposed a narrative "StatBand" above the table — built
> it, didn't like it (lead info was redundant with the table; "most exact"
> was thin); removed it. `lib/leaderboardStats.js` still exports the helpers
> (`computeMostExact`, `computeLeadStat`, `computeLatestMatchTop`) as dead
> code, tested, in case anyone wants to revisit. Deferred to v2: "biggest
> contrarian who hit" + "biggest mover since last visit".
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
[Apps Script web app]  ←─ script properties: salt, group_lock_iso, knockout_lock_iso
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
├── bracket.html                      # v2 knockout bracket entry point (feat/v2-knockout-bracket)
├── vite.config.js                    # Multi-page rollup input + @tailwindcss/vite plugin
├── wrangler.toml                     # CF Workers Builds (assets dir = ./dist)
├── package.json                      # type: module; deps react, vite, dnd-kit, tailwindcss
├── public/
│   ├── config.json                   # group_lock_iso, knockout_lock_iso, apps_script_url, buy_in_usd — SERVED AS-IS
│   ├── fixtures.json                 # 12 groups × 4 teams × 6 matches = 72 (seeded once)
│   ├── results.json                  # Updated by cron; empty pre-tournament
│   ├── knockout.json                 # Seeded at go-live (~Jun 27) via seed-knockout.mjs; NOT YET CREATED
│   ├── knockout.sample.json          # Dev fixture; mirrors knockout.json shape with placeholder teams
│   └── odds.json                     # Manually refreshed; vig-removed implied probs per match
├── src/
│   ├── styles/main.css               # Just `@import "tailwindcss";` + html/body base
│   ├── bracket/                      # v2 knockout bracket app (feat/v2-knockout-bracket)
│   │   ├── main.jsx, App.jsx         # Fetches config.json + knockout.json; gated on knockout_lock_iso
│   │   ├── BracketBody.jsx           # Gating shell (opens-after-group-stage / locked / live); mounts BracketEntry
│   │   ├── state.jsx                 # useReducer + Context (SET_SLOT_SCORE, SET_SLOT_ADVANCER,
│   │                             #   SET_CHAMPION, CLEAR_BRACKET, CLEAR_SLOT, SET_IDENTITY,
│   │                             #   SET_ACTIVE_ROUND, SET_ERRORS, SET_SUBMIT_STATE, HYDRATE)
│   │   ├── useBracketAutosave.js     # Debounced localStorage for bracket draft
│   │   ├── submit.js                 # POST to Apps Script with phase="knockout"
│   │   ├── bracketPicks.js           # Derives flat picks map from bracket state for submit/review
│   │   └── components/
│   │       ├── BracketEntry.jsx      # Composes entry UI (RoundTabs+BracketRound+review+submit); connected propagation + champion sync
│   │       ├── BracketReview.jsx     # Collapsible read-only review tree (uses shared bracketTree)
│   │       ├── BracketRound.jsx      # Active round matchup cards: score inputs, derived advancer, pens toggle
│   │       ├── BracketSubmitModal.jsx # Native <dialog> confirm + identity for bracket
│   │       └── RoundTabs.jsx         # Round tabs R32/R16/QF/SF/Final (mirrors GroupTabs)
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
│   │   ├── main.jsx, App.jsx         # App merges group + knockout phases per email (feat/v2-knockout-bracket)
│   │   ├── useDeepLink.js
│   │   └── components/
│   │       ├── LeaderboardTable.jsx  # Overall-first table with group/knockout/total columns
│   │       ├── PickModal.jsx         # Tabbed: Group Picks + Knockout Picks tabs
│   │       ├── KnockoutPicks.jsx     # Bracket-format drilldown: your bracket vs reality (grey carried-fwd teams, advancer caret, gold champion, real result+pts per match) + slim summary/badges
│   │       ├── MatchStrip.jsx        # Group phase: Today/Yesterday chips + dropdown. KO phase: recent-result pills + Group/Knockout dropdowns
│   │       ├── MatchModal.jsx        # Per-match summary band + sorted-by-points list
│   │       └── PrizeCards.jsx        # 30%/70% prize split display cards
│   └── shared/
│       ├── RulesDrawer.jsx           # Used by both pages
│       ├── PotBar.jsx                # "N entrants × $30 = $X pot" widget; sessionStorage 60s cache; ?mockCount= dev escape
│       ├── scoreInput.js             # Shared SCORE_INPUT_CLASS Tailwind string (group form + bracket) (v2)
│       ├── bracketTree.jsx           # Read-only tree for entry-side review + submit recap (v2). Leaderboard KnockoutPicks renders its own richer bracket.
│       ├── teamNames.js              # TEAM_NAMES + TEAM_FLAGS maps + teamName/teamFlag helpers
│       └── formatKickoff.js          # Date+time formatter for fixture.kickoff_iso
├── lib/                              # PURE LOGIC — 69 tests pass (feat/v2-knockout-bracket)
│   ├── bracket.js + .test.js         # Connected-bracket resolution + advancer propagation (v2)
│   ├── derive.js + .test.js
│   ├── standings.js + .test.js
│   ├── score.js + .test.js           # scoreSubmission (group) + scoreBracket + scoreKnockoutMatch (v2)
│   ├── status.js + .test.js          # isMatchFinal(STATUS_FINAL | STATUS_FULL_TIME | AET | PEN)
│   ├── leaderboardStats.js + .test.js  # partition/summary/most-exact/lead/latest-top
│   └── validate.js + .test.js
├── scripts/                          # Node-only dev/ops tools
│   ├── lib/espn.mjs
│   ├── seed-fixtures.mjs             # One-shot (done)
│   ├── seed-knockout.mjs             # Run ~Jun 27 to generate public/knockout.json (v2)
│   ├── seed-knockout.test.mjs        # Tests for seed-knockout (v2)
│   ├── fetch-results.mjs             # Cron-driven; also fetches knockout advances (v2)
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

### Knockout (implemented on `feat/v2-knockout-bracket`; merge ~Jun 27)

| | Pts |
|---|---|
| R32 winner (16 matches) | 4 each |
| R16 winner (8 matches) | 16 each |
| QF winner (4 matches) | 32 each |
| SF winner (2 matches) | 64 each |
| Correct champion | 128 |
| Exact score on knockout match | +3 bonus |
| Exact score on the Final | +5 bonus (replaces +3) |

Knockout max: **~671 pts** (576 round-winner + 95 exact).
Total tournament max: **~1,523 pts** (852 group + 671 knockout).

Phase split: **~56% group / ~44% knockout** after the R16+ doubling (was ~67/33).

Why these numbers (don't re-litigate without reason):
- Original spec had standings at 5/3/2/1 + 3 perfect — too small relative to
  match scoring with 12 groups.
- Brother proposed 20/10/5 + no 4th. We trimmed to 15/8/4 + 8 perfect to push
  the phase split from 65/35 closer to the 30/70 prize split.
- 4th-place pt dropped because it was the most token reward and brother's
  original spec didn't include it.
- Bracket scoring uses the doubling pattern (industry standard) at 2x the
  brother's original bracket weights so knockout has real swing on the title.
- **Finalist points removed + champion 80→64 (rebalance, 2026-06-24):** in a
  connected bracket, a correct SF-winner pick already *is* a correct finalist,
  so the 50-each finalist award double-rewarded the same pick. Dropping it and
  setting champion to 64 keeps a clean doubling ladder (4→8→16→32→64) and pulls
  the phase split from 62/38 to ~67/33.
- **R16+ doubled (pool vote, 2026-07):** froze R32 at 4 (already played) and
  doubled R16→Final (16/32/64/128) to give the knockout more catch-up weight vs
  the frozen group stage. Zero-retroactive: no R16+ game had been scored yet
  (fetch was paused mid-vote), so no standings moved on deploy. Ladder still
  doubles, later rounds still worth more; split 67/33 → ~56/44.
- **Exact-bonus rule tightened (2026-07):** the exact-score bonus now requires
  the real matchup (both teams) + the scoreline, not just a matching number.
  On a draw decided by penalties the bonus still lands even if you called the
  wrong side (the shootout is a coin flip); winner points still need the
  advancer. Implemented in `scoreBracket`/`scoreKnockoutMatch`. Also zero-
  retroactive (all finished games were R32, where everyone shares the matchup).

## Lock time

**Group lock** `2026-06-11T19:00:00Z` (ESPN's first group kickoff). Two places,
normally in sync: `public/config.json` → `group_lock_iso` (UI countdown) and the
Apps Script script property `group_lock_iso` (server enforcement).

**Knockout lock / reveal / email-gate** — the knockout lock is more involved
because the *same* `knockout_lock_iso` controls BOTH submission-lock (`doPost`)
and bracket-reveal (`doGet` hides knockout picks until it passes). Current live
state (deliberate, NOT a bug — don't "sync" them):

- Apps Script property `knockout_lock_iso = 2026-06-28T19:00:00Z` (**past**) →
  submissions locked + all brackets **revealed**.
- `public/config.json` `knockout_lock_iso = 2026-06-30T04:00:00Z` (**future**) →
  keeps the bracket *form* (`bracket.html` UI) open. The desync is intentional:
  property = backend lock+reveal, config = UI form-open window.
- **Email-gate** (added to `Code.gs` `doPost`): the one email in the
  `knockout_open_email` script property bypasses every knockout lock — used to
  hold the window open for a single late straggler while everyone else is
  rejected. There's also a `knockout_submissions_closed` (`'true'`) flag that
  closes the field without touching `knockout_lock_iso` (i.e. without revealing).
  To **fully close**: remove/blank `knockout_open_email`. To re-lock the UI too,
  set `config.knockout_lock_iso` back to the past and drop `bracket_notice`.
- `public/config.json` `bracket_notice` (string) renders an amber banner on
  `bracket.html` (currently: submissions closed, stragglers may still enter,
  picks for already-kicked-off matches are voided).

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
| 1 | **Final scoring / payout** | Pool ends ~Jul 19. 30% to the group-stage points leader, 70% to overall leader. Knockout scores compute live on the leaderboard from `results.json`; the R32-3 nulls (below) are baked into the sheet, so the live board IS the source of truth. Just confirm winners at the end. |
| 2 | Fully close the knockout gate | Once you're sure no more stragglers: remove/blank the `knockout_open_email` Apps Script property, set `config.knockout_lock_iso` back to the past, drop `bracket_notice`. (As of last session Manuel was the last submitter; gate may already be closed.) |
| 3 | (done) Live results | Cron `fetch-results.yml` every 2hr commits `public/results.json` with knockout `advances`. Verified ingesting R32. Client recomputes scoring on load. (Never added sub-2hr polling; not needed.) |
| 4 | (done) v2 knockout + go-live + matchNumber bracket-wiring fix | Shipped & live. |

## Knockout live-ops (DONE — 2026-06-27 → 06-29)

Go-live ran clean: `node scripts/seed-knockout.mjs` → `public/knockout.json`
(committed), `Code.gs` redeployed, `feat/v2-knockout-bracket` merged to `main`,
cron confirmed ingesting R32 with `advances`. `lib/status.js` AET/PEN strings
verified against ESPN (2014 final = `STATUS_FINAL_AET`, 2022 = `STATUS_FINAL_PEN`).

**Bracket-wiring fix (important):** `seed-knockout.mjs` originally numbered R32
slots by match-id; ESPN actually numbers the feeder refs ("Round of 32 N") by
FIFA `matchNumber` (R32 = 73–88), which differs from id order. Using id order put
teams in the wrong half. The seed now fetches `matchNumber` from ESPN's **core
API** per match and numbers each round by it. Don't regress this. (Tests in
`scripts/seed-knockout.test.mjs`, incl. an RSA/BRA opposite-halves regression.)

**Deadline extension + "no editing started matches" rule:** the brother extended
the knockout deadline past the first R32 kickoff (19:00Z), with the rule that any
pick for an already-kicked-off match is voided (scores 0). Enforcement is manual,
aided by **`scripts/audit-late-edits.mjs <sheet.tsv>`** — export the sheet
(File → Download → TSV) and run it; it flags, per player, any final pick that
differs from their last pre-kickoff pick OR was first submitted after kickoff.
Resaves and self-reverts are correctly NOT flagged.

**Edits applied to the live sheet (already reflected on the board):**
- **Jc maldonado, Tuffik** — deleted their post-19:00 resubmission rows → each
  reverts to their honest last pre-kickoff bracket (latest-per-(email,phase) wins).
- **Tyler Grajeda, Manuel Delgado** — late joiners who picked CAN (the finished
  SA game's winner). No pre-game bracket to revert to, so their R32-3 cell was
  hand-edited to `RSA 1-0 advances RSA` (a miss) → scores 0. Rest of their
  bracket untouched.
- Jorge V and sebastian ortega *look* like they copied CAN 0-1 but had it locked
  in pre-kickoff → legit, left alone.
- Emilio Rosas had submitted his bracket under a 2nd email (icloud) inflating the
  pot to 25; corrected to his group gmail → back to 24.

**Privacy/gate mechanics** (also see "Lock time"): `?action=submissions` hides
`phase:'knockout'` rows until `knockout_lock_iso`; returns `knockoutLocked` +
`knockoutCount` (no identities) so the UI can show participation while hidden.

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
- **Tests**: `npm test`. 69 pass (feat/v2-knockout-bracket; was 55 on main). Only `lib/` is tested. React components are
  manually tested via the dev server.
- **Apps Script salt**: random hex string in the Apps Script's script
  properties. User generated their own — not stored in repo.
- **Odds API key**: NOT in this repo. Lives in yggdrasil's `.env`. Run via
  `ODDS_API_KEY=$(grep ODDS_API_KEY ../yggdrasil/.env | cut -d= -f2) npm run
  cache-odds` or just paste the key in inline. See memory entry
  `reference_odds_api_key`.
- **Native `<dialog>` centering**: Tailwind v4 preflight zeroes out the
  default `margin: auto` on `dialog`. All modals (`SubmitModal`, `ClearPicksButton`, `BracketSubmitModal`) explicitly center via `fixed inset-0 m-auto h-fit`.

- **v2 per-phase locks + secrets**: knockout submissions (`phase:'knockout'`)
  gate on `knockout_lock_iso` (NOT group_lock_iso); the secret is checked
  against the latest **knockout** row only, so a player may set a NEW secret for
  phase 2. Email links the two phases on the leaderboard.
- **v2 leaderboard entry shape**: `entries[]` group by `email_hash` and carry
  both phases (`groupSub`/`knockoutSub`, `groupTotal`/`bracketTotal`/`total`).
  `entry.picks`/`entry.scoring` are back-compat aliases for the GROUP row and are
  null for a knockout-only entrant — guard with `?.` (components do).
- **v2 knockout flair from constants**: `KnockoutPicks` + `MatchModal` color
  slots via `scoreKnockoutMatch()` (lib/score.js) — never hardcode point
  literals (see CLAUDE.md). `lib/status.js` AET/PEN strings are best-guess until
  verified against a live knockout result (go-live runbook step 6).
- **v2 dev mock flags**: `?mockKnockout=1` on `bracket.html` loads
  `knockout.sample.json` (full 32-team tree); on `leaderboard.html` combine
  `?mockLeaderboard=1&mockKnockout=1` for the full phase-2 board (varied mock
  brackets: perfect / mixed / busted).
- **v2 modal width**: tabbed `PickModal` widens to `max-w-4xl` on the Knockout
  tab so the bracket has room (group tab stays `max-w-lg`).

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
