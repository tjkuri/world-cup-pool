import { useBracketState } from '../state.jsx';
import { KO_ROUND_ORDER } from '../../../lib/bracket.js';

const LABELS = { R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', F: '🏆 Final' };

function roundStatus(round, knockout, bracket) {
  const slots = knockout.rounds[round] || [];
  if (slots.length === 0) return 'empty';
  let filled = 0;
  for (const s of slots) if (bracket[s.slot]?.advances) filled++;
  if (filled === 0) return 'empty';
  return filled === slots.length ? 'complete' : 'partial';
}

export function RoundTabs({ knockout }) {
  const { state, dispatch } = useBracketState();
  const rounds = KO_ROUND_ORDER.filter((r) => (knockout.rounds[r] || []).length > 0);
  return (
    <div className="mx-auto mb-4 grid max-w-2xl grid-cols-5 gap-2">
      {rounds.map((round) => {
        const status = roundStatus(round, knockout, state.bracket);
        const isActive = state.activeRound === round;
        const base = 'inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors min-h-10';
        let colors;
        if (isActive) colors = 'bg-emerald-500 text-slate-950 font-semibold';
        else if (status === 'complete') colors = 'bg-slate-800 text-emerald-300 ring-1 ring-inset ring-emerald-500/40 hover:bg-slate-700';
        else if (status === 'partial') colors = 'bg-slate-800 text-amber-300 ring-1 ring-inset ring-amber-500/40 hover:bg-slate-700';
        else colors = 'bg-slate-800 text-slate-400 hover:bg-slate-700';
        return (
          <button key={round} type="button" className={`${base} ${colors}`} onClick={() => dispatch({ type: 'SET_ACTIVE_ROUND', round })}>
            <span>{LABELS[round]}</span>
            {status === 'complete' && <span className="text-xs">✓</span>}
            {status === 'partial' && <span className="text-xs">●</span>}
          </button>
        );
      })}
    </div>
  );
}
