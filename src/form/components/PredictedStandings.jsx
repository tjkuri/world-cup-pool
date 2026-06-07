import { useFormState } from '../state.jsx';
import { useDerivedStandings } from '../useDerivedStandings.js';
import { TiebreakerWidget } from './TiebreakerWidget.jsx';

export function PredictedStandings({ fixtures }) {
  const { state } = useFormState();
  const letter = state.activeGroup;
  const { standings, unresolvedTies, allFilled } = useDerivedStandings(letter, state, fixtures);

  return (
    <div className="standings-panel">
      <h3>Predicted standings</h3>
      {!allFilled && <p className="loading">Fill in all 6 match scores to see the predicted standings.</p>}
      {allFilled && standings && (
        <ol className="standings-list">
          {standings.map((team, i) => (
            <li key={team}>
              <span className="standings-rank">{i + 1}.</span>
              <span>{team}</span>
            </li>
          ))}
        </ol>
      )}
      {allFilled && unresolvedTies.length > 0 && (
        <TiebreakerWidget groupLetter={letter} tiedGroups={unresolvedTies} />
      )}
    </div>
  );
}
