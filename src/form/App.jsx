import { useEffect, useState } from 'react';
import { FormStateProvider, useFormState } from './state.jsx';
import { useAutosave, loadDraft, clearDraft } from './useAutosave.js';
import { TopBar } from './components/TopBar.jsx';
import { ProgressBar } from './components/ProgressBar.jsx';
import { LockBanner } from './components/LockBanner.jsx';
import { GroupTabs } from './components/GroupTabs.jsx';
import { MatchInputs } from './components/MatchInputs.jsx';
import { PredictedStandings } from './components/PredictedStandings.jsx';
import { ErrorSummary } from './components/ErrorSummary.jsx';
import { SubmitModal } from './components/SubmitModal.jsx';
import { SubmittedView } from './components/SubmittedView.jsx';
import { RulesDrawer } from '../shared/RulesDrawer.jsx';

export function App() {
  const [config, setConfig] = useState(null);
  const [fixtures, setFixtures] = useState(null);
  const [odds, setOdds] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/config.json').then((r) => r.json()),
      fetch('/fixtures.json').then((r) => r.json()),
    ])
      .then(([c, f]) => {
        setConfig(c);
        setFixtures(f);
      })
      .catch((err) => setLoadError(String(err)));
    // Odds are optional — silently degrade if missing.
    fetch('/odds.json').then((r) => (r.ok ? r.json() : null)).then(setOdds).catch(() => {});
  }, []);

  if (loadError) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <p>Failed to load: {loadError}. Refresh to retry.</p>
      </main>
    );
  }
  if (!config || !fixtures) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <p className="text-slate-400">Loading…</p>
      </main>
    );
  }
  return (
    <FormStateProvider>
      <FormBody config={config} fixtures={fixtures} odds={odds} />
    </FormStateProvider>
  );
}

function FormBody({ config, fixtures, odds }) {
  const { state, dispatch } = useFormState();
  const [rulesOpen, setRulesOpen] = useState(false);
  const lockTime = new Date(config.group_lock_iso);
  const [now, setNow] = useState(() => new Date());
  const locked = now >= lockTime;

  // Hydrate draft once on mount.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) dispatch({ type: 'HYDRATE', payload: draft });
  }, [dispatch]);

  useAutosave(state);

  // Live countdown when within 24h of lock.
  useEffect(() => {
    const msToLock = lockTime - now;
    if (msToLock > 24 * 60 * 60 * 1000 || msToLock <= 0) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [lockTime, now]);

  if (locked) {
    return (
      <>
        <TopBar pageLabel="World Cup 2026 Pool" otherPage="./leaderboard.html" otherLabel="Leaderboard" onOpenRules={() => setRulesOpen(true)} />
        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <h2>Submissions are closed.</h2>
          <p>The tournament has begun. <a href="./leaderboard.html">View the leaderboard.</a></p>
        </main>
        {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
      </>
    );
  }

  if (state.submitState === 'submitted') {
    return (
      <>
        <TopBar pageLabel="World Cup 2026 Pool" otherPage="./leaderboard.html" otherLabel="Leaderboard" onOpenRules={() => setRulesOpen(true)} />
        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <SubmittedView submittedAt={state.submittedAt} />
        </main>
        {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <TopBar
        pageLabel="World Cup 2026 Pool"
        otherPage="./leaderboard.html"
        otherLabel="Leaderboard"
        onOpenRules={() => setRulesOpen(true)}
      >
        <LockBanner lockTime={lockTime} now={now} />
      </TopBar>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <ProgressBar state={state} fixtures={fixtures} />
        <ErrorSummary errors={state.errors} />
        <GroupTabs fixtures={fixtures} />
        <MatchInputs fixtures={fixtures} odds={odds} />
        <PredictedStandings fixtures={fixtures} />
        <SubmitModal
          fixtures={fixtures}
          appsScriptUrl={config.apps_script_url}
          onClearDraft={clearDraft}
        />
      </main>
      {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
    </>
  );
}
