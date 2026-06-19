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

- **v2 knockout lives on `feat/v2-knockout-bracket`, not merged.** Don't merge
  to `main` until the go-live runbook in `docs/HANDOFF.md` runs (~Jun 27): it
  needs `public/knockout.json` seeded and a `knockout_lock_iso` Apps Script
  script property set, or knockout POSTs return `400 lock_unset`. Merging early
  would deploy `bracket.html` live before the backend can accept submissions.
