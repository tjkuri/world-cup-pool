# UI Restyle — dark sports-app aesthetic + Tailwind + submit modal

Date: 2026-06-07
Status: Approved (brainstorming phase)

## Goal

Restyle the form and leaderboard pages to a dark sports-app aesthetic
(rounded pills, dark slate background, emerald accent), migrate to Tailwind
v4 for faster component iteration in Phase 2, restructure the group-tab
selector as a centered grid, and convert the submission flow from an inline
identity panel into a gated "Review & Submit" modal.

## Non-goals

- Logic changes to standings, scoring, validation, or the Apps Script
  backend. Lib tests (36) must continue to pass unchanged.
- Phase 2 knockout bracket — out of scope; this restyle just makes Phase 2
  faster to build later.
- Replacing the existing tiebreaker drag UX. The two-color tie highlight
  added earlier today carries over; tokens map to Tailwind classes.

## Scope

- Both pages: `index.html` (form) and `leaderboard.html`.
- All components in `src/form/components/`, `src/leaderboard/components/`,
  and `src/shared/`.
- Global stylesheet `src/styles/main.css` (becomes a thin Tailwind entry).
- New file: `src/form/components/SubmitModal.jsx`.
- Removed file: `src/form/components/IdentityPanel.jsx` (logic folded into
  `SubmitModal`).

## Architecture

### Tailwind v4 setup

- Add deps: `tailwindcss@^4`, `@tailwindcss/vite@^4`.
- Add `@tailwindcss/vite` plugin to `vite.config.js`.
- Replace `src/styles/main.css` body with `@import "tailwindcss";` plus a
  small `@theme` block defining custom tokens (see palette below).
- No `tailwind.config.js` required (v4 inlines config in CSS).
- Components stop importing the old class names and use utility classes
  directly in JSX.

### Color palette

Dark sports-app theme, exposed as Tailwind theme tokens:

| Purpose | Tailwind class | Hex |
|---|---|---|
| Page background | `bg-slate-950` | `#020617` |
| Card / panel surface | `bg-slate-900` | `#0f172a` |
| Input / pill base / secondary button | `bg-slate-800` | `#1e293b` |
| Primary text | `text-slate-100` | `#f1f5f9` |
| Muted text | `text-slate-400` | `#94a3b8` |
| Dividers / input borders | `border-slate-700` | `#334155` |
| Primary accent (active tab, CTA) | `bg-emerald-500` | `#10b981` |
| Tie subset 0 (existing yellow) | `bg-amber-400/20` `ring-amber-400` | — |
| Tie subset 1 (existing blue) | `bg-blue-400/20` `ring-blue-400` | — |
| Error / lock | `bg-rose-500` / `text-rose-400` | — |

Accent is emerald to read "sports/live" without leaning into red/white/blue
(which carry national-team associations during a World Cup).

### Group tabs — centered grid

Replace the existing `flex flex-wrap` layout with a responsive grid:

| Breakpoint | Columns | Rows for 12 groups |
|---|---|---|
| `>= 768px` (md) | 6 | 2 |
| `>= 480px` (sm) | 4 | 3 |
| default (mobile) | 3 | 4 |

- Container: `grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-w-2xl mx-auto`.
- Each tab: `rounded-full px-4 py-2 text-sm font-medium transition-colors`.
- States:
  - Empty: `bg-slate-800 text-slate-400`
  - Partial: `bg-slate-800 text-amber-300 ring-1 ring-amber-500/40` (dot indicator stays)
  - Complete: `bg-slate-800 text-emerald-300 ring-1 ring-emerald-500/40` (check stays)
  - Active: `bg-emerald-500 text-slate-950 font-semibold` (regardless of completion state)
- Tabs stay at least ~40px tall on mobile for touch.

### Submit modal + gating

**Trigger button** replaces the inline `IdentityPanel`. Lives at the bottom
of the form body:

- Not ready: `Review & Submit (N/12 groups ready)`, `bg-slate-800
  text-slate-500 cursor-not-allowed`, `disabled`.
- Ready: `Review & Submit`, `bg-emerald-500 text-slate-950 font-semibold
  rounded-full px-6 py-3 hover:bg-emerald-400`.
- "Ready" condition: for all 12 groups, `resolveGroupStandings` returns
  `allFilled === true` AND `unresolvedTies.length === 0`. Computed via a new
  `useReadyCount(state, fixtures)` hook so the count is reactive.

**Modal** is a new component `src/form/components/SubmitModal.jsx` using the
native `<dialog>` element with `dialog.showModal()`. Native dialog provides
keyboard Escape, focus trap, and backdrop dismissal automatically.

