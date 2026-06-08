# UI Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the form and leaderboard pages to Tailwind v4 with a dark sports-app aesthetic, restructure the group tabs as a centered grid, and replace the inline identity panel with a gated "Review & Submit" modal.

**Architecture:** Tailwind v4 via the Vite plugin (no config file needed). All component styling moves from `src/styles/main.css` to utility classes in JSX. Tailwind's built-in `slate-*`, `emerald-*`, `amber-*`, `blue-*`, `rose-*` palettes provide all colors — no custom tokens required. The submit button at the bottom of the form opens a native `<dialog>` modal containing a compact pick recap plus the existing identity inputs.

**Tech Stack:** React 19, Vite 6, Tailwind v4 (`tailwindcss` + `@tailwindcss/vite`), native `<dialog>` element.

**Important context for the implementer:**

- This project has lib tests (`npm test` = `node --test lib/*.test.js`) but no automated UI tests. Verification for visual tasks = run `npm run dev`, open `http://localhost:5173/` and `http://localhost:5173/leaderboard.html`, eyeball the change.
- TDD doesn't apply to CSS-only changes. Where logic is involved (the ready-count gating, the new modal component's state behavior), test through the rendered UI manually.
- `npm test` should keep passing all 36 lib tests through every commit — re-run after each task.
- Commit after each completed task. Use the existing commit-message style (`git log --oneline -20` to see prior messages).
- HMR is on; most CSS changes appear in the browser without a manual reload.

---

## Task 1: Set up Tailwind v4

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Modify: `src/styles/main.css`

- [ ] **Step 1: Verify current Tailwind v4 setup syntax with context7**

Use the context7 MCP server: `mcp__context7__resolve-library-id "tailwindcss"` then `mcp__context7__query-docs` for "v4 vite plugin setup". Confirm the package name `@tailwindcss/vite` and the `@import "tailwindcss"` directive are still current.

- [ ] **Step 2: Install Tailwind v4 deps**

Run: `npm install -D tailwindcss@^4 @tailwindcss/vite@^4`
Expected: both packages added to `devDependencies` in `package.json`, no peer-dep errors.

- [ ] **Step 3: Wire the Tailwind plugin into vite.config.js**

Modify `vite.config.js`. Read the current file first to see its structure (multi-page rollup config). Add at the top:

```js
import tailwindcss from '@tailwindcss/vite';
```

Add `tailwindcss()` to the `plugins` array in the `defineConfig` block.

- [ ] **Step 4: Replace the body of src/styles/main.css**

Overwrite `src/styles/main.css` with just:

```css
@import "tailwindcss";

html, body { height: 100%; }
body { font-family: system-ui, -apple-system, sans-serif; }
```

This deletes all existing custom CSS. From this point until the relevant component tasks complete, the UI will look unstyled — that's expected.

- [ ] **Step 5: Start the dev server and confirm Tailwind loads**

Run: `npm run dev`
Expected: server starts on `http://localhost:5173/` with no errors. Open the form page; classes like `bg-slate-950` won't be in use yet, so it'll look bare HTML — that's fine. Open DevTools and confirm Tailwind's reset styles are present (margins collapsed, etc).

- [ ] **Step 6: Confirm lib tests still pass**

