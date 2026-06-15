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
import { useDeepLink } from './useDeepLink.js';
import { buildMockResults, buildMockSubmissions } from './mockData.js';
import { scoreSubmission, scoreBracket } from '../../lib/score.js';
import { isMatchFinal } from '../../lib/status.js';

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
  const [knockout, setKnockout] = useState(null);

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
        fetch('/knockout.json').then((x) => (x.ok ? x.json() : null)).then(setKnockout).catch(() => {});
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
    const byEmail = new Map();
    for (const sub of submissions) {
      const key = sub.email_hash;
      const row = byEmail.get(key) || { name: sub.name, email_hash: key, group: null, knockout: null };
      if (sub.phase === 'knockout') row.knockout = sub; else row.group = sub;
      row.name = sub.name; // latest name wins
      byEmail.set(key, row);
    }
    const rows = [...byEmail.values()].map((row) => {
      const groupScoring = row.group ? scoreSubmission(row.group.picks, fixtures, results) : null;
      const bracketScoring = (row.knockout && knockout) ? scoreBracket(row.knockout.picks.bracket, knockout, results) : null;
      const groupTotal = groupScoring ? groupScoring.total : 0;
      const bracketTotal = bracketScoring ? bracketScoring.bracket_total : 0;
      return {
        name: row.name, email_hash: row.email_hash,
        groupSub: row.group, knockoutSub: row.knockout,
        // Back-compat aliases so the existing group PickModal/MatchModal keep working:
        picks: row.group ? row.group.picks : null,
        scoring: groupScoring, bracketScoring,
        groupTotal, bracketTotal, total: groupTotal + bracketTotal,
      };
    });
    rows.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const ax = a.scoring?.exact_score_count ?? 0, bx = b.scoring?.exact_score_count ?? 0;
      if (bx !== ax) return bx - ax;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [fixtures, results, submissions, knockout]);

  const inKnockoutPhase = useMemo(() => {
    if (!knockout || !results) return false;
    for (const round of Object.values(knockout.rounds))
      for (const slot of round)
        if (slot.match_id && isMatchFinal(results.matches?.[slot.match_id]?.status)) return true;
    return false;
  }, [knockout, results]);

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
