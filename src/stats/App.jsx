import { useMemo } from 'react';
import { useStatsData } from './useStatsData.js';
import { TheGap } from './components/TheGap.jsx';
import { LiveCeiling } from './components/LiveCeiling.jsx';
import { scoreSubmission } from '../../lib/score.js';

export function App() {
  const data = useStatsData();
  if (data.loading) return <div className="mx-auto max-w-5xl px-4 py-8 text-slate-400">Loading stats…</div>;
  if (data.error) return <div className="mx-auto max-w-5xl px-4 py-8 text-red-400">Couldn't load stats: {data.error}</div>;

  const groupTotalsByEmail = useMemo(() => {
    const m = new Map();
    if (!data.submissions || !data.fixtures || !data.results) return m;
    for (const sub of data.submissions) {
      if (sub.phase === 'knockout') continue;
      m.set(sub.email_hash, scoreSubmission(sub.picks, data.fixtures, data.results).total);
    }
    return m;
  }, [data.submissions, data.fixtures, data.results]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100 space-y-8">
      <h1 className="text-2xl font-bold">Pool Stats</h1>
      <p className="text-slate-400">{data.history?.snapshots?.length ?? 0} snapshots · {data.submissions?.length ?? 0} submissions loaded.</p>
      <TheGap history={data.history} />
      <LiveCeiling submissions={data.submissions} groupTotalsByEmail={groupTotalsByEmail} knockout={data.knockout} results={data.results} />
    </div>
  );
}
