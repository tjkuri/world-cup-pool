// Pool-consensus analytics for the stats "Superlatives": how much the field
// agreed on each match, who was rewarded for correct low-consensus calls
// (Hipster), and who most backed the bookmakers' favorite (Chalk-Eater).
import { deriveWinner } from './derive.js';
import { isMatchFinal } from './status.js';

function predictedOutcome(pick) {
  return deriveWinner(pick.home_score, pick.away_score); // 'home'|'away'|'draw'
}

export function pickConsensus(submissions, fixtures) {
  const tally = new Map();
  for (const sub of submissions) {
    if (sub.phase === 'knockout') continue;
    for (const [mid, pick] of Object.entries(sub.picks?.matches || {})) {
      if (!fixtures?.matches?.[mid]) continue;
      const o = predictedOutcome(pick);
      const t = tally.get(mid) || { home: 0, draw: 0, away: 0 };
      t[o] += 1;
      tally.set(mid, t);
    }
  }
  const out = new Map();
  for (const [mid, t] of tally) {
    const total = t.home + t.draw + t.away;
    // Ties resolve to the earliest of home > draw > away — deterministic but arbitrary.
    const modal = ['home', 'draw', 'away'].reduce((a, b) => (t[b] > t[a] ? b : a), 'home');
    out.set(mid, { ...t, modal, share: total ? t[modal] / total : 0 });
  }
  return out;
}

// The entrant's correct low-consensus picks, with per-match detail (Hipster hover):
// which matchup, the entrant's scoreline, and the share of the pool that agreed.
export function contrarianCorrectMatches(sub, fixtures, results, consensus, threshold = 0.34) {
  if (sub.phase === 'knockout') return [];
  const out = [];
  for (const [mid, pick] of Object.entries(sub.picks?.matches || {})) {
    const r = results?.matches?.[mid];
    if (!r || !isMatchFinal(r.status)) continue;
    const predicted = predictedOutcome(pick);
    const actual = deriveWinner(r.home_score, r.away_score);
    if (predicted !== actual) continue; // must be correct
    const c = consensus.get(mid);
    if (!c) continue;
    const total = c.home + c.draw + c.away;
    const share = total ? c[predicted] / total : 0;
    if (share < threshold) {
      out.push({ matchId: mid, home: pick.home, away: pick.away, home_score: pick.home_score, away_score: pick.away_score, share });
    }
  }
  return out;
}

// Count of correct low-consensus picks (Hipster). Delegates to the detail fn.
export function contrarianCorrect(sub, fixtures, results, consensus, threshold = 0.34) {
  return contrarianCorrectMatches(sub, fixtures, results, consensus, threshold).length;
}

export function chalkScore(sub, fixtures, odds) {
  if (sub.phase === 'knockout') return 0;
  let n = 0;
  for (const [mid, pick] of Object.entries(sub.picks?.matches || {})) {
    const o = odds?.matches?.[mid];
    if (!o) continue;
    const fav = ['home', 'draw', 'away'].reduce(
      (a, b) => (o[`${b}_implied`] > o[`${a}_implied`] ? b : a), 'home');
    if (predictedOutcome(pick) === fav) n += 1;
  }
  return n;
}

// Giant Slayer: correctly-called upsets — the lower win-probability team actually
// won and the entrant predicted that side. Near-even matches (favorite−underdog
// implied gap < `gap`) are excluded so it rewards real upsets, not coin-flips.
// Group phase only (odds cover the group stage).
export function upsetScore(sub, fixtures, odds, results, gap = 0.10) {
  if (sub.phase === 'knockout') return 0;
  let n = 0;
  for (const [mid, pick] of Object.entries(sub.picks?.matches || {})) {
    const o = odds?.matches?.[mid];
    const r = results?.matches?.[mid];
    if (!o || !r || !isMatchFinal(r.status)) continue;
    const underdog = o.home_implied < o.away_implied ? 'home' : 'away';
    if (Math.max(o.home_implied, o.away_implied) - Math.min(o.home_implied, o.away_implied) < gap) continue;
    const predicted = predictedOutcome(pick);
    const actual = deriveWinner(r.home_score, r.away_score);
    if (predicted === underdog && actual === underdog) n += 1; // called it AND it happened
  }
  return n;
}
