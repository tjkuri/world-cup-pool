import { KO_ROUND_ORDER } from '../../lib/bracket.js';
import { teamFlag } from './teamNames.js';

const LABELS = { R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', F: 'Final' };

// slotInfo(slot) -> { home, away, advances, cls? } where cls is an optional
// status class ('hit'|'miss'|'pending') used by the leaderboard tab.
export function BracketTree({ knockout, slotInfo }) {
  const rounds = KO_ROUND_ORDER.filter((r) => (knockout.rounds[r] || []).length > 0);
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {rounds.map((round) => (
        <div key={round} className="flex min-w-[120px] flex-col justify-around">
          <div className="mb-2 text-center text-[11px] uppercase tracking-wide text-slate-500">{LABELS[round]}</div>
          {knockout.rounds[round].map((slot) => {
            const info = slotInfo(slot.slot) || {};
            const statusCls = info.cls === 'hit' ? 'border-emerald-500/60' : info.cls === 'miss' ? 'border-rose-500/40' : 'border-slate-700';
            return (
              <div key={slot.slot} className={`my-1 rounded-md border ${statusCls} text-xs`}>
                {[info.home, info.away].map((t, i) => (
                  <div key={i} className={`px-2 py-1 ${info.advances && info.advances === t ? 'font-semibold text-emerald-300' : 'text-slate-300'} ${i === 0 ? 'border-b border-slate-800' : ''}`}>
                    {t ? <>{teamFlag(t)} {t}</> : <span className="text-slate-600">—</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
