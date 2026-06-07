# World Cup 2026 Hybrid Survivor Pool — Design Spec

**Status:** Draft for review
**Date:** 2026-06-07
**Author:** tkuri (brainstormed with Claude)

## 1. Overview

A web app for a private friends pool (~20 entrants) running on the rules drafted by the
commissioner's brother. The pool spans the 2026 FIFA World Cup and combines:

- **Group stage predictions** — winner/draw + exact score per match. Standings are
  derived live from the user's predicted scores (see §5.3), with an inline
  tiebreaker widget when scores leave teams tied.
- **Bracket challenge** — pre-knockout predictions for every advancing team through to
  the Champion.

The original ruleset also included a "Survivor" pick mechanic; that has been
dropped (2026-06-07 decision) to keep v2 simple.

The product is delivered in two phases driven by tournament dates:

- **v1 (ships by Jun 11, 2026 group-stage opener):** group-stage submission form,
  Apps Script backend, lock mechanism, fixture seed, results plumbing, scoring engine,
  leaderboard with pick-detail modal, rules viewer.
- **v2 (built during group play, locks before knockout starts):** knockout-stage
  bracket submission form, extended scoring, tiebreaker logic.

The remainder of this spec covers **v1 only** unless otherwise marked. A short v2
section at the end captures known shape so we don't paint ourselves into a corner.

## 2. Non-goals (v1)

Explicitly out of scope to keep the timeline realistic:

- User accounts / real auth (we use a self-chosen "secret" string instead).
- Email confirmation receipts after submission.
- An admin UI for marking who paid (a column in the sheet is fine).
- A pre-lock leaderboard preview (locked submissions stay private until kickoff).
- Server-side rate limiting (20 friends do not need it).
- Mobile-first polish (laptop-first per user preference; mobile is best-effort).
- Full accessibility audit (semantic HTML only).
- Backwards compatibility for schema migrations (we will not be running this in 2030).

## 3. Architecture

Single GitHub repository (`world-cup-pool`) hosting a static site on GitHub Pages,
plus a GitHub Actions workflow that fetches match results on a schedule. A separate
Google Sheet (managed via Google Apps Script webhook) serves as the submissions
database. No backend server we maintain.

```
[Participant browser]
  │
  │  POST submission JSON
  ▼
[Google Apps Script webhook] ───▶ [Google Sheet `submissions`]
                                          │
                                          │ Apps Script GET endpoint
                                          │   (returns latest-per-email after lock)
                                          ▼
                                  [Browser leaderboard page] ◀── fixtures.json
                                                              ◀── results.json
                                                              ◀── config.json
[GitHub Actions cron]
  │
  │  GET site.api.espn.com/.../scoreboard?dates=YYYYMMDD
  ▼
[ESPN public API] ──▶ scripts/fetch-results.mjs ──▶ commits results.json to repo
```

**External services:**

- **GitHub Pages** — static hosting. $0.
- **GitHub Actions** — scheduled cron + commits. $0 (well under free tier).
- **Google Sheets + Apps Script** — submission storage + webhook. $0.
- **ESPN public scoreboard API** — `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard`.
  No auth required, returns JSON. Validated by test fetch on 2026-06-04: opener
  South Africa @ Mexico, Jun 11 19:00 UTC, event ID `760415`, full tournament
  calendar with phase boundaries. Used as canonical source for both fixture seeding
  and results polling. **TheSportsDB** is documented as a fallback if ESPN's shape
  ever changes.

## 4. Data model

### 4.1 Google Sheet (`submissions` tab)

One row per submission attempt. Latest-per-email wins at scoring time.

| Column           | Type           | Purpose                                               |
|------------------|----------------|-------------------------------------------------------|
| `submitted_at`   | ISO 8601 UTC   | Stamped by Apps Script on receipt.                    |
| `name`           | string         | Display name on leaderboard.                          |
| `email`          | string         | Lowercased. Identity key. Internal-only (not exposed).|
| `secret_hash`    | string (hex)   | SHA-256 of `salt + secret`. Salt baked into Apps Script script-property. |
| `phase`          | enum           | `group` in v1. `knockout` reserved for v2.            |
| `picks_json`     | string (JSON)  | Full prediction payload (see 4.2).                    |
| `client_version` | string         | Form schema version, for future-proofing.             |

### 4.2 `picks_json` shape (phase = `group`)

