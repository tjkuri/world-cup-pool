// Two prize cards shown during the knockout phase: the group prize is frozen
// (decided at group end), the overall prize is the live race.
export function PrizeCards({ entries, buyIn }) {
  if (!entries.length) return null;
  const pot = entries.length * (buyIn || 0);
  const groupLeader = [...entries].sort((a, b) => b.groupTotal - a.groupTotal)[0];
  const overallLeader = entries[0]; // entries are already sorted by total
  const fmt = (n) => `$${Math.round(n)}`;
  return (
    <div className="mb-4 flex gap-3">
      <div className="flex-1 rounded-xl border border-slate-600 bg-slate-900 p-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Group prize · 30%</div>
        <div className="mt-1 text-base font-bold text-white">🥇 {groupLeader.name} — {groupLeader.groupTotal}</div>
        <div className="mt-0.5 text-xs font-semibold text-slate-400">DECIDED · {fmt(pot * 0.3)} locked in</div>
      </div>
      <div className="flex-1 rounded-xl border border-emerald-600 bg-slate-900 p-3 ring-1 ring-emerald-600/40">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Overall prize · 70%</div>
        <div className="mt-1 text-base font-bold text-white">🔥 {overallLeader.name} — {overallLeader.total}</div>
        <div className="mt-0.5 text-xs font-semibold text-emerald-400">LIVE · {fmt(pot * 0.7)}</div>
      </div>
    </div>
  );
}
