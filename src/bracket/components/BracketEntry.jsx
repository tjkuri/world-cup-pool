import { useEffect, useMemo } from 'react';
import { useBracketState } from '../state.jsx';
import { resolveMatchups, KO_ROUND_ORDER } from '../../../lib/bracket.js';
import { RoundTabs } from './RoundTabs.jsx';
import { BracketRound } from './BracketRound.jsx';
import { BracketReview } from './BracketReview.jsx';
import { BracketSubmitModal } from './BracketSubmitModal.jsx';
import { ErrorSummary } from '../../form/components/ErrorSummary.jsx';

export function BracketEntry({ knockout, config }) {
  const { state, dispatch } = useBracketState();

  const matchups = useMemo(
    () => resolveMatchups(knockout, (slot) => state.bracket[slot]?.advances ?? null),
    [knockout, state.bracket]
  );

  // Heal stale downstream picks: if an upstream change left a slot's chosen
  // advancer no longer present in its (recomputed) matchup, clear that slot.
  // Cascades naturally because clearing a slot empties its downstream matchups.
  useEffect(() => {
    for (const [slot, pick] of Object.entries(state.bracket)) {
      const m = matchups[slot];
      if (pick?.advances && pick.advances !== m?.home && pick.advances !== m?.away) {
        dispatch({ type: 'CLEAR_SLOT', slot });
      }
    }
  }, [matchups, state.bracket, dispatch]);

  // Keep champion synced to the final slot's advancer.
  const finalSlot = (knockout.rounds.F || [])[0];
  const finalAdvancer = finalSlot ? state.bracket[finalSlot.slot]?.advances ?? null : null;
  useEffect(() => {
    if (finalAdvancer !== state.champion) dispatch({ type: 'SET_CHAMPION', team: finalAdvancer });
  }, [finalAdvancer, state.champion, dispatch]);

  const totalSlots = KO_ROUND_ORDER.reduce((n, r) => n + (knockout.rounds[r]?.length || 0), 0);
  const filledSlots = Object.values(state.bracket).filter((s) => s.advances).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{filledSlots} / {totalSlots} picks made</p>
      <ErrorSummary errors={state.errors} />
      <RoundTabs knockout={knockout} />
      <BracketRound knockout={knockout} matchups={matchups} />
      <BracketReview knockout={knockout} matchups={matchups} />
      <BracketSubmitModal knockout={knockout} matchups={matchups} appsScriptUrl={config.apps_script_url} />
    </div>
  );
}
