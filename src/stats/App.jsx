import { useStatsData } from './useStatsData.js';

export function App() {
  const data = useStatsData();
  if (data.loading) return <div className="mx-auto max-w-5xl px-4 py-8 text-slate-400">Loading stats…</div>;
  if (data.error) return <div className="mx-auto max-w-5xl px-4 py-8 text-red-400">Couldn't load stats: {data.error}</div>;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100 space-y-8">
      <h1 className="text-2xl font-bold">Pool Stats</h1>
      <p className="text-slate-400">{data.history?.snapshots?.length ?? 0} snapshots · {data.submissions?.length ?? 0} submissions loaded.</p>
    </div>
  );
}
