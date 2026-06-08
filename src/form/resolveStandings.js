import { computeStandings } from '../../lib/standings.js';

/**
 * Resolve the standings for a single group from current match picks plus the
 * user's manual tiebreaker ranks. Returns { standings, unresolvedTies, allFilled }.
 *
 *   - standings: 4-team ordered array (with manual ranks applied within tied subsets)
 *   - unresolvedTies: tied subsets where the user has not yet ranked every team
 *   - allFilled: whether all 6 match scores are entered
 *
 * Used by both the live standings panel and the submit handler so they cannot
 * disagree about what gets POSTed.
 */
export function resolveGroupStandings(groupLetter, state, fixtures) {
  const group = fixtures.groups[groupLetter];
  if (!group) return { standings: [], unresolvedTies: [], scoreOnlyTies: [], allFilled: false };

  const matchScores = {};
  for (const mid of group.matches) {
    const pick = state.matches[mid];
    if (!pick || !Number.isInteger(pick.home_score) || !Number.isInteger(pick.away_score)) {
      return { standings: group.teams, unresolvedTies: [], scoreOnlyTies: [], allFilled: false };
    }
    matchScores[mid] = { home_score: pick.home_score, away_score: pick.away_score };
  }

  const { standings: scoreOnly, unresolvedTies: scoreOnlyTies } = computeStandings(groupLetter, matchScores, fixtures);

  const manualRanks = state.manualTiebreakers[groupLetter] || {};
  const display = [...scoreOnly];
  for (const subset of scoreOnlyTies) {
    const positions = subset.map((t) => display.indexOf(t)).sort((a, b) => a - b);
    const ordered = [...subset].sort((a, b) => {
      const ra = Number.isFinite(manualRanks[a]) ? manualRanks[a] : Infinity;
      const rb = Number.isFinite(manualRanks[b]) ? manualRanks[b] : Infinity;
      if (ra !== rb) return ra - rb;
      return scoreOnly.indexOf(a) - scoreOnly.indexOf(b);
    });
    positions.forEach((pos, i) => {
      display[pos] = ordered[i];
    });
  }

  const unresolvedTies = scoreOnlyTies.filter(
    (subset) => !subset.every((t) => Number.isFinite(manualRanks[t])),
  );

  return { standings: display, unresolvedTies, scoreOnlyTies, allFilled: true };
}