```json
{
  "matches": {
    "<espn_event_id>": {
      "home_score": 2,
      "away_score": 1
    }
  },
  "group_standings": {
    "A": ["MEX", "USA", "CAN", "JAM"]
  }
}
```

- Winner is *derived* from scores (`home_score > away_score` → home wins; equal → draw).
  We never store winner explicitly to avoid the inconsistency mode where stored
  winner contradicts stored scores.
- `group_standings` values are arrays of length 4, ordered 1st → 4th, using FIFA
  3-letter team codes from `fixtures.json`.

### 4.3 `fixtures.json` (committed once before launch)

```json
{
  "groups": {
    "A": {
      "teams": ["MEX", "USA", "CAN", "JAM"],
      "matches": ["760415", "760418", "..."]
    }
  },
  "matches": {
    "760415": {
      "group": "A",
      "home": "MEX",
      "away": "RSA",
      "kickoff_iso": "2026-06-11T19:00:00Z"
    }
  }
}
```

Generated once by `scripts/seed-fixtures.mjs` and committed. Immutable for the
tournament. The seed script *prints* the earliest kickoff time so the
commissioner can copy it into `config.json` and the Apps Script script
property — `fixtures.json` itself does not store the lock time (to avoid
three-way drift between fixtures, config, and Apps Script).

### 4.4 `results.json` (updated by cron)

```json
{
  "updated_at": "2026-06-11T22:14:00Z",
  "matches": {
    "760415": {
      "home_score": 2,
      "away_score": 0,
      "status": "STATUS_FINAL"
    }
  }
}
```

Only matches that have at least kicked off appear. `status` mirrors ESPN's status
strings. Only `STATUS_FINAL` matches contribute to scoring; everything else is
treated as pending.

### 4.5 `config.json`

```json
{
  "group_lock_iso": "2026-06-11T16:00:00Z",
  "apps_script_url": "https://script.google.com/.../exec"
}
```

Read by the frontend on load. The Apps Script holds its own copy of `group_lock_iso`
in script properties for server-side enforcement; the value in `config.json` is for
UX (countdown, lock screen).

## 5. Submission form

### 5.1 Stack

Vanilla HTML + JS + CSS. No build step required. If a thin framework genuinely
simplifies state management once we start writing it, Alpine.js or Preact are
acceptable — but the default is plain JS. Single `index.html`, `app.js`, `style.css`,
plus separate JS modules for scoring (`score.js`) and validation (`validate.js`).

### 5.2 Layout

- 12 group tabs (A–L) across the top, laptop-first.
- Tab visual state:
  - Empty → gray.
  - Partial → yellow dot.
  - Complete → green check.
  - Active → highlighted.
- Persistent top bar: progress count (e.g. `42 / 84 picks complete`), submit button
  disabled until 100% complete and validation clean.

### 5.3 Per-tab content

- **Matches (6 per group)**: each row shows home team, home score input, away score
  input, away team. Winner is implicit from scores; for equal scores, "Draw" label
  renders.
- **Group standings (derived)**: as the user fills match scores, a "Predicted
  standings" panel below the matches updates live. Standings are computed by the
  shared tiebreaker function (§8.4) using the user's *predicted* scores as input.
  No standings dropdowns. The standings stored in the submission are the resolved
  output of this derivation. **Trade-off accepted:** standings cease to be an
  independent scoring axis — users express group-finish opinions exclusively
  through match scores.

### 5.3.1 Manual tiebreaker prompts

The tiebreaker chain (points → goal difference → goals scored → head-to-head
points → head-to-head goal difference) almost always produces a complete strict
order. When it doesn't — typically a small number of teams that remain pairwise
indistinguishable under the user's predicted numbers — the panel renders an
inline drag-to-rank widget for just the still-tied subset:

> *"Mexico and USA finish tied on your numbers. Drag to rank them: [⠿ MEX] [⠿ USA]"*

The user's resolution is merged into the derived order to produce the final
4-team standings array. The widget appears per-group only when needed and
disappears as soon as the chain resolves cleanly.

**When match scores change after a tiebreaker was resolved**, the standings are
recomputed from scratch and any prior tiebreaker resolutions are discarded —
even if the same teams remain tied. The widget reappears for the current tied
subset. This is simpler than partial preservation and avoids stale state.

### 5.4 Identity panel

Shown as a sticky section / modal before submit allows:

