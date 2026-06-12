import { computeMostExact, computeLeadStat, computeLatestMatchTop } from '../../../lib/leaderboardStats.js';

export function StatBand({ entries, fixtures, results }) {
  if (!entries?.length) return null;
  const latest = computeLatestMatchTop(entries, fixtures, results);
  if (!latest) return null;
  const mostExact = computeMostExact(entries);
  const lead = computeLeadStat(entries);

  return (
    <div className="mb-4 rounded-md bg-slate-900 ring-1 ring-slate-800 px-4 py-3 text-sm text-slate-200">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>🎯 Most exact: <span className="font-semibold">{mostExact.label}</span></span>
        <span className="text-slate-600">·</span>
        <span>🥇 Lead: <span className="font-semibold">{lead.label}</span></span>
        <span className="text-slate-600">·</span>
        <span>📈 Top on {latest.matchLabel}: <span className="font-semibold">{latest.label}</span></span>
      </div>
    </div>
  );
}