Run: `npm test`
Expected: 36 tests pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.js src/styles/main.css
git commit -m "chore: set up Tailwind v4 via Vite plugin"
```

---

## Task 2: Restyle the form shell — body, TopBar, ProgressBar, LockBanner

**Files:**
- Modify: `index.html` (body background needs to set so first paint is dark, not white)
- Modify: `src/form/App.jsx` (the `<main>` wrapper)
- Modify: `src/form/components/TopBar.jsx`
- Modify: `src/form/components/ProgressBar.jsx`
- Modify: `src/form/components/LockBanner.jsx`

- [ ] **Step 1: Set the body background in index.html**

Modify `index.html`. On the `<body>` tag, add `class="bg-slate-950 text-slate-100"`. Without this, the first paint flashes white before React mounts.

Also update `leaderboard.html` with the same body class (do it now to avoid a second commit later).

- [ ] **Step 2: Restyle the main wrapper in App.jsx**

Read `src/form/App.jsx`. Find the `<main>` elements in `FormBody` (both the locked and unlocked branches, plus the submitted view). Change each `<main>` opening tag to:

```jsx
<main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
```

Remove any inline `style` props on `<main>` if present.

- [ ] **Step 3: Restyle TopBar**

Read `src/form/components/TopBar.jsx`. Replace its outer `<header>`/`<div>` and nav classes with Tailwind utilities. The shape should be:

```jsx
<header className="border-b border-slate-800 bg-slate-900">
  <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
    <h1 className="text-base font-semibold text-slate-100">{pageLabel}</h1>
    <nav className="ml-auto flex items-center gap-2">
      <a
        className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
        href={otherPage}
      >
        {otherLabel}
      </a>
      <button
        type="button"
        className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
        onClick={onOpenRules}
      >
        Rules
      </button>
    </nav>
    {children}
  </div>
</header>
```

Preserve the existing prop names and the `{children}` slot (used for LockBanner).

- [ ] **Step 4: Restyle ProgressBar**

Read `src/form/components/ProgressBar.jsx`. The current bar is sticky at the top of `<main>`. Keep the sticky behavior; restyle the container and fill:

```jsx
<div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
    <div
      className="h-full rounded-full bg-emerald-500 transition-[width]"
      style={{ width: `${pct}%` }}
    />
  </div>
  <span className="text-sm tabular-nums text-slate-400">{filled}/{total}</span>
</div>
```

Match the variable names already in the file (`pct`, `filled`, `total` may differ — adapt to what's actually there).

- [ ] **Step 5: Restyle LockBanner**

Read `src/form/components/LockBanner.jsx`. The banner is rendered inside TopBar's `{children}` slot. Replace its outer class with:

```jsx
<div className="w-full rounded-md bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/30">
  {/* existing inner content */}
</div>
```

- [ ] **Step 6: Smoke test**

Reload `http://localhost:5173/`. Expected: dark page, dark top bar with rounded-pill buttons, slate progress bar with emerald fill. The form body below will still look unstyled until later tasks — that's fine.

- [ ] **Step 7: Commit**

```bash
git add index.html leaderboard.html src/form/App.jsx src/form/components/TopBar.jsx src/form/components/ProgressBar.jsx src/form/components/LockBanner.jsx
git commit -m "feat: dark theme for form shell (top bar, progress, lock banner)"
```

---

## Task 3: GroupTabs — centered grid with pill states

**Files:**
- Modify: `src/form/components/GroupTabs.jsx`

- [ ] **Step 1: Read the current component**

Read `src/form/components/GroupTabs.jsx`. Confirm the `completionStatus` helper, the `letters.map` over groups, and the existing `cls` builder.

- [ ] **Step 2: Replace the container and pill classes**

Replace the JSX inside `GroupTabs` with:

```jsx
return (
  <div className="mx-auto mb-4 grid max-w-2xl grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
    {letters.map((letter) => {
      const status = completionStatus(letter, state.matches, fixtures);
      const isActive = state.activeGroup === letter;

      const base = 'inline-flex items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-10';
      let colors;
      if (isActive) {
        colors = 'bg-emerald-500 text-slate-950 font-semibold';
      } else if (status === 'complete') {
        colors = 'bg-slate-800 text-emerald-300 ring-1 ring-inset ring-emerald-500/40 hover:bg-slate-700';
      } else if (status === 'partial') {
        colors = 'bg-slate-800 text-amber-300 ring-1 ring-inset ring-amber-500/40 hover:bg-slate-700';
      } else {
        colors = 'bg-slate-800 text-slate-400 hover:bg-slate-700';
      }

      const indicator = status === 'complete' ? '✓' : status === 'partial' ? '●' : '';
      return (
        <button
          key={letter}
          type="button"
          className={`${base} ${colors}`}
          onClick={() => dispatch({ type: 'SET_ACTIVE_GROUP', letter })}
        >
          <span>Group {letter}</span>
          {indicator && <span className="text-xs">{indicator}</span>}
        </button>
      );
    })}
  </div>
);
```