- `name` — display name (free text, required, max 40 chars).
- `email` — required, lowercased + validated against a basic regex client-side.
- `secret` — user-chosen string, min 4 chars. Sent in plaintext over HTTPS to
  the Apps Script webhook; hashed server-side before storage (§5.6). We never
  store the plaintext anywhere.
- An "I understand my secret protects my picks. Save it somewhere." checkbox,
  required before submit.

### 5.5 Auto-save

Debounced. On input change, schedule a save 500ms after the last edit using a
trailing-edge debounce. Additionally, save immediately on `blur`, `visibilitychange`
(tab hidden), and `beforeunload`. The form serializes its state and stores it
under `localStorage.setItem('wc-draft', JSON.stringify(state))`. On load, the
form restores from this key if present. The draft is cleared after a successful
submit.

The draft key is **not** namespaced by email — switching emails mid-draft
overwrites the same key. This is acceptable since (a) laptops are personal and
(b) the form is shared by friends, not coworkers on the same machine.

Rationale for the debounce: keystroke-rate localStorage writes are technically
cheap (sub-ms each) but pile up against the main thread during rapid input.
Debouncing eliminates the overhead without sacrificing recovery — `beforeunload`
+ `blur` ensure no in-flight typing is lost when the tab closes or the user
clicks away.

### 5.6 Submit flow

1. Client validates: every match has both scores (integers ≥ 0), every group has 4
   distinct teams ranked, identity fields present and valid, secret meets minimum
   length, acknowledgment checkbox ticked.
2. Client POSTs `{ name, email, secret, picks }` to the Apps Script webhook URL
   (read from `config.json`).
3. Apps Script:
   a. Reads lock timestamp from script properties. If now ≥ lock → respond 403
      `{ error: "locked" }`.
   b. Computes `secret_hash = sha256(salt + secret)`. Salt is a fixed value stored
      in script properties.
   c. Finds rows for this email. If any exist and the latest one's `secret_hash` !=
      computed hash → respond 403 `{ error: "secret_mismatch" }`. If none exist or
      the latest hash matches → continue.
   d. Appends new row with current timestamp.
   e. Responds 200 `{ ok: true, submitted_at }`.
4. Client on success: clears localStorage draft, swaps page to "Submitted" screen
   showing the timestamp and a link back to edit if pre-lock.

### 5.7 Validation rules (codified)

```
For each match: home_score ∈ [0,20] ∧ away_score ∈ [0,20]
For each group:
  group_standings has exactly 4 entries
  each entry is one of the group's teams (per fixtures.json)
  all 4 entries are distinct
For identity:
  name.length ∈ [1, 40]
  email matches /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  secret.length ≥ 4
  acknowledgment === true
```

Score upper bound of 20 is a sanity guard — anyone predicting 21–0 is almost
certainly typo'ing.

### 5.8 Rules viewer

A collapsible "Rules" panel accessible from both the submission form and the
leaderboard page (people will want to re-check the rules after they submit, not
just before). Implementation: a small button in the top bar (e.g. `📖 Rules`)
opens an overlay/drawer rendering the rules text from a static markdown or HTML
fragment included in the bundle. Closeable via X / Esc / click-outside. No
backend state, no scrolling-the-main-page disruption.

The rules content is the brother's drafted ruleset (adapted for v1 scope: group
stage details fully described; knockout section says "details forthcoming
before knockout submissions open").

## 6. Lock mechanism

- **Authoritative**: Apps Script script-property `group_lock_iso`. Every POST
  compares `new Date()` to this value. Past it → 403 `{ error: "locked" }`. Cannot
  be bypassed by a clever client.
- **UX**: frontend fetches `config.json` on load. Past lock → page swaps to a
  "Submissions closed" view with a leaderboard link. Within 24 hours of lock →
  red banner with live countdown.
- **Manual extension**: edit the script property in the Apps Script UI. No deploy.
- **Granting an individual exception post-lock** is not supported. If you need to
  let one person in late, extend the script property briefly, accept their entry,
  then revert. The git history of `results.json` is your evidence of the world's
  state at that moment.

## 7. Results plumbing

### 7.1 Cron workflow

`.github/workflows/fetch-results.yml`:

- Schedule: `cron: '0 */2 * * *'` (every 2 hours).
- Only active during the tournament window (Jun 11 – Jul 19, 2026). The script
  checks the date and exits early outside the window so we don't burn unnecessary
  Actions minutes.
- Runs `node scripts/fetch-results.mjs`.
- If `results.json` changed → `git commit -m "results update" && git push`.

