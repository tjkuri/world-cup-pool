import { lazy, Suspense, useMemo } from 'react';
import { useStatsData } from './useStatsData.js';
import { scoreSubmission } from '../../lib/score.js';

const TheGap = lazy(() => import('./components/TheGap.jsx').then((m) => ({ default: m.TheGap })));
const LiveCeiling = lazy(() => import('./components/LiveCeiling.jsx').then((m) => ({ default: m.LiveCeiling })));
const Superlatives = lazy(() => import('./components/Superlatives.jsx').then((m) => ({ default: m.Superlatives })));

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

  if (data.loading) return <div className="mx-auto max-w-5xl px-4 py-8 text-slate-400">Loading stats…</div>;
  if (data.error) return <div className="mx-auto max-w-5xl px-4 py-8 text-red-400">Couldn't load stats: {data.error}</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100 space-y-8">
      <h1 className="text-2xl font-bold">Pool Stats</h1>
      <p className="text-slate-400">{data.history?.snapshots?.length ?? 0} snapshots · {data.submissions?.length ?? 0} submissions loaded.</p>
      <Suspense fallback={<div className="text-slate-500">Loading chart…</div>}>
        <TheGap history={data.history} />
        <Superlatives history={data.history} submissions={data.submissions} fixtures={data.fixtures} results={data.results} knockout={data.knockout} />
        <LiveCeiling submissions={data.submissions} groupTotalsByEmail={groupTotalsByEmail} knockout={data.knockout} results={data.results} />
      </Suspense>
    </div>
  );
}
