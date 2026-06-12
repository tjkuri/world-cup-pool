import { useEffect, useMemo, useState } from 'react';
import { TopBar } from '../form/components/TopBar.jsx';
import { LockBanner } from '../form/components/LockBanner.jsx';
import { RulesDrawer } from '../shared/RulesDrawer.jsx';
import { PotBar } from '../shared/PotBar.jsx';
import { formatKickoff } from '../shared/formatKickoff.js';
import { LeaderboardTable } from './components/LeaderboardTable.jsx';
import { PickModal } from './components/PickModal.jsx';
import { MatchStrip } from './components/MatchStrip.jsx';
import { MatchModal } from './components/MatchModal.jsx';
import { StatBand } from './components/StatBand.jsx';
import { useDeepLink } from './useDeepLink.js';
import { buildMockResults, buildMockSubmissions } from './mockData.js';
import { scoreSubmission } from '../../lib/score.js';

function formatRelative(date) {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'moments ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export function App() {
  const [config, setConfig] = useState(null);
  const [fixtures, setFixtures] = useState(null);
  const [results, setResults] = useState(null);
  const [submissions, setSubmissions] = useState(null);
  const [locked, setLocked] = useState(null);
  const [error, setError] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [modalEntry, setModalEntry] = useState(null);
  const [modalMatchId, setModalMatchId] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const lockTime = config ? new Date(config.group_lock_iso) : null;

  // Live tick when within 24h of lock so LockBanner counts down.
  useEffect(() => {
    if (!lockTime) return;
    const msToLock = lockTime - now;
    if (msToLock > 24 * 60 * 60 * 1000 || msToLock <= 0) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [lockTime, now]);

  useEffect(() => {
    const mockMode = new URLSearchParams(window.location.search).get('mockLeaderboard') === '1';
    (async () => {
      try {
        const [c, f, r] = await Promise.all([
          fetch('/config.json').then((x) => x.json()),
          fetch('/fixtures.json').then((x) => x.json()),
          fetch('/results.json').then((x) => x.json()),
        ]);
        setConfig(c);
        setFixtures(f);
        if (mockMode) {
          const mockResults = buildMockResults(f);
          setResults(mockResults);
          setSubmissions(buildMockSubmissions(f, mockResults));
          setLocked(true);
          return;
        }
        setResults(r);
        try {
          const resp = await fetch(`${c.apps_script_url}?action=submissions`);
          const data = await resp.json();
          setLocked(Boolean(data.locked));
          setSubmissions(data.locked ? data.submissions : []);
        } catch (e) {
          setError(String(e));
        }
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  useDeepLink({ fixtures, results, submissions, onOpen: setModalEntry });

  useEffect(() => {
    if (!fixtures || !results) return;
    const m = /^#match\/(\d+)$/.exec(location.hash);
    if (m && fixtures.matches[m[1]]) {
      setModalMatchId(m[1]);
    }
  }, [fixtures, results]);

  const lastUpdated = useMemo(() => {
    if (!results?.updated_at) return null;
    return formatRelative(new Date(results.updated_at));
  }, [results]);

  const entries = useMemo(() => {
    if (!fixtures || !results || !submissions?.length) return [];
    const rows = submissions.map((sub) => ({
      ...sub,
      scoring: scoreSubmission(sub.picks, fixtures, results),
    }));
    rows.sort((a, b) => {
      if (b.scoring.total !== a.scoring.total) return b.scoring.total - a.scoring.total;
      if (b.scoring.exact_score_count !== a.scoring.exact_score_count) return b.scoring.exact_score_count - a.scoring.exact_score_count;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [fixtures, results, submissions]);

  if (error) {
    return (
      <>
        <TopBar pageLabel="World Cup 2026 Pool — Leaderboard" otherPage="./index.html" otherLabel="Submit picks" onOpenRules={() => setRulesOpen(true)} />
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <p className="text-slate-300">Couldn't load. <button type="button" className="text-emerald-400 hover:underline" onClick={() => location.reload()}>Retry</button></p>
          <pre className="mt-2 text-xs text-slate-500">{error}</pre>
        </main>
        {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
      </>
    );
  }
  if (!config || !fixtures || !results || locked === null) {
    return (
      <>
        <TopBar pageLabel="World Cup 2026 Pool — Leaderboard" otherPage="./index.html" otherLabel="Submit picks" onOpenRules={() => setRulesOpen(true)} />
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6"><p className="text-slate-400">Loading…</p></main>
      </>
    );
  }
  return (
    <>
      <TopBar pageLabel="World Cup 2026 Pool — Leaderboard" otherPage="./index.html" otherLabel="Submit picks" onOpenRules={() => setRulesOpen(true)}>
        <LockBanner lockTime={lockTime} now={now} />
        {lastUpdated && <div className="text-sm text-slate-400">Last updated: {lastUpdated}</div>}
      </TopBar>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <PotBar appsScriptUrl={config.apps_script_url} buyIn={config.buy_in_usd} />
        {locked && <MatchStrip fixtures={fixtures} results={results} onSelect={setModalMatchId} />}
        {locked && <StatBand entries={entries} fixtures={fixtures} results={results} />}
        {!locked ? (
          <p className="text-slate-300">The leaderboard goes live after submissions close on {formatKickoff(config.group_lock_iso)}.</p>
        ) : (
          <LeaderboardTable
            entries={entries}
            onRowClick={setModalEntry}
          />
        )}
      </main>
      {modalEntry && (
        <PickModal entry={modalEntry} fixtures={fixtures} results={results} onClose={() => setModalEntry(null)} />
      )}
      {modalMatchId && (
        <MatchModal
          matchId={modalMatchId}
          fixtures={fixtures}
          results={results}
          entries={entries}
          onClose={() => setModalMatchId(null)}
          onSelectEntry={(entry) => { setModalMatchId(null); setModalEntry(entry); }}
        />
      )}
      {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
    </>
  );
}
