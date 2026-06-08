import { useMemo } from 'react';
import { resolveGroupStandings } from './resolveStandings.js';

/**
 * Returns { ready, total, byLetter } where `ready` counts groups that have
 * all 6 scores entered. `byLetter` carries the resolved standings per group
 * (standings, unresolvedTies, scoreOnlyTies, allFilled) for downstream
 * consumers (e.g., SubmitModal recap).
 *
 * Ties are not required to be manually resolved to count as ready — the
 * score-derived order stands unless the user drags to override it.
 */
export function useReadyCount(state, fixtures) {
  return useMemo(() => {
    const letters = Object.keys(fixtures.groups);
    const byLetter = {};
    let ready = 0;
    for (const letter of letters) {
      const resolved = resolveGroupStandings(letter, state, fixtures);
      byLetter[letter] = resolved;
      if (resolved.allFilled) ready++;
    }
    return { ready, total: letters.length, byLetter };
  }, [state, fixtures]);
}
