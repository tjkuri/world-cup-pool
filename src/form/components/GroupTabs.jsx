import { useFormState } from '../state.jsx';

function completionStatus(letter, matches, fixtures) {
  const matchIds = fixtures.groups[letter].matches;
  let filled = 0;
  for (const mid of matchIds) {
    const pick = matches[mid];
    if (pick && Number.isInteger(pick.home_score) && Number.isInteger(pick.away_score)) filled++;
  }
  if (filled === 0) return 'empty';
  if (filled === matchIds.length) return 'complete';
  return 'partial';
}

export function GroupTabs({ fixtures }) {
  const { state, dispatch } = useFormState();
  const letters = Object.keys(fixtures.groups).sort();
  return (
    <div className="mx-auto mb-4 grid max-w-2xl grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {letters.map((letter) => {
        const status = completionStatus(letter, state.matches, fixtures);
        const isActive = state.activeGroup === letter;

        const base = 'inline-flex items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-10';
        let colors;
        if (isActive) {
          colors = 'bg-emerald-500 text-slate-950 font-semibold';
        } else if (status === 'complete') {
          colors = 'bg-slate-800 text-emerald-300 ring-1 ring-inset ring-emerald-500/40 hover:bg-slate-700';
        } else if (status === 'partial') {
          colors = 'bg-slate-800 text-amber-300 ring-1 ring-inset ring-amber-500/40 hover:bg-slate-700';
        } else {
          colors = 'bg-slate-800 text-slate-400 hover:bg-slate-700';
        }

        const indicator = status === 'complete' ? '✓' : status === 'partial' ? '●' : '';
        return (
          <button
            key={letter}
            type="button"
            className={`${base} ${colors}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_GROUP', letter })}
          >
            <span>Group {letter}</span>
            {indicator && <span className="text-xs">{indicator}</span>}
          </button>
        );
      })}
    </div>
  );
}
