import { useBracketState } from '../state.jsx';
import { teamName, teamFlag } from '../../shared/teamNames.js';
import { SCORE_INPUT_CLASS } from '../../shared/scoreInput.js';

function parseScore(raw) {
  if (raw === '') return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

// matchups: slot -> { home, away } from resolveMatchups (passed in by the parent).
export function BracketRound({ knockout, matchups }) {
  const { state, dispatch } = useBracketState();
  const round = state.activeRound;
  const slots = knockout.rounds[round] || [];
  const isFinal = round === 'F';

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{round === 'F' ? 'Final' : round}</h2>
      <ol className="space-y-2">
        {slots.map((slot) => {
          const { home, away } = matchups[slot.slot] || { home: null, away: null };
          const pick = state.bracket[slot.slot] || { home_score: null, away_score: null, advances: null };
          const ready = home && away;
          const decided = Number.isInteger(pick.home_score) && Number.isInteger(pick.away_score);
          const tie = decided && pick.home_score === pick.away_score;
          const setScore = (side) => (e) =>
            dispatch({ type: 'SET_SLOT_SCORE', slot: slot.slot, side, value: parseScore(e.target.value), home, away });

          const rowCls = ['rounded-lg border border-slate-800 bg-slate-900 px-3 py-2', pick.advances && 'border-l-4 border-l-emerald-500/70'].filter(Boolean).join(' ');
          return (
            <li key={slot.slot} className={rowCls}>
              {!ready ? (
                <p className="text-center text-sm text-slate-500">Pick the previous round to set this matchup.</p>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className={`flex-1 text-right text-sm ${pick.advances === home ? 'font-semibold text-emerald-300' : 'text-slate-200'}`}>
                      {teamName(home)} <span className="ml-1">{teamFlag(home)}</span>
                    </span>
                    <input type="number" min={0} max={20} step={1} inputMode="numeric"
                      value={pick.home_score == null ? '' : String(pick.home_score)} onChange={setScore('home_score')} className={SCORE_INPUT_CLASS} />
                    <span className="text-slate-500">–</span>
                    <input type="number" min={0} max={20} step={1} inputMode="numeric"
                      value={pick.away_score == null ? '' : String(pick.away_score)} onChange={setScore('away_score')} className={SCORE_INPUT_CLASS} />
                    <span className={`flex-1 text-sm ${pick.advances === away ? 'font-semibold text-emerald-300' : 'text-slate-200'}`}>
                      <span className="mr-1">{teamFlag(away)}</span> {teamName(away)}
                    </span>
                  </div>
                  {tie && (
                    <div className="mt-2 flex items-center justify-center gap-2 border-t border-dashed border-slate-700 pt-2 text-xs text-slate-300">
                      <span>Advances on pens:</span>
                      {[home, away].map((t) => (
                        <button key={t} type="button"
                          onClick={() => dispatch({ type: 'SET_SLOT_ADVANCER', slot: slot.slot, team: t })}
                          className={`rounded-full border px-2 py-0.5 ${pick.advances === t ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
                          {teamFlag(t)} {t}
                        </button>
                      ))}
                    </div>
                  )}
                  {isFinal && pick.advances && (
                    <p className="mt-2 text-center text-sm text-emerald-300">🏆 Champion: {teamFlag(pick.advances)} {teamName(pick.advances)}</p>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