### 7.2 `scripts/fetch-results.mjs`

- Reads `fixtures.json` to discover the set of matches and their kickoff dates.
- For each date in the tournament range that has at least one match and isn't
  fully `STATUS_FINAL` already (per current `results.json`):
  - `GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD`
  - Extract event ID, home score, away score, status.
  - Merge into `results.json`.
- 1-second sleep between date requests to be a good citizen.
- If the response shape is unexpected (missing fields, non-200), log and exit
  non-zero so the workflow surfaces a failure email.

### 7.3 `scripts/seed-fixtures.mjs`

Run **once** locally before launch. Iterates dates Jun 11–27, hits the same
scoreboard endpoint, extracts all 72 group-stage matches with their canonical
ESPN event IDs, team codes (FIFA 3-letter), kickoff times, and group letter.
Writes `fixtures.json` and `lock_iso` (= earliest kickoff). The output is
committed once and not regenerated.

### 7.4 Manual override

If ESPN reports something wrong, hand-edit `results.json` and push. Git history
is the audit log.

## 8. Scoring engine

### 8.1 Where it runs

Browser. Pure functions in `score.js`. No backend computation. Easy to unit-test.

### 8.2 Function signature

```js
scoreSubmission(submission, fixtures, results) → {
  match_points: { [matchId]: 0 | 3 | 5 },
  match_total: number,
  group_points: {
    [groupLetter]: {
      first: 0 | 5,
      second: 0 | 3,
      perfect: 0 | 3,
      subtotal: number
    }
  },
  group_total: number,
  total: number,
  exact_score_count: number  // for tiebreaker preview
}
```

### 8.3 Rules

**Per match** (only when `results.matches[matchId].status === 'STATUS_FINAL'`):

```
predicted_winner = derive(pick.home_score, pick.away_score)
actual_winner    = derive(result.home_score, result.away_score)
points = 0
if predicted_winner == actual_winner: points += 3
if pick.home_score == result.home_score AND pick.away_score == result.away_score:
    points += 2
```

Pending or not-yet-played matches contribute 0 and are visually rendered as
"pending" (gray), not "wrong" (red).

**Per group** (only when *all 6 matches in the group* are `STATUS_FINAL`):

```
predicted = pick.group_standings[group]    # length-4 array
actual    = computeActualStandings(group, results)  # FIFA tiebreakers

first  = 5 if predicted[0] == actual[0] else 0
second = 3 if predicted[1] == actual[1] else 0
perfect = 3 if predicted == actual else 0
subtotal = first + second + perfect
```

Group standings are computed from group match results using FIFA's tiebreaker
chain: points → goal difference → goals scored → head-to-head points → head-to-head
goal difference → fair play → drawing of lots. We implement through head-to-head
goal difference; the last two are extremely unlikely and we cross that bridge if
we hit it (fallback: alphabetical, with a console warning).

**Total**: `match_total + group_total`.

**Tiebreaker preview**: `exact_score_count` is the number of matches where both
scores were exactly right. Surfaced on the leaderboard for transparency and to
seed the v2 tiebreaker chain.

### 8.4 Shared tiebreaker / standings function

```js
computeStandings(groupLetter, matches, fixtures, manualTiebreakers?) → {
  standings: ["MEX", "USA", "CAN", "JAM"],   // 4-team ordered array
  unresolvedTies: [["MEX", "USA"], ...]      // pairs/groups still tied; empty if clean
}
```

`matches` is a `{matchId → {home_score, away_score}}` map. `manualTiebreakers`
is an optional `{[teamCode]: rank}` from a user widget — used by the form to
apply user-chosen ordering for otherwise-tied subsets.

This function is called from **two places** with different inputs:

- **The form** passes the user's predicted match scores. The output drives the
  live "Predicted standings" panel. If `unresolvedTies` is non-empty, the form
  renders the manual tiebreaker widget (§5.3.1) and re-invokes with the user's
  resolution merged in.
- **The scoring engine** passes actual final scores from `results.json`. The
  output is the canonical actual standings for that group, used to score the
  prediction. If the actual results leave a tie at scoring time (extremely
  rare — would require head-to-head goal difference to also tie), we fall
  through to alphabetical with a console warning. Real FIFA fair-play /
  drawing-of-lots are not implemented.

Keeping the derivation in one function guarantees the form and the scoring
engine cannot disagree about how predicted scores would map to standings.

