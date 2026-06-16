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
  Knockout drilldown (`KnockoutPicks.jsx`) colors slots hit/miss by comparing the
  player's `advances` to the actual advancer — it does NOT hardcode point
  thresholds. The shared score-input className lives in `src/shared/scoreInput.js`
  (used by both the group form and the bracket); change it in one place.
