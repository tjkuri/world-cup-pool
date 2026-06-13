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

const KO_WINNER_POINTS = { R32: 4, R16: 8, QF: 16, SF: 32 };
const KO_CHAMPION_POINTS = 80;
const KO_FINALIST_POINTS = 50;
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
// advancer for a slot matches reality, an exact-score bonus per match, plus
// finalist and champion achievements. See the locked table in docs/HANDOFF.md.
export function scoreBracket(bracket, knockout, results) {
  const { advancers, matchInfo } = resolveActualBracket(knockout, results);

  const round_points = {};
  const round_totals = { R32: 0, R16: 0, QF: 0, SF: 0 };
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

      // Exact-score bonus: predicted regulation/ET score vs ESPN's reported
      // score (penalty shootouts ignored). +5 on the final, +3 otherwise.
      if (pick.home_score === actual.home_score && pick.away_score === actual.away_score) {
        exact_bonus += round === 'F' ? KO_FINAL_EXACT_BONUS : KO_EXACT_BONUS;
        exact_count += 1;
      }
    }
  }

  // Finalists: the two teams in the actual final (the F slot's resolved teams).
  // +50 for each that the player also placed in their final, capped at 100.
  const finalSlot = (knockout.rounds.F || [])[0];
  let finalist_points = 0;
  let champion_points = 0;
  if (finalSlot) {
    const actualFinal = matchInfo[finalSlot.slot];
    const pickFinal = bracket?.[finalSlot.slot];
    if (actualFinal && pickFinal) {
      const actualFinalists = new Set([actualFinal.home, actualFinal.away].filter(Boolean));
      const predictedFinalists = [pickFinal.home, pickFinal.away].filter(Boolean);
      for (const team of predictedFinalists) {
        if (actualFinalists.has(team)) finalist_points += KO_FINALIST_POINTS;
      }
      finalist_points = Math.min(finalist_points, 2 * KO_FINALIST_POINTS);
      // Champion: the final's actual advancer matches the predicted advancer.
      if (actualFinal?.final && pickFinal.advances === actualFinal.advances) {
        champion_points = KO_CHAMPION_POINTS;
      }
    }
  }

  const bracket_total =
    round_totals.R32 + round_totals.R16 + round_totals.QF + round_totals.SF +
    finalist_points + champion_points + exact_bonus;

  return { round_points, round_totals, finalist_points, champion_points, exact_bonus, exact_count, bracket_total };
}