## 9. Leaderboard + my picks view

### 9.1 Data fetch

On load, the leaderboard page fetches in parallel:

1. `fixtures.json` (static).
2. `results.json` (static, updated by cron).
3. `GET <apps_script_url>?action=submissions` — returns latest-per-email submissions,
   with `email` replaced by `email_hash` (SHA-256, hex) in the response so the
   public leaderboard doesn't dox addresses. Pre-lock → returns
   `{ locked: false, submissions: [] }`.

### 9.2 Leaderboard view

- Sorted by `total` desc.
- Columns: rank, name, match points, group points, total, exact-score count.
- Click a row → opens a **modal** with a visual breakdown of that user's picks
  (§9.2.1).
- Top-of-page banner: "Last updated: N min ago" rendered from
  `results.json.updated_at` (stamped by the cron script when it writes the file).

### 9.2.1 Pick-detail modal

A centered modal (closeable via X / Esc / click-outside) rendering the user's
predictions in a visual, scannable layout rather than an inline data table.

Structure:

- **Header**: user's name, total points, exact-score count, rank.
- **12 group cards** stacked or in a 2- or 3-column grid (responsive). Each card
  shows:
  - Group letter + total points earned in that group (matches + standings).
  - **6 match rows**, each rendered as a small scoreboard:
    `[home crest/code]  pred-actual  [away crest/code]`
    The predicted score and actual score sit side-by-side. The whole row gets a
    background tint:
    - **Green** if exact (5 pts earned).
    - **Yellow** if winner-only correct (3 pts).
    - **Red** if wrong (0).
    - **Gray** if the match hasn't kicked off / isn't STATUS_FINAL.
  - **Standings strip** at the bottom of each card: 4 team chips showing the
    user's predicted order, with a green border on chips that match the actual
    standing position. If the group isn't fully complete, render the strip
    grayed-out with a "pending" label.
- **Modal footer**: "Close" button + a deep-link-able URL fragment
  (`#picks/<email_hash>`) so users can share their own card.

The modal reuses the per-submission scoring output from §8.2 — no new
computation, just presentation. Mobile fallback: a single-column stack with
slightly smaller cards.

### 9.3 "My picks" view

- `?email=<address>` query param filter. Anyone with their own email can pull
  up just their card without scrolling. Not real auth — purely convenience.
- Same color-coded breakdown as the leaderboard expansion.

## 10. Apps Script endpoints

Two HTTP endpoints exposed by a single Apps Script web app (`doGet` + `doPost`):

- `POST /exec` — body `{ name, email, secret, picks }`. Behavior per §5.6.
- `GET /exec?action=submissions` — behavior per §9.1. Pre-lock returns empty.

Apps Script script properties (not in source):

- `salt` — random string, used to derive `secret_hash`.
- `group_lock_iso` — authoritative lock time.

## 11. Testing

Scaled to the timeline. The bar is "won't embarrass us on Jun 11," not 100%
coverage.

### 11.1 Automated (must-have before launch)

- **Scoring engine** (`scripts/score.test.js`) — pure functions, fast:
  - Correct winner, wrong score → 3.
  - Correct exact score → 5.
  - Wrong winner → 0.
  - Draws (predicted + actual, both right and both wrong).
  - Group standings: only scores when all 6 group matches are `STATUS_FINAL`.
  - Group: 1st only / 2nd only / both / perfect-order.
  - Pending matches contribute 0 and are flagged as pending (not zero-scored
    permanently).
- **Validator** (`scripts/validate.test.js`):
  - Reject submission missing a match.
  - Reject submission with duplicate team in group standings.
  - Reject submission with non-group team in standings.
  - Accept fully-complete valid submission.
- **Standings derivation** (`scripts/standings.test.js`) — covers the shared
  function in §8.4:
  - Three-way tie at the top resolved by goal difference.
  - Tie resolved by goals scored after points + GD tie.
  - Head-to-head tiebreaker between two teams.
  - Genuinely tied case: returns the tied pair in `unresolvedTies`.
  - `manualTiebreakers` resolves a previously-tied pair.
  - Re-invoking with changed scores returns fresh standings (no hidden state).

Test runner: Node's built-in `node --test`. No extra dependencies.

### 11.2 Manual checks before launch

- End-to-end dry run: submit a complete plausible entry → confirm the row in the
  sheet → run results cron locally with a hand-crafted `results.json` for one
  match → load leaderboard → see correct scoring.
