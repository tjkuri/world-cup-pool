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

// "Most exact scores" callout: highest exact_score_count, names alpha-sorted.
// Format: "Alice (3 exact)" or "Alice, Bob and 2 others (2 exact)".
export function computeMostExact(entries) {
  if (!entries?.length) return { count: 0, names: [], label: '—' };
  let max = 0;
  for (const e of entries) {
    if (e.scoring.exact_score_count > max) max = e.scoring.exact_score_count;
  }
  const names = entries
    .filter((e) => e.scoring.exact_score_count === max)
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
  const head = names.slice(0, 2).join(', ');
  const rest = names.length > 2 ? ` and ${names.length - 2} others` : '';
  return { count: max, names, label: `${head}${rest} (${max} exact)` };
}

// "Lead" callout: leader's gap over runner-up, or N-way tie at top.
export function computeLeadStat(entries) {
  if (!entries?.length) return { label: '—' };
  const sorted = [...entries].sort((a, b) => b.scoring.total - a.scoring.total);
  const top = sorted[0].scoring.total;
  const topNames = sorted.filter((e) => e.scoring.total === top).map((e) => e.name);
  if (topNames.length > 1) {
    return { label: `${topNames.length}-way tie at ${top} pts` };
  }
  const second = sorted.find((e) => e.scoring.total < top);
  if (!second) return { label: `${sorted[0].name} (${top} pts)` };
  const gap = top - second.scoring.total;
  return { label: `${sorted[0].name} +${gap} over ${second.name}` };
}

// "Top on latest match" callout: highest match_points on the latest finished
// match. Ties broken alphabetically by name.
export function computeLatestMatchTop(entries, fixtures, results) {
  if (!entries?.length || !fixtures || !results) return null;
  let latestMid = null;
  let latestKick = '';
  for (const [mid, fx] of Object.entries(fixtures.matches)) {
    if (!isMatchFinal(results.matches?.[mid]?.status)) continue;
    if (fx.kickoff_iso > latestKick) {
      latestKick = fx.kickoff_iso;
      latestMid = mid;
    }
  }
  if (!latestMid) return null;
  const fx = fixtures.matches[latestMid];
  const r = results.matches[latestMid];
  let topName = null;
  let topPts = -1;
  for (const e of entries) {
    const pts = e.scoring.match_points?.[latestMid] ?? 0;
    if (pts > topPts) { topPts = pts; topName = e.name; }
    else if (pts === topPts && topName && e.name.localeCompare(topName) < 0) { topName = e.name; }
  }
  if (topName === null) return null;
  return {
    matchId: latestMid,
    matchLabel: `${fx.home} ${r.home_score}-${r.away_score} ${fx.away}`,
    name: topName,
    points: topPts,
    label: `${topName} +${topPts}`,
  };
}
