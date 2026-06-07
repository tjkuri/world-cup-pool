import { useFormState } from '../state.jsx';
import { deriveWinner } from '../../../lib/derive.js';

function labelFor(pick) {
  if (!Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) return 'vs';
  const winner = deriveWinner(pick.home_score, pick.away_score);
  if (winner === 'draw') return 'Draw';
  if (winner === 'home') return '←';
  return '→';
}

function parseScore(raw) {
  if (raw === '') return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function MatchInputs({ fixtures }) {
  const { state, dispatch } = useFormState();
  const letter = state.activeGroup;
  const group = fixtures.groups[letter];
  if (!group) return <p>Unknown group: {letter}</p>;
  return (
    <div className="matches-panel">
      <h2>Group {letter}</h2>
      {group.matches.map((mid) => {
        const fixture = fixtures.matches[mid];
        const pick = state.matches[mid] || { home_score: null, away_score: null };
        const onChange = (side) => (e) =>
          dispatch({
            type: 'SET_MATCH_SCORE',
            matchId: mid,
            side,
            value: parseScore(e.target.value),
          });
        return (
          <div key={mid} className="match-row">
            <div className="team team-home">{fixture.home}</div>
            <input
              type="number"
              min={0}
              max={20}
              step={1}
              value={pick.home_score == null ? '' : String(pick.home_score)}
              onChange={onChange('home_score')}
            />
            <div className="draw-label">{labelFor(pick)}</div>
            <input
              type="number"
              min={0}
              max={20}
              step={1}
              value={pick.away_score == null ? '' : String(pick.away_score)}
              onChange={onChange('away_score')}
            />
            <div className="team team-away">{fixture.away}</div>
          </div>
        );
      })}
    </div>
  );
}
