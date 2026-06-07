import { useMemo } from 'react';
import { computeStandings } from '../../lib/standings.js';

/**
 * Returns the live computed standings for a group based on current match score
 * picks and any manual tiebreaker overrides. If not all 6 scores are filled,
 * returns { standings: null, unresolvedTies: [] } and the caller renders the
 * "fill in your scores" prompt.
 */
export function useDerivedStandings(groupLetter, state, fixtures) {
  return useMemo(() => {
    if (!fixtures) return { standings: null, unresolvedTies: [], allFilled: false };
    const group = fixtures.groups[groupLetter];
    if (!group) return { standings: null, unresolvedTies: [], allFilled: false };

    const matchScores = {};
    for (const mid of group.matches) {
      const pick = state.matches[mid];
      if (!pick || !Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) {
        return { standings: null, unresolvedTies: [], allFilled: false };
      }
      matchScores[mid] = { home_score: pick.home_score, away_score: pick.away_score };
    }
    const manual = state.manualTiebreakers[groupLetter];
    const result = computeStandings(groupLetter, matchScores, fixtures, manual);
    return { ...result, allFilled: true };
  }, [groupLetter, state.matches, state.manualTiebreakers, fixtures]);
}
