function InfoTip({ text }) {
  return (
    <span className="group/tip relative ml-1 inline-flex">
      <span
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-600 text-[9px] font-bold leading-none text-slate-400 group-hover/tip:border-emerald-400 group-hover/tip:text-emerald-400"
        aria-hidden="true"
      >
        i
      </span>
      <span className="pointer-events-none invisible absolute bottom-full right-0 z-20 mb-1.5 w-60 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-left text-xs font-normal normal-case text-slate-200 shadow-xl group-hover/tip:visible">
        {text}
      </span>
    </span>
  );
}

export function LeaderboardTable({ entries, onRowClick }) {
  if (!entries.length) return <p className="text-slate-400">No submissions to display yet.</p>;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-700 bg-slate-900 text-slate-300">
          <th className="px-3 py-2 text-left font-medium">Rank</th>
          <th className="px-3 py-2 text-left font-medium">Name</th>
          <th className="px-3 py-2 text-right font-medium">
            <span className="inline-flex items-center justify-end">
              Match pts
              <InfoTip text="Per-game predictions across the 72 group-stage matches. 3 pts for correct winner/draw, +3 bonus for exact score (6 max per match). Only counts matches that have a FINAL result." />
            </span>
          </th>
          <th className="px-3 py-2 text-right font-medium">
            <span className="inline-flex items-center justify-end">
              Group pts
              <InfoTip text="Standings predictions per group. 15/8/4 for correct 1st/2nd/3rd, +8 if you nail the entire 1–4 order. Only scores when all 6 matches in a group are FINAL." />
            </span>
          </th>
          <th className="px-3 py-2 text-right font-medium">
            <span className="inline-flex items-center justify-end">
              Total
              <InfoTip text="Match pts + Group pts. Ranks the leaderboard." />
            </span>
          </th>
          <th className="px-3 py-2 text-right font-medium">
            <span className="inline-flex items-center justify-end">
              Exact scores
              <InfoTip text="Tiebreaker. Count of matches where you nailed the exact final score." />
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => (
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
