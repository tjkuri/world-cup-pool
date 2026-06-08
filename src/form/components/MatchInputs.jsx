import { useFormState } from '../state.jsx';
import { deriveWinner } from '../../../lib/derive.js';
import { teamName } from '../../shared/teamNames.js';

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
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Group {letter}</h2>
      <ol className="space-y-2">
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
            <li key={mid} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
              <span className="flex-1 text-right text-sm text-slate-200">{teamName(fixture.home)}</span>
              <input
                type="number"
                min={0}
                max={20}
                step={1}
                inputMode="numeric"
                value={pick.home_score == null ? '' : String(pick.home_score)}
                onChange={onChange('home_score')}
                className="w-12 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-center text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-slate-500">{labelFor(pick)}</span>
              <input
                type="number"
                min={0}
                max={20}
                step={1}
                inputMode="numeric"
                value={pick.away_score == null ? '' : String(pick.away_score)}
                onChange={onChange('away_score')}
                className="w-12 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-center text-slate-100 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="flex-1 text-sm text-slate-200">{teamName(fixture.away)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
