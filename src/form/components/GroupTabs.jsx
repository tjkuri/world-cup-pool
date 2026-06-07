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
    <div className="tabs">
      {letters.map((letter) => {
        const status = completionStatus(letter, state.matches, fixtures);
        const cls = ['tab', status === 'partial' && 'partial', status === 'complete' && 'complete', state.activeGroup === letter && 'active']
          .filter(Boolean)
          .join(' ');
        const indicator = status === 'complete' ? '✓' : status === 'partial' ? '●' : '';
        return (
          <button
            key={letter}
            type="button"
            className={cls}
            onClick={() => dispatch({ type: 'SET_ACTIVE_GROUP', letter })}
          >
            Group {letter}
            {indicator && <span className="tab-indicator">{indicator}</span>}
          </button>
        );
      })}
    </div>
  );
}
