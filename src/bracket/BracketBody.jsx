import { useEffect, useState } from 'react';
import { TopBar } from '../form/components/TopBar.jsx';
import { LockBanner } from '../form/components/LockBanner.jsx';
import { RulesDrawer } from '../shared/RulesDrawer.jsx';
import { PotBar } from '../shared/PotBar.jsx';
import { formatKickoff } from '../shared/formatKickoff.js';
import { useBracketState } from './state.jsx';
import { useBracketAutosave, loadBracketDraft } from './useBracketAutosave.js';

export function BracketBody({ config, knockout }) {
  const { state, dispatch } = useBracketState();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const lockIso = config.knockout_lock_iso || knockout?.first_kickoff_iso || null;
  const lockTime = lockIso ? new Date(lockIso) : null;
  const locked = lockTime ? now >= lockTime : false;

  useEffect(() => {
    const draft = loadBracketDraft();
    if (draft) dispatch({ type: 'HYDRATE', payload: draft });
  }, [dispatch]);
  useBracketAutosave(state);

  // Live countdown when within 24h of lock (mirrors src/form/App.jsx).
  useEffect(() => {
    if (!lockTime) return;
    const msToLock = lockTime - now;
    if (msToLock > 24 * 60 * 60 * 1000 || msToLock <= 0) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [lockTime, now]);

  const topBar = (
    <TopBar pageLabel="World Cup 2026 Pool — Bracket" otherPage="./leaderboard.html" otherLabel="Leaderboard" onOpenRules={() => setRulesOpen(true)}>
      {lockTime && <LockBanner lockTime={lockTime} now={now} />}
    </TopBar>
  );

  // Not seeded yet → bracket opens after the group stage.
  if (!knockout) {
    return (
      <>{topBar}
        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <PotBar appsScriptUrl={config.apps_script_url} buyIn={config.buy_in_usd} />
          <p className="text-slate-300">The bracket opens after the group stage ends. Check back once the Round of 32 is set.</p>
        </main>
        {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
      </>
    );
  }
  if (locked) {
    return (
      <>{topBar}
        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <PotBar appsScriptUrl={config.apps_script_url} buyIn={config.buy_in_usd} />
          <h2 className="text-lg font-semibold">Bracket submissions are closed.</h2>
          <p className="text-slate-300">The knockout stage has begun. <a className="text-emerald-400 hover:underline" href="./leaderboard.html">View the leaderboard.</a></p>
        </main>
        {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
      </>
    );
  }

  // Live entry UI is composed in a later task (BracketEntry). Placeholder mount for now.
  return (
    <>{topBar}
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PotBar appsScriptUrl={config.apps_script_url} buyIn={config.buy_in_usd} />
        {lockTime && <p className="mb-3 text-xs text-slate-500">Locks {formatKickoff(lockIso)}.</p>}
        <div id="bracket-entry-mount" />
      </main>
      {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
    </>
  );
}
