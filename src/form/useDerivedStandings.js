import { useMemo } from 'react';
import { computeStandings } from '../../lib/standings.js';

/**
 * Returns the standings to display for a group.
 *
 * Priority:
 *   1. If the user has manually ordered this group (state.manualTiebreakers[group]
 *      is a 4-team array), use that. This is a full override.
 *   2. If all 6 match scores are filled, compute via FIFA tiebreaker chain.
 *   3. Otherwise, fall back to the fixture's team order so we always render 4 rows.
 *
 * `source` describes how the order was determined: 'manual' | 'derived' | 'placeholder'.
 */
export function useDerivedStandings(groupLetter, state, fixtures) {
  return useMemo(() => {
    if (!fixtures) return { standings: [], source: 'placeholder' };
    const group = fixtures.groups[groupLetter];
    if (!group) return { standings: [], source: 'placeholder' };

    const manual = state.manualTiebreakers[groupLetter];
    if (Array.isArray(manual) && manual.length === group.teams.length) {
      return { standings: manual, source: 'manual' };
    }

    const matchScores = {};
    let allFilled = true;
    for (const mid of group.matches) {
      const pick = state.matches[mid];
      if (!pick || !Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) {
        allFilled = false;
        break;
      }
      matchScores[mid] = { home_score: pick.home_score, away_score: pick.away_score };
    }
    if (!allFilled) {
      return { standings: group.teams, source: 'placeholder' };
    }
    const { standings } = computeStandings(groupLetter, matchScores, fixtures);
    return { standings, source: 'derived' };
  }, [groupLetter, state.matches, state.manualTiebreakers, fixtures]);
}
