import { deriveWinner } from './derive.js';
import { computeStandings } from './standings.js';
import { isMatchFinal } from './status.js';
import { KO_ROUND_ORDER, resolveActualBracket } from './bracket.js';

const POINTS_WINNER = 3;
const POINTS_EXACT_BONUS = 3;
const POINTS_FIRST_PLACE = 15;
const POINTS_SECOND_PLACE = 8;
const POINTS_THIRD_PLACE = 4;
const POINTS_PERFECT_ORDER = 8;

// R32 frozen at 4 (already played); R16→Final doubled from the original
// 8/16/32/64 ladder to give the knockout half more weight vs the group stage
// (pool vote, 2026-07). Keeps the doubling shape, later rounds still worth more.
export const KO_WINNER_POINTS = { R32: 4, R16: 16, QF: 32, SF: 64 };
export const KO_CHAMPION_POINTS = 128;
const KO_EXACT_BONUS = 3;
const KO_FINAL_EXACT_BONUS = 5;

export function scoreSubmission(submission, fixtures, results) {
  const match_points = {};
  let match_total = 0;
  let exact_score_count = 0;

  for (const [matchId, pick] of Object.entries(submission.matches)) {
    const result = results?.matches?.[matchId];
    if (!result || !isMatchFinal(result.status)) continue; // pending → no entry

    let pts = 0;
    if (deriveWinner(pick.home_score, pick.away_score) === deriveWinner(result.home_score, result.away_score)) {
      pts += POINTS_WINNER;
    }
    if (pick.home_score === result.home_score && pick.away_score === result.away_score) {
      pts += POINTS_EXACT_BONUS;
      exact_score_count += 1;
    }
    match_points[matchId] = pts;
    match_total += pts;
  }

  const group_points = {};
  let group_total = 0;

  for (const [groupLetter, predicted] of Object.entries(submission.group_standings)) {
    const group = fixtures.groups[groupLetter];
    if (!group) continue;
    const allFinal = group.matches.every(mid =>
      isMatchFinal(results?.matches?.[mid]?.status)
    );
    if (!allFinal) continue; // pending group → no entry

    // Build a matches-shaped object from results for this group, for computeStandings.
    const matchScores = {};
    for (const mid of group.matches) {
      const r = results.matches[mid];
      matchScores[mid] = { home_score: r.home_score, away_score: r.away_score };
    }
    const { standings: actual } = computeStandings(groupLetter, matchScores, fixtures);

    const first = predicted[0] === actual[0] ? POINTS_FIRST_PLACE : 0;
    const second = predicted[1] === actual[1] ? POINTS_SECOND_PLACE : 0;
    const third = predicted[2] === actual[2] ? POINTS_THIRD_PLACE : 0;
    const perfect = arraysEqual(predicted, actual) ? POINTS_PERFECT_ORDER : 0;
    const subtotal = first + second + third + perfect;
    group_points[groupLetter] = { first, second, third, perfect, subtotal };
    group_total += subtotal;
  }

  return {
    match_points,
    match_total,
    group_points,
    group_total,
    total: match_total + group_total,
    exact_score_count,
  };
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Slot-based knockout scoring. Each bracket position is scored independently
// against the real bracket (ESPN-style): round-winner points when the player's
// advancer for a slot matches reality, an exact-score bonus per match, plus a
// champion achievement. See the locked table in docs/HANDOFF.md.
export function scoreBracket(bracket, knockout, results) {
  const { matchInfo } = resolveActualBracket(knockout, results);

  const round_points = {};
  const round_totals = Object.fromEntries(Object.keys(KO_WINNER_POINTS).map((r) => [r, 0]));
  let exact_bonus = 0;
  let exact_count = 0;

  for (const round of KO_ROUND_ORDER) {
    for (const slot of knockout.rounds[round] || []) {
      const id = slot.slot;
      const actual = matchInfo[id];
      const pick = bracket?.[id];
      if (!actual || !actual.final || !pick) continue;

      // Round-winner points (R32..SF; the final's winner is scored as champion).
      if (round !== 'F' && pick.advances && pick.advances === actual.advances) {
        const pts = KO_WINNER_POINTS[round];
        round_points[id] = pts;
        round_totals[round] += pts;
      }

      // Exact-score bonus — you must have predicted THIS matchup (both real
      // teams) and the scoreline. The advancer is required on a decisive game
      // (a decisive scoreline already implies the winner), but NOT on a draw:
      // the shootout is a coin flip, so nailing e.g. a 1-1 with the right two
      // teams still earns the bonus even if you called the wrong side on pens.
      // Winner/champion points still require the advancer. +5 final, +3 else.
      const rightMatchup = pick.home === actual.home && pick.away === actual.away;
      const scoreMatch = pick.home_score === actual.home_score && pick.away_score === actual.away_score;
      const isDraw = actual.home_score === actual.away_score;
      const calledAdvancer = pick.advances && pick.advances === actual.advances;
      if (rightMatchup && scoreMatch && (isDraw || calledAdvancer)) {
        exact_bonus += round === 'F' ? KO_FINAL_EXACT_BONUS : KO_EXACT_BONUS;
        exact_count += 1;
      }
    }
  }

  // Champion: the final's actual advancer matches the predicted advancer.
  const finalSlot = (knockout.rounds.F || [])[0];
  let champion_points = 0;
  if (finalSlot) {
    const actualFinal = matchInfo[finalSlot.slot];
    const pickFinal = bracket?.[finalSlot.slot];
    if (actualFinal?.final && pickFinal && pickFinal.advances === actualFinal.advances) {
      champion_points = KO_CHAMPION_POINTS;
    }
  }

  const bracket_total =
    round_totals.R32 + round_totals.R16 + round_totals.QF + round_totals.SF +
    champion_points + exact_bonus;

  return { round_points, round_totals, champion_points, exact_bonus, exact_count, bracket_total };
}

// Points a single bracket pick earns on ONE knockout match — for the per-match
// drilldown. Winner points by round (the final's winner is the champion at 64),
// plus the exact-score bonus. `round` is 'R32'|'R16'|'QF'|'SF'|'F';
// `actual` is a resolveActualBracket matchInfo entry.
export function scoreKnockoutMatch(round, pick, actual) {
  if (!actual || !actual.final || !pick) {
    return { points: 0, winnerPoints: 0, exactBonus: 0, correctAdvancer: false, exact: false, pending: true };
  }
  const correctAdvancer = Boolean(pick.advances) && pick.advances === actual.advances;
  // Exact bonus: right matchup + scoreline; the advancer is required only on a
  // decisive game (a draw's shootout is a coin flip). See scoreBracket.
  const rightMatchup = pick.home === actual.home && pick.away === actual.away;
  const isDraw = actual.home_score === actual.away_score;
  const exact = rightMatchup
    && pick.home_score === actual.home_score && pick.away_score === actual.away_score
    && (isDraw || correctAdvancer);
  const winnerPoints = correctAdvancer ? (round === 'F' ? KO_CHAMPION_POINTS : (KO_WINNER_POINTS[round] || 0)) : 0;
  const exactBonus = exact ? (round === 'F' ? KO_FINAL_EXACT_BONUS : KO_EXACT_BONUS) : 0;
  return { points: winnerPoints + exactBonus, winnerPoints, exactBonus, correctAdvancer, exact, pending: false };
}