Layout (top to bottom):

1. Header: title `Review your picks` + close `[×]` button.
2. Compact pick recap: 12 read-only rows, one per group. Format:
   `A · BRA · GER · NED · KSA` using the resolved standings order.
3. Identity form: name, email (lowercased), secret (password), acknowledgment
   checkbox — same fields and same dispatch actions as today's
   `IdentityPanel`.
4. Footer: `Cancel` (closes modal) and `Submit picks` (calls existing
   `submitPicks` from `src/form/submit.js`).
5. Inline submit-state error displayed inside the modal footer when
   `state.submitState === 'error'`.

**On success:** modal closes (or unmounts) and `SubmittedView` replaces the
form, identical to current behavior.

**Recap content** is computed from `state.matches` + resolved standings.
Read-only — to fix a mistake the user closes the modal, edits, and reopens.

### Other components (mechanical palette migration)

These get utility-class rewrites with no behavior change:

- `TopBar`: dark bar with emerald hover on nav links/buttons.
- `ProgressBar`: dark track, emerald fill.
- `LockBanner`: rose tint instead of plain red.
- `MatchInputs`: dark input fields with slate-700 borders, emerald focus
  ring.
- `PredictedStandings`: slate-900 panel surface. Tie highlights map from the
  existing yellow/blue to amber-400/20 and blue-400/20 with matching ring
  colors. Drag handle and rank text get appropriate muted colors.
- `ErrorSummary`: rose-tinted card with rose-400 text.
- `RulesDrawer`: slate-900 surface with slate-700 dividers.
- `SubmittedView`: slate-900 card with emerald headline.
- Leaderboard table + `PickModal`: same palette tokens. Header row
  `bg-slate-900`, body rows `bg-slate-950` with `hover:bg-slate-900`,
  borders `border-slate-700`.

## Data flow

No state-shape changes. The new ready-count is derived, not stored. The
modal reads existing `state.identity` and dispatches existing
`SET_IDENTITY`, `SET_SUBMIT_STATE`, etc. actions.

## Error handling

- Modal opens only when the form is in a submittable state, so we don't show
  validation errors inside the modal at open time.
- Submit failures display inline in the modal footer (existing
  `state.submitState === 'error'` + `state.submitMessage` path).
- If state somehow becomes invalid while the modal is open (e.g., another
  tab changes scores via storage event — currently not handled), the
  existing server-side validation still rejects. Out of scope to detect
  client-side.

## Testing

- No new lib tests; lib is untouched.
- Manual smoke tests after migration:
  - All 12 group tabs render in the new grid layout at each breakpoint.
  - Tab state transitions (empty → partial → complete → active) show the
    correct ring color.
  - Tie drag still works; two simultaneous ties still show distinct
    highlight colors.
  - "Review & Submit" stays disabled with the correct count until every
    group is resolved.
  - Modal opens, traps focus, closes on Escape and backdrop click.
  - Identity inputs in the modal write to and read from `state.identity`
    correctly (HMR test: enter a name, close modal, reopen — value persists).
  - Submit happy path: modal closes, `SubmittedView` shown.
  - Submit error path: error displayed inside modal footer, modal stays
    open.
  - Leaderboard page renders with the dark palette and matches the form
    visually.

## File map (deltas)

```
package.json                                    # +tailwindcss, +@tailwindcss/vite
vite.config.js                                  # +tailwindcss vite plugin
src/styles/main.css                             # rewritten: @import + @theme block
src/form/App.jsx                                # IdentityPanel → SubmitModal
src/form/components/IdentityPanel.jsx           # DELETED
src/form/components/SubmitModal.jsx             # NEW
src/form/components/GroupTabs.jsx               # grid layout, pill states
src/form/components/PredictedStandings.jsx      # utility classes, tie highlights
src/form/components/MatchInputs.jsx             # utility classes
src/form/components/TopBar.jsx                  # utility classes
src/form/components/ProgressBar.jsx             # utility classes
src/form/components/LockBanner.jsx              # utility classes
src/form/components/ErrorSummary.jsx            # utility classes
src/form/components/SubmittedView.jsx           # utility classes
src/leaderboard/components/LeaderboardTable.jsx # utility classes
src/leaderboard/components/PickModal.jsx        # utility classes
src/shared/RulesDrawer.jsx                      # utility classes
```

Lib (`lib/*`), scripts, apps_script, and config files are unchanged.

## Open questions

None at design time. Tailwind v4's `@theme` syntax for custom tokens is the
only thing worth double-checking against the current Tailwind v4 docs when
implementation starts (small risk of API drift since v4 is recent).
