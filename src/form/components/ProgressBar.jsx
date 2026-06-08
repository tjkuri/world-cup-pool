export function ProgressBar({ state, fixtures }) {
  const totalMatches = Object.keys(fixtures.matches).length;
  let filled = 0;
  for (const mid of Object.keys(fixtures.matches)) {
    const p = state.matches[mid];
    if (p && Number.isInteger(p.home_score) && Number.isInteger(p.away_score)) filled++;
  }
  const pct = totalMatches > 0 ? Math.round((filled / totalMatches) * 100) : 0;
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm tabular-nums text-slate-400">{filled}/{totalMatches}</span>
    </div>
  );
}
