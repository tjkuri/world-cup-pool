import { deriveWinner } from './derive.js';
import { computeStandings } from './standings.js';
import { isMatchFinal } from './status.js';

const POINTS_WINNER = 3;
const POINTS_EXACT_BONUS = 3;
const POINTS_FIRST_PLACE = 15;
const POINTS_SECOND_PLACE = 8;
const POINTS_THIRD_PLACE = 4;
const POINTS_PERFECT_ORDER = 8;

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
