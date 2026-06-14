import { useState } from 'react';
import { useBracketState } from '../state.jsx';
import { BracketTree } from '../../shared/bracketTree.jsx';

export function BracketReview({ knockout, matchups }) {
  const { state } = useBracketState();
  const [open, setOpen] = useState(false);
  const slotInfo = (slot) => {
    const m = matchups[slot] || {};
    return { home: m.home, away: m.away, advances: state.bracket[slot]?.advances ?? null };
  };
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <button type="button" className="text-sm font-medium text-emerald-300 hover:underline" onClick={() => setOpen((v) => !v)}>
        {open ? '▾ Hide bracket review' : '▸ Review full bracket'}
      </button>
      {open && <div className="mt-3"><BracketTree knockout={knockout} slotInfo={slotInfo} /></div>}
    </section>
  );
}