- Lock enforcement: set lock to 1 minute in the future, submit just before / just
  after, confirm correct behavior on both client and server.
- Secret guard: submit twice with same email — first succeeds, second with wrong
  secret returns `secret_mismatch`, third with correct secret succeeds.
- Fixture seed sanity check: `fixtures.json` has 12 groups, 4 unique teams per
  group, 6 matches per group. Total 72 matches.

## 12. Error handling

### 12.1 Form

- **Network failure on submit**: "Couldn't save. Your picks are still here — try
  again." (Form keeps state via localStorage; no data loss.)
- **`secret_mismatch`**: "An entry already exists for this email. The secret you
  provided doesn't match. If this is your entry, use the secret you set before.
  If it's not you, use a different email."
- **`locked`**: "Submissions closed at HH:MM UTC. The leaderboard is live →
  [link]."
- **Validation errors**: inline red under each offending input + a summary block
  at the top with anchor links to each problem.

### 12.2 Results pipeline

- ESPN 5xx or schema drift → workflow exits non-zero → GitHub emails the repo
  owner. Investigate. Hand-edit `results.json` if needed.
- Rate limiting → unlikely at one batch every 2 hours; if it surfaces, increase
  inter-request sleep.
- Manual override path is always "edit the JSON, push." Trust git as the
  audit log.

### 12.3 Leaderboard

- Apps Script GET fails → render "Couldn't load submissions" with a retry button.
  Fixtures + results still render (they're static) so the page isn't blank.

## 13. v2 — Knockout bracket challenge (sketch, not for v1 implementation)

Captured here so v1 doesn't accidentally close doors.

**Scope decision (made 2026-06-07):** v2 is **bracket challenge only**. The
survivor mechanic from the original rules text is dropped. Reduces v2 to a
single submission form, a simpler scoring extension, and no pick-once-then-
eliminate tracking.

### 13.1 The R32 question (content, not code)

The brother's rules describe a Round of 16 → QF → SF → Final flow. The 2026
World Cup format adds a **Round of 32** first (top 2 from each group + best 8 of
12 third-place teams = 32 advancing). Before v2 is built, the commissioner needs
to decide one of:

- (a) Score R32 as an additional round in the bracket.
- (b) Treat R32 as "fixed" — pool starts predicting from R16, brackets are seeded
  with whoever actually advanced from R32.

Default recommendation: **(b)** for simplicity and rule fidelity.

### 13.2 Schema additions

A `phase = 'knockout'` row in the same sheet, with `picks_json` shaped like:

```json
{
  "bracket": {
    "r16": ["TEAM", "..."],
    "qf": ["TEAM", "..."],
    "sf": ["TEAM", "..."],
    "final": ["TEAM", "..."],
    "champion": "TEAM"
  }
}
```

### 13.3 Scoring extensions

Per the rules (bracket-only):

- R16 correct advancer: 2 pts each.
- QF correct advancer: 4 pts each.
- SF correct advancer: 8 pts each.
- Finalist correct: 12 pts each.
- Champion correct: 20 pts.

### 13.4 Tiebreakers

Sort comparator stack:

1. Correct World Cup champion (boolean).
2. Closest prediction for total goals scored in the Final (abs delta).
3. Most exact-score predictions across the tournament (uses
   `exact_score_count`).

## 14. Open decisions for the commissioner (not blocking v1 code)

- **Entry fee** — rules leave it as `$____`. Commissioner sets before launch.
- **Advancement cut** — rules leave it as top N / top N% to v2. Doesn't affect
  v1 since group-stage scoring runs for everyone.
- **R32 handling** — per §13.1.
- **Payout structure** — example in rules is 50 / 25 / 15 / 10. Confirmable
  later; doesn't affect the app.

## 15. Timeline

- **2026-06-07 → 2026-06-10**: build and ship v1. Group-stage submission, lock,
  fixture seed, results plumbing, scoring, leaderboard.
- **2026-06-11 16:00 UTC**: group-stage submissions lock (exact time pinned from
  ESPN's first-match kickoff during seeding).
- **2026-06-11 → 2026-06-27**: group play. v2 (knockout submission UI) built
  during this window.
- **~2026-06-27**: knockout submission opens.
- **~2026-06-28 / 06-29**: knockout submission locks before R32 / R16 kickoff.
- **Through 2026-07-19**: leaderboard runs autonomously on cron until the
  Final.
