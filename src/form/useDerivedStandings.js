import { useMemo } from 'react';
import { resolveGroupStandings } from './resolveStandings.js';

export function useDerivedStandings(groupLetter, state, fixtures) {
  return useMemo(
    () => resolveGroupStandings(groupLetter, state, fixtures),
    [groupLetter, state.matches, state.manualTiebreakers, fixtures],
  );
}
