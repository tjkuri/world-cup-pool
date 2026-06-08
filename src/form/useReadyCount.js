import { useMemo } from 'react';
import { resolveGroupStandings } from './resolveStandings.js';

/**
 * Returns { ready, total } where `ready` counts groups that have all 6
 * scores entered AND no unresolved ties. `total` is the number of groups
 * in fixtures.
 */
export function useReadyCount(state, fixtures) {
  return useMemo(() => {
    const letters = Object.keys(fixtures.groups);
    let ready = 0;
    for (const letter of letters) {
      const { allFilled, unresolvedTies } = resolveGroupStandings(letter, state, fixtures);
      if (allFilled && unresolvedTies.length === 0) ready++;
    }
    return { ready, total: letters.length };
  }, [state, fixtures]);
}
