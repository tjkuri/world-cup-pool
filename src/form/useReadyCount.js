import { useMemo } from 'react';
import { resolveGroupStandings } from './resolveStandings.js';

/**
 * Returns { ready, total, byLetter } where `ready` counts groups that have
 * all 6 scores entered AND no unresolved ties, `total` is the number of
 * groups in fixtures, and `byLetter` is a map of letter →
 * { standings, unresolvedTies, scoreOnlyTies, allFilled }.
 */
export function useReadyCount(state, fixtures) {
  return useMemo(() => {
    const letters = Object.keys(fixtures.groups);
    const byLetter = {};
    let ready = 0;
    for (const letter of letters) {
      const resolved = resolveGroupStandings(letter, state, fixtures);
      byLetter[letter] = resolved;
      if (resolved.allFilled && resolved.unresolvedTies.length === 0) ready++;
    }
    return { ready, total: letters.length, byLetter };
  }, [state, fixtures]);
}
