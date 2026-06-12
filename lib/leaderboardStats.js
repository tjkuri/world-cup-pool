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
