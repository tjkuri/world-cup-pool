import { useFormState } from '../state.jsx';
import { deriveWinner } from '../../../lib/derive.js';
import { teamName, teamFlag } from '../../shared/teamNames.js';
import { formatKickoff } from '../../shared/formatKickoff.js';

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

export function MatchInputs({ fixtures, odds }) {
  const { state, dispatch } = useFormState();
  const letter = state.activeGroup;
  const group = fixtures.groups[letter];
  if (!group) return <p>Unknown group: {letter}</p>;
  const oddsCachedAt = odds?.cached_at
    ? new Date(odds.cached_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Group {letter}</h2>
        {oddsCachedAt && (
          <span className="text-[10px] text-slate-600">odds cached {oddsCachedAt}</span>
        )}
      </div>
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
          const decided = Number.isInteger(pick.home_score) && Number.isInteger(pick.away_score);
          const rowCls = [
            'rounded-lg border border-slate-800 bg-slate-900 px-3 py-2',
            decided && 'border-l-4 border-l-emerald-500/70',
          ].filter(Boolean).join(' ');
          return (
            <li key={mid} className={rowCls}>
              <div className="flex items-center gap-3">
                <span className="flex-1 text-right text-sm text-slate-200">
                  {teamName(fixture.home)} <span className="ml-1">{teamFlag(fixture.home)}</span>
                </span>
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
                <span className="flex-1 text-sm text-slate-200">
                  <span className="mr-1">{teamFlag(fixture.away)}</span> {teamName(fixture.away)}
                </span>
              </div>
              <p className="mt-1 text-center text-xs text-slate-500">{formatKickoff(fixture.kickoff_iso)}</p>
              {odds?.matches?.[mid] && <ImpliedProbs fx={fixture} probs={odds.matches[mid]} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ImpliedProbs({ fx, probs }) {
  const pct = (x) => Math.round(x * 100);
  return (
    <p className="mt-0.5 text-center text-[11px] text-slate-500">
      {teamName(fx.home)} {pct(probs.home_implied)}%
      <span className="mx-1.5 text-slate-700">·</span>
      Draw {pct(probs.draw_implied)}%
      <span className="mx-1.5 text-slate-700">·</span>
      {teamName(fx.away)} {pct(probs.away_implied)}%
    </p>
  );
}