- [ ] **Step 3: Smoke test**

Reload. Expected: 12 pills, two rows of 6 on desktop, 3 of 4 at tablet width, 4 of 3 at mobile width. Empty tabs are dim slate; complete tabs show emerald check; partial show amber dot; active is solid emerald.

- [ ] **Step 4: Commit**

```bash
git add src/form/components/GroupTabs.jsx
git commit -m "feat: group tabs as centered responsive pill grid"
```

---

## Task 4: MatchInputs + ErrorSummary

**Files:**
- Modify: `src/form/components/MatchInputs.jsx`
- Modify: `src/form/components/ErrorSummary.jsx`

- [ ] **Step 1: Read both files**

Read both. Note the prop shapes and the existing class names. The match-input row currently uses `match-row`, score inputs use `score-input`, etc.

- [ ] **Step 2: Restyle MatchInputs**

In the rendered row, replace classes. The list wrapper:

```jsx
<ol className="space-y-2">
  {/* rows */}
</ol>
```

Each row:

```jsx
<li className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
  <span className="flex-1 text-right text-sm text-slate-200">{home}</span>
  <input
    type="number"
    min="0"
    inputMode="numeric"
    value={homeScore ?? ''}
    onChange={onHomeChange}
    className="w-12 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-center text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
  />
  <span className="text-slate-500">–</span>
  <input
    type="number"
    min="0"
    inputMode="numeric"
    value={awayScore ?? ''}
    onChange={onAwayChange}
    className="w-12 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-center text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
  />
  <span className="flex-1 text-sm text-slate-200">{away}</span>
</li>
```

Adapt variable names (`home`, `away`, `homeScore`, `awayScore`, `onHomeChange`, `onAwayChange`) to whatever the file actually uses.

- [ ] **Step 3: Restyle ErrorSummary**

Replace its outer container:

```jsx
<div className="mb-3 rounded-md bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
  <strong className="text-rose-200">Please fix the following:</strong>
  <ul className="mt-1 list-disc pl-5">
    {errors.map((e) => <li key={e.id || e.message}>{e.message}</li>)}
  </ul>
</div>
```

(Adapt the iteration shape to whatever the file's `errors` prop actually contains. If it's already a flat list, that's fine — if it's grouped, preserve the grouping.)

- [ ] **Step 4: Smoke test**

