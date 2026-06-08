import { useMemo } from 'react';
import { scoreSubmission } from '../../../lib/score.js';

export function LeaderboardTable({ fixtures, results, submissions, onRowClick }) {
  const scored = useMemo(() => {
    const rows = submissions.map((sub) => {
      const scoring = scoreSubmission(sub.picks, fixtures, results);
      return { ...sub, scoring };
    });
    rows.sort((a, b) => {
      if (b.scoring.total !== a.scoring.total) return b.scoring.total - a.scoring.total;
      if (b.scoring.exact_score_count !== a.scoring.exact_score_count) return b.scoring.exact_score_count - a.scoring.exact_score_count;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [fixtures, results, submissions]);

  if (!scored.length) return <p className="text-slate-400">No submissions to display yet.</p>;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-700 bg-slate-900 text-slate-300">
          <th className="px-3 py-2 text-left font-medium">Rank</th>
          <th className="px-3 py-2 text-left font-medium">Name</th>
          <th className="px-3 py-2 text-right font-medium">Match pts</th>
          <th className="px-3 py-2 text-right font-medium">Group pts</th>
          <th className="px-3 py-2 text-right font-medium">Total</th>
          <th className="px-3 py-2 text-right font-medium">Exact scores</th>
        </tr>
      </thead>
      <tbody>
        {scored.map((entry, i) => (
          <tr
            key={entry.email_hash}
            className="border-b border-slate-800 hover:bg-slate-900 cursor-pointer"
            onClick={() => onRowClick(entry)}
          >
            <td className="px-3 py-2 tabular-nums text-slate-400">{i + 1}</td>
            <td className="px-3 py-2 text-slate-100">{entry.name}</td>
            <td className="px-3 py-2 text-right tabular-nums text-slate-300">{entry.scoring.match_total}</td>
            <td className="px-3 py-2 text-right tabular-nums text-slate-300">{entry.scoring.group_total}</td>
            <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-300">{entry.scoring.total}</td>
            <td className="px-3 py-2 text-right tabular-nums text-slate-400">{entry.scoring.exact_score_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
