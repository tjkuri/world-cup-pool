# Project-specific notes for Claude

For overall project context, scoring rules, file map, and pending work,
read `docs/HANDOFF.md` first — it's the source of truth.

## Gotchas to remember

- **Scoring point literals are duplicated across `lib/` and `src/`.** The
  values live in `lib/score.js` as constants, but `src/leaderboard/components/PickModal.jsx`
  has hardcoded literals (`pts === 3` for winner-only, `pts >= 6` for exact)
  that determine row coloring/flair. **If you change a scoring constant in
  `lib/score.js`, grep `src/` for `pts ===` to catch downstream renderers
  that haven't been updated.** We got bitten by this once already — exact
  picks were rendered as "wrong" (red) for hours after a scoring bump.

- **Apps Script redeploy is manual.** Editing `apps_script/Code.gs` in the
  repo does nothing on its own — the user has to paste it into the Google
  Apps Script editor and create a new deployment version. URL stays the
  same on redeploy. Flag this clearly when you make backend changes so
  the user knows they have a manual step.

- **Knockout flair uses `lib/score.js` constants, not literals.** The leaderboard
  Knockout drilldown (`KnockoutPicks.jsx`) and the knockout `MatchModal` color
  cells via `scoreKnockoutMatch()` (exported from `lib/score.js`) and by comparing
  the player's `advances` to the actual advancer — they do NOT hardcode point
  thresholds (unlike the group `pts === 3` / `pts >= 6` literals above). If you
  change a knockout point constant, the renderers pick it up automatically via
  `scoreKnockoutMatch`. The shared score-input className lives in
  `src/shared/scoreInput.js` (group form + bracket); change it in one place.

- **v2 knockout is LIVE on `main`.** Go-live ran 2026-06-27→29; all 24 brackets
  in, revealed, submissions locked. See `docs/HANDOFF.md` → "Knockout live-ops".

- **`knockout_lock_iso` is intentionally desynced between config and Apps Script.**
  One ISO controls TWO things in the backend: submission-lock (doPost) AND reveal
  (doGet hides knockout picks until it passes). The Apps Script property is in the
  PAST (locked + revealed); `public/config.json`'s copy is in the FUTURE (keeps the
  bracket form UI open). This is deliberate — it keeps brackets revealed/locked
  while letting a single straggler still submit via the `knockout_open_email`
  allowlist property (+ `knockout_submissions_closed` flag). **Don't "fix" them to
  match.**

- **Bracket slots number by FIFA `matchNumber`, not ESPN match-id.** ESPN feeder
  refs ("Round of 32 N Winner") number by `matchNumber` (R32 = 73–88), which is NOT
  id order. `scripts/seed-knockout.mjs` fetches `matchNumber` per match from ESPN's
  core API to wire the tree; numbering by id puts teams in the wrong half. Covered
  by `scripts/seed-knockout.test.mjs` (RSA/BRA opposite-halves regression).

- **Late-edit audit.** The deadline was extended past the first R32 kickoff with a
  "picks for already-started matches are voided" rule, enforced manually via
  `node scripts/audit-late-edits.mjs <sheet.tsv>` (export the sheet to TSV — the
  API only returns the latest row per player, the TSV has full history).

- **`grep` treats `Code.gs` as binary** (em-dash in a comment). Use `grep -a` or sed.