Enter some scores. Expected: rows are slate cards with emerald-focused number inputs. To trigger an error summary, leave a group incomplete and try to submit (will fail naturally without all groups filled — that's enough to see the styled component).

- [ ] **Step 5: Commit**

```bash
git add src/form/components/MatchInputs.jsx src/form/components/ErrorSummary.jsx
git commit -m "feat: dark-theme match inputs and error summary"
```

---

## Task 5: PredictedStandings — including tie highlight migration

**Files:**
- Modify: `src/form/components/PredictedStandings.jsx`

This is the trickiest cosmetic task because the tie-highlight logic added today is currently driven by CSS classes (`tie-0`, `tie-1`) plus `.draggable`. Move those mappings into the JSX directly.

- [ ] **Step 1: Re-read the current file**

Read `src/form/components/PredictedStandings.jsx`. Confirm the `tieIndexByTeam` map, the `SortableRow` props (`draggable`, `tieIndex`), and the existing `cls` builder.

- [ ] **Step 2: Restyle the outer panel and hint text**

Replace the outer `<div className="standings-panel">` with:

```jsx
<div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
    Predicted standings — Group {letter}
  </h3>
  {/* hint paragraphs */}
</div>
```

Hint paragraphs use `className="mb-3 text-sm text-slate-400"` and inline emphasis uses `<strong className="text-slate-200">`.

- [ ] **Step 3: Restyle the SortableRow component**

Replace the `<li>` className builder in `SortableRow` with explicit Tailwind classes per state. Inside `SortableRow`:

```jsx
const tieBg = !draggable
  ? 'bg-slate-900'
  : tieIndex === 1
  ? 'bg-blue-400/15 ring-1 ring-inset ring-blue-400/50 border-l-4 border-blue-400'
  : 'bg-amber-400/15 ring-1 ring-inset ring-amber-400/50 border-l-4 border-amber-400';

const cls = [
  'flex items-center gap-3 rounded-md px-3 py-2 select-none touch-manipulation',
  tieBg,
  isDragging && 'opacity-40 shadow-lg',
].filter(Boolean).join(' ');
```

The `<ol>` wrapper becomes:

```jsx
<ol className="space-y-1.5">
```

Grip span:

```jsx
{draggable ? (
  <span
    className="w-5 text-center text-lg text-slate-400 cursor-grab touch-none"
    {...attributes}
    {...listeners}
    aria-label="Drag to reorder"
  >⠿</span>
) : (
  <span className="w-5" aria-hidden></span>
)}
```

Rank + team:

```jsx
<span className="w-6 tabular-nums text-slate-400">{rank}.</span>
<span className="text-slate-100 font-medium">{id}</span>
```

- [ ] **Step 4: Smoke test the tie highlights**

Manually create:
- A group with no ties → all 4 rows slate, no drag handles.
- A group with a single 2-team tie → those 2 rows amber.
- A group with two separate 2-team ties → first tied subset amber, second tied subset blue. Confirm drag still works within each subset.

- [ ] **Step 5: Commit**

```bash
git add src/form/components/PredictedStandings.jsx
git commit -m "feat: dark-theme standings panel, port tie highlights to Tailwind"
```

---

## Task 6: SubmittedView + RulesDrawer

**Files:**
- Modify: `src/form/components/SubmittedView.jsx`
- Modify: `src/shared/RulesDrawer.jsx`

- [ ] **Step 1: Read both files**

Read `src/form/components/SubmittedView.jsx` and `src/shared/RulesDrawer.jsx`.

- [ ] **Step 2: Restyle SubmittedView**

Replace its outer container and headline:

```jsx
<div className="mx-auto max-w-md rounded-lg border border-emerald-500/40 bg-slate-900 p-6 text-center">
  <h2 className="mb-2 text-xl font-semibold text-emerald-300">Picks submitted</h2>
  <p className="text-slate-300">Submitted {new Date(submittedAt).toLocaleString()}.</p>
  {/* keep any existing secondary text / links, just restyle classes */}
</div>
```

- [ ] **Step 3: Restyle RulesDrawer**

The drawer is a slide-in panel. Replace its outer/inner containers:

```jsx
<div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
  <aside
    className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-800"
    onClick={(e) => e.stopPropagation()}
  >
    <button
      type="button"
      className="mb-4 rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
      onClick={onClose}
    >
      Close
    </button>
    <h2 className="mb-3 text-lg font-semibold text-slate-100">Rules</h2>
    <div className="prose prose-invert prose-sm">{/* existing rule content */}</div>
  </aside>
</div>
```

Preserve existing rule body content; just change the wrappers.

- [ ] **Step 4: Smoke test**

Open the rules drawer from the top bar — it should slide in with a dark backdrop. Submit a complete form (you can leave that for the next task if you don't have a full set of picks yet; SubmittedView re-styling is cosmetic and can be eyeballed in DevTools by temporarily forcing the state).

- [ ] **Step 5: Commit**

```bash
git add src/form/components/SubmittedView.jsx src/shared/RulesDrawer.jsx
git commit -m "feat: dark theme for rules drawer and submitted view"
```

---

## Task 7: Build the SubmitModal component

**Files:**
- Create: `src/form/components/SubmitModal.jsx`
- Create: `src/form/useReadyCount.js`

This is the biggest task. It introduces a new component plus a derived hook for the gating count. We will NOT wire it into `App.jsx` yet — that's Task 8.

- [ ] **Step 1: Create the useReadyCount hook**

Create `src/form/useReadyCount.js`:

```js
import { useMemo } from 'react';
import { resolveGroupStandings } from './resolveStandings.js';

/**
 * Returns { ready, total } where `ready` counts groups that have all 6
 * scores entered AND no unresolved ties. `total` is the number of groups
 * in fixtures.
 */
export function useReadyCount(state, fixtures) {
  return useMemo(() => {
    const letters = Object.keys(fixtures.groups);
    let ready = 0;
    for (const letter of letters) {
      const { allFilled, unresolvedTies } = resolveGroupStandings(letter, state, fixtures);
      if (allFilled && unresolvedTies.length === 0) ready++;
    }
    return { ready, total: letters.length };
  }, [state, fixtures]);
}
```

- [ ] **Step 2: Create the SubmitModal component skeleton**

Create `src/form/components/SubmitModal.jsx`:

```jsx
import { useEffect, useRef } from 'react';
import { useFormState } from '../state.jsx';
import { useReadyCount } from '../useReadyCount.js';
import { resolveGroupStandings } from '../resolveStandings.js';
import { submitPicks } from '../submit.js';

export function SubmitModal({ fixtures, appsScriptUrl, onClearDraft }) {
  const { state, dispatch } = useFormState();
  const { ready, total } = useReadyCount(state, fixtures);
  const dialogRef = useRef(null);
  const isReady = ready === total;
  const submitting = state.submitState === 'submitting';

  function openModal() {
    if (!isReady) return;
    dialogRef.current?.showModal();
  }

  function closeModal() {
    dialogRef.current?.close();
  }

  // Close the modal automatically once the submission succeeds.
  useEffect(() => {
    if (state.submitState === 'submitted') {
      dialogRef.current?.close();
    }
  }, [state.submitState]);

  const id = state.identity;
  const setId = (patch) => dispatch({ type: 'SET_IDENTITY', patch });

  const triggerClass = isReady
    ? 'rounded-full bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400'
    : 'cursor-not-allowed rounded-full bg-slate-800 px-6 py-3 font-semibold text-slate-500';

  const recapRows = Object.keys(fixtures.groups).sort().map((letter) => {
    const { standings } = resolveGroupStandings(letter, state, fixtures);
    return { letter, standings };
  });

  return (
    <div className="mt-6 flex justify-center">
      <button type="button" className={triggerClass} disabled={!isReady} onClick={openModal}>
        {isReady ? 'Review & Submit' : `Review & Submit (${ready}/${total} groups ready)`}
      </button>

      <dialog
        ref={dialogRef}
        className="rounded-lg bg-slate-900 p-0 text-slate-100 backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm w-[min(90vw,520px)]"
        onClose={() => dispatch({ type: 'SET_SUBMIT_STATE', submitState: 'idle', submitMessage: null })}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-base font-semibold">Review your picks</h2>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >×</button>
        </div>

        <div className="border-b border-slate-800 px-5 py-3 max-h-48 overflow-y-auto">
          <ul className="space-y-1 text-sm">
            {recapRows.map(({ letter, standings }) => (
              <li key={letter} className="font-mono text-slate-200">
                <span className="text-emerald-300">{letter}</span>
                <span className="text-slate-500"> · </span>
                {standings.join(' · ')}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 px-5 py-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Name</span>
            <input
              type="text"
              value={id.name}
              onChange={(e) => setId({ name: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Email</span>
            <input
              type="email"
              value={id.email}
              onChange={(e) => setId({ email: e.target.value.toLowerCase() })}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Secret (min 4 chars)</span>
            <input
              type="password"
              value={id.secret}
              onChange={(e) => setId({ secret: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>

          <label className="flex items-start gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={id.acknowledged}
              onChange={(e) => setId({ acknowledged: e.target.checked })}
              className="mt-1"
            />
            <span>I understand my secret protects my picks. Save it somewhere.</span>
          </label>

          {state.submitState === 'error' && state.submitMessage && (
            <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30">
              {state.submitMessage}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submitPicks({ state, fixtures, appsScriptUrl, dispatch, onClearDraft })}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          >
            {submitting ? 'Submitting…' : 'Submit picks'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
```

- [ ] **Step 3: Verify the file compiles**

Save. Vite HMR will pick up the new file (won't render anywhere yet). Check the browser console for any syntax errors.

- [ ] **Step 4: Confirm lib tests still pass**

Run: `npm test`
Expected: 36 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/form/components/SubmitModal.jsx src/form/useReadyCount.js
git commit -m "feat: add SubmitModal component and useReadyCount hook (not yet wired)"
```

---

## Task 8: Wire SubmitModal into App.jsx, remove IdentityPanel

**Files:**
- Modify: `src/form/App.jsx`
- Delete: `src/form/components/IdentityPanel.jsx`

- [ ] **Step 1: Update App.jsx imports**

In `src/form/App.jsx`, replace:

```jsx
import { IdentityPanel } from './components/IdentityPanel.jsx';
```

with:

```jsx
import { SubmitModal } from './components/SubmitModal.jsx';
```

- [ ] **Step 2: Replace the IdentityPanel usage**

Find the `<IdentityPanel ... />` JSX inside `FormBody` (in the non-locked, non-submitted branch). Replace with:

```jsx
<SubmitModal
  fixtures={fixtures}
  appsScriptUrl={config.apps_script_url}
  onClearDraft={clearDraft}
/>
```

- [ ] **Step 3: Delete the old IdentityPanel file**

```bash
rm src/form/components/IdentityPanel.jsx
```

- [ ] **Step 4: Smoke test the full flow**

Reload `http://localhost:5173/`:
- With no scores entered, the trigger button shows `Review & Submit (0/12 groups ready)`, disabled appearance (slate, not emerald).
- Fill one group fully (and resolve any tie). Counter increments to `1/12`.
- Fill all 12 groups. Button becomes emerald, label drops the counter.
- Click it: modal opens. Verify:
  - Recap shows all 12 groups in `A · TEAM1 · TEAM2 · TEAM3 · TEAM4` format.
  - Escape closes the modal; clicking the backdrop closes it.
  - Identity inputs accept text and persist if you close and reopen.
- Try submitting with empty identity: the existing server-side validation should reject; error appears inside the modal footer.
- Submit with valid identity: modal closes, `SubmittedView` shown.

(Note: to test the unhappy path without poking the live Apps Script, you can temporarily set `apps_script_url` in `public/config.json` to a bogus URL and revert afterward. Or test against the real backend with a throwaway identity.)

- [ ] **Step 5: Confirm lib tests still pass**

Run: `npm test`

- [ ] **Step 6: Commit**

```bash
git add src/form/App.jsx
git rm src/form/components/IdentityPanel.jsx
git commit -m "feat: gate submit behind Review & Submit modal, remove IdentityPanel"
```

---

## Task 9: Leaderboard page restyle

**Files:**
- Modify: `src/leaderboard/App.jsx`
- Modify: `src/leaderboard/components/LeaderboardTable.jsx`
- Modify: `src/leaderboard/components/PickModal.jsx`

- [ ] **Step 1: Read all three files**

Read each. Note prop shapes and existing class names.

- [ ] **Step 2: Restyle the leaderboard main wrapper**

In `src/leaderboard/App.jsx`, change the `<main>` wrapper to:

```jsx
<main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
```

(TopBar and any other shared chrome were already restyled in Task 2.)

- [ ] **Step 3: Restyle LeaderboardTable**

Replace the table classes:

```jsx
<table className="w-full border-collapse text-sm">
  <thead>
    <tr className="border-b border-slate-700 bg-slate-900 text-slate-300">
      <th className="px-3 py-2 text-left font-medium">Rank</th>
      <th className="px-3 py-2 text-left font-medium">Player</th>
      <th className="px-3 py-2 text-right font-medium">Points</th>
      {/* whatever other columns exist */}
    </tr>
  </thead>
  <tbody>
    {rows.map((r) => (
      <tr
        key={r.id}
        className="border-b border-slate-800 hover:bg-slate-900 cursor-pointer"
        onClick={() => onPickClick(r)}
      >
        <td className="px-3 py-2 tabular-nums text-slate-400">{r.rank}</td>
        <td className="px-3 py-2 text-slate-100">{r.name}</td>
        <td className="px-3 py-2 text-right tabular-nums text-emerald-300">{r.points}</td>
        {/* other cells */}
      </tr>
    ))}
  </tbody>
</table>
```

Adapt column set to the file's actual schema.

- [ ] **Step 4: Restyle PickModal**

Replace its outer container and inner sections similar to `SubmitModal` (`<dialog>` with `rounded-lg bg-slate-900` etc), or — if `PickModal` already uses a non-dialog overlay div — restyle in place. Read the file first to decide.

Match the SubmitModal palette for consistency: slate-900 surface, slate-700 borders, emerald accents, rose error states.

- [ ] **Step 5: Smoke test the leaderboard**

Open `http://localhost:5173/leaderboard.html`. Expected: dark table, emerald point values, rows highlight on hover. Click a row → PickModal opens with dark styling.

- [ ] **Step 6: Commit**

```bash
git add src/leaderboard/App.jsx src/leaderboard/components/LeaderboardTable.jsx src/leaderboard/components/PickModal.jsx
git commit -m "feat: dark theme for leaderboard page and pick modal"
```

---

## Task 10: Final cleanup and full smoke test

**Files:**
- Verify: `src/styles/main.css`
- Verify: `dist/` build output

- [ ] **Step 1: Confirm main.css has no leftover custom CSS**

Read `src/styles/main.css`. It should contain only the `@import "tailwindcss";` line plus the small html/body base rules from Task 1. If any old custom CSS leaked back in, remove it.

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: build completes with no errors, `dist/assets/*.css` is produced and contains Tailwind utilities only (no legacy class names like `.tab`, `.standings-row`, `.identity-panel`).

To verify class names are gone, search the built CSS:

```bash
grep -E '\.(standings-row|identity-panel|tab |tab\.)' dist/assets/*.css || echo "clean"
```

Expected: prints `clean`.

- [ ] **Step 3: Run all lib tests**

Run: `npm test`
Expected: 36 tests pass.

- [ ] **Step 4: Full manual smoke test**

Open `http://localhost:5173/` and walk through:
1. Fill all 12 groups with scores. Tabs transition empty → partial → complete.
2. Trigger at least one two-way tie and one group with two separate two-way ties. Drag handles work, two distinct colors visible.
3. Trigger button shows the running count, then unlocks when `12/12 ready`.
4. Open modal: recap renders, Escape + backdrop dismiss, inputs persist.
5. Submit (against the real backend or a throwaway). Modal closes, SubmittedView renders.
6. Open `/leaderboard.html`. Dark table, hover state, PickModal opens darkly.
7. Resize browser to mobile width. Group tabs collapse to 3 columns × 4 rows. Match input rows wrap acceptably. Modal stays centered and scrolls.

Take screenshots of each page state for posterity.

- [ ] **Step 5: Update docs/HANDOFF.md**

Read `docs/HANDOFF.md`. Update the "Currently in progress" section to mark the UI restyle complete and add Tailwind v4 to the tech stack section. Update the "Pending items" table — strike the tiebreaker entry, add any new follow-ups discovered during the restyle.

- [ ] **Step 6: Commit and (optionally) push**

```bash
git add docs/HANDOFF.md
git commit -m "docs: update handoff after UI restyle"
```

Don't push without user approval — Cloudflare Pages auto-deploys on push to main.

---

## Self-review notes for the implementer

- The plan touches 14 files: 2 created, 11 modified, 1 deleted. If a file mentioned doesn't exist in your tree, read the directory and adapt — the architecture description tells you what each file should be doing.
- The spec mentions a possible `@theme` block in `main.css` for custom tokens. The plan above doesn't add one because every color we use is in Tailwind's default palette. If the user requests palette tweaks later (e.g., a custom brand color), that's where to add it.
- If `npm run build` fails because of unused dependencies still imported anywhere, search for and remove dangling imports — likely candidates are `IdentityPanel`, old CSS class strings in JSX (look for `className="standings-row"` etc).
- After Task 10, the only remaining items from the original handoff are: submission flow polish, Phase 2 bracket, GitHub Pages teardown, brother content decisions. None are blocked by this restyle.
