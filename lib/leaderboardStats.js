import { isMatchFinal } from './status.js';

// Partition the finished matches into today / yesterday / older buckets.
// Day comparison uses each viewer's local TZ via .toDateString(); pass `refDate`
// to make the function pure/testable.
export function partitionFinishedMatches(fixtures, results, refDate) {
  const ref = refDate.toDateString();
  const refMinus = new Date(refDate);
  refMinus.setDate(refDate.getDate() - 1);
  const refMinusStr = refMinus.toDateString();
  const out = { today: [], yesterday: [], older: [] };
  const finished = Object.entries(fixtures.matches)
    .filter(([mid]) => isMatchFinal(results?.matches?.[mid]?.status))
    .sort((a, b) => b[1].kickoff_iso.localeCompare(a[1].kickoff_iso));
  for (const [mid, fx] of finished) {
    const d = new Date(fx.kickoff_iso).toDateString();
    if (d === ref) out.today.push(mid);
    else if (d === refMinusStr) out.yesterday.push(mid);
    else out.older.push(mid);
  }
  return out;
}

// Summary stats rendered in the MatchModal header band.
// Consensus is a strict plurality; if the top pick is tied with another, returns null.
export function computeMatchSummary(matchId, entries) {
  const totalCount = entries.length;
  let exactCount = 0;
  let winnerCount = 0;
  const pickCounts = new Map();
  for (const e of entries) {
    const pts = e.scoring?.match_points?.[matchId];
    if (pts >= 6) exactCount += 1;
    if (pts >= 3) winnerCount += 1;
    const pick = e.picks?.matches?.[matchId];
    if (pick && Number.isFinite(pick.home_score) && Number.isFinite(pick.away_score)) {
      const key = `${pick.home_score}-${pick.away_score}`;
      pickCounts.set(key, (pickCounts.get(key) || 0) + 1);
    }
  }
  let topKey = null;
  let topCount = 0;
  let tieAtTop = false;
  for (const [key, count] of pickCounts.entries()) {
    if (count > topCount) { topKey = key; topCount = count; tieAtTop = false; }
    else if (count === topCount && topCount > 0) { tieAtTop = true; }
  }
  return { exactCount, winnerCount, totalCount, consensus: tieAtTop ? null : topKey };
}
