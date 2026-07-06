import { lazy, Suspense, useMemo } from 'react';
import { useStatsData } from './useStatsData.js';
import { scoreSubmission } from '../../lib/score.js';
import { TopBar } from '../form/components/TopBar.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';

const GapPanel = lazy(() => import('./gap/GapPanel.jsx').then((m) => ({ default: m.GapPanel })));
const LiveCeiling = lazy(() => import('./components/LiveCeiling.jsx').then((m) => ({ default: m.LiveCeiling })));
const Superlatives = lazy(() => import('./components/Superlatives.jsx').then((m) => ({ default: m.Superlatives })));
const ChampionSankey = lazy(() => import('./components/ChampionSankey.jsx').then((m) => ({ default: m.ChampionSankey })));

export function App() {
  const data = useStatsData();

  const groupTotalsByEmail = useMemo(() => {
    const m = new Map();
    if (!data.submissions || !data.fixtures || !data.results) return m;
    for (const sub of data.submissions) {
      if (sub.phase === 'knockout') continue;
      m.set(sub.email_hash, scoreSubmission(sub.picks, data.fixtures, data.results).total);
    }
    return m;
  }, [data.submissions, data.fixtures, data.results]);

  if (data.loading) return (
    <>
      <TopBar pageLabel="World Cup 2026 Pool — Stats" otherPage="/leaderboard.html" otherLabel="Leaderboard" hideStatsLink />
      <div className="mx-auto max-w-5xl px-4 py-8 text-slate-400">Loading stats…</div>
    </>
  );
  if (data.error) return (
    <>
      <TopBar pageLabel="World Cup 2026 Pool — Stats" otherPage="/leaderboard.html" otherLabel="Leaderboard" hideStatsLink />
      <div className="mx-auto max-w-5xl px-4 py-8 text-red-400">Couldn't load stats: {data.error}</div>
    </>
  );

  return (
    <>
      <TopBar pageLabel="World Cup 2026 Pool — Stats" otherPage="/leaderboard.html" otherLabel="Leaderboard" hideStatsLink />
      <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100 space-y-8">
        <h1 className="text-2xl font-bold">Pool Stats</h1>
        <p className="text-slate-400">{data.history?.snapshots?.length ?? 0} snapshots · {data.submissions?.length ?? 0} submissions loaded.</p>
        <ErrorBoundary>
          <Suspense fallback={<div className="text-slate-500">Loading chart…</div>}>
            <GapPanel history={data.history} knockout={data.knockout} />
            <Superlatives history={data.history} submissions={data.submissions} fixtures={data.fixtures} results={data.results} knockout={data.knockout} odds={data.odds} />
            <LiveCeiling submissions={data.submissions} groupTotalsByEmail={groupTotalsByEmail} knockout={data.knockout} results={data.results} />
            <section>
              <h2 className="text-base font-semibold uppercase tracking-wide text-slate-500 mb-4">Retrospective</h2>
              <div className="space-y-8">
                <ChampionSankey submissions={data.submissions} knockout={data.knockout} />
              </div>
            </section>
          </Suspense>
        </ErrorBoundary>
      </div>
    </>
  );
}
