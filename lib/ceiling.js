// lib/ceiling.js
// "Who can still win": which teams remain alive, and the maximum points an
// entrant could still reach. The ceiling is a loose upper bound — it grants a
// slot's round-winner/champion points to any not-yet-final slot whose picked
// advancer is still alive. Exact-score bonuses are intentionally excluded (they
// depend on an exact matchup+scoreline; the winner points dominate the ranking).
import { KO_ROUND_ORDER, resolveActualBracket } from './bracket.js';
import { scoreBracket, KO_WINNER_POINTS, KO_CHAMPION_POINTS } from './score.js';

export function aliveTeams(knockout, results) {
  const { matchInfo } = resolveActualBracket(knockout, results);
  const eliminated = new Set();
  const seen = new Set();
  for (const round of KO_ROUND_ORDER) {
    for (const slot of knockout.rounds[round] || []) {
      const info = matchInfo[slot.slot];
      if (!info) continue;
      for (const team of [info.home, info.away]) if (team) seen.add(team);
      if (info.final && info.advances) {
        for (const team of [info.home, info.away]) {
          if (team && team !== info.advances) eliminated.add(team);
        }
      }
    }
  }
  const alive = new Set();
  for (const team of seen) if (!eliminated.has(team)) alive.add(team);
  return alive;
}

export function maxReachablePoints(bracket, knockout, results) {
  const current = scoreBracket(bracket, knockout, results).bracket_total;
  const { matchInfo } = resolveActualBracket(knockout, results);
  const alive = aliveTeams(knockout, results);

  let upside = 0;
  for (const round of KO_ROUND_ORDER) {
    for (const slot of knockout.rounds[round] || []) {
      const info = matchInfo[slot.slot];
      const pick = bracket?.[slot.slot];
      if (!info || info.final || !pick || !pick.advances) continue; // only pending slots
      if (!alive.has(pick.advances)) continue; // dead pick can't score
      upside += round === 'F' ? KO_CHAMPION_POINTS : (KO_WINNER_POINTS[round] || 0);
    }
  }
  return { current, ceiling: current + upside };
}
