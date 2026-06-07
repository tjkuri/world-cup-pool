import { useEffect, useMemo, useState } from 'react';
import { TopBar } from '../form/components/TopBar.jsx';
import { RulesDrawer } from '../shared/RulesDrawer.jsx';
import { LeaderboardTable } from './components/LeaderboardTable.jsx';
import { PickModal } from './components/PickModal.jsx';
import { useDeepLink } from './useDeepLink.js';

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

  useEffect(() => {
    (async () => {
      try {
        const [c, f, r] = await Promise.all([
          fetch('/config.json').then((x) => x.json()),
          fetch('/fixtures.json').then((x) => x.json()),
          fetch('/results.json').then((x) => x.json()),
        ]);
        setConfig(c);
        setFixtures(f);
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

  const lastUpdated = useMemo(() => {
    if (!results?.updated_at) return null;
    return formatRelative(new Date(results.updated_at));
  }, [results]);

  if (error) {
    return (
      <>
        <TopBar pageLabel="World Cup 2026 Pool — Leaderboard" otherPage="./index.html" otherLabel="Submit picks" onOpenRules={() => setRulesOpen(true)} />
        <main>
          <p>Couldn't load. <button type="button" onClick={() => location.reload()}>Retry</button></p>
          <pre style={{ fontSize: 12, color: '#71717a' }}>{error}</pre>
        </main>
        {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
      </>
    );
  }
  if (!config || !fixtures || !results || locked === null) {
    return (
      <>
        <TopBar pageLabel="World Cup 2026 Pool — Leaderboard" otherPage="./index.html" otherLabel="Submit picks" onOpenRules={() => setRulesOpen(true)} />
        <main><p className="loading">Loading…</p></main>
      </>
    );
  }
  return (
    <>
      <TopBar pageLabel="World Cup 2026 Pool — Leaderboard" otherPage="./index.html" otherLabel="Submit picks" onOpenRules={() => setRulesOpen(true)}>
        {lastUpdated && <div className="progress-count">Last updated: {lastUpdated}</div>}
      </TopBar>
      <main>
        {!locked ? (
          <p>The leaderboard goes live after submissions close at {config.group_lock_iso}.</p>
        ) : (
          <LeaderboardTable
            fixtures={fixtures}
            results={results}
            submissions={submissions}
            onRowClick={setModalEntry}
          />
        )}
      </main>
      {modalEntry && (
        <PickModal entry={modalEntry} fixtures={fixtures} results={results} onClose={() => setModalEntry(null)} />
      )}
      {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
    </>
  );
}
