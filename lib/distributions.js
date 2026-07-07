// Distributions for the stats page. exactCountHistogram: whole-tournament exact-
// score count per entrant (group exact + knockout exact), bucketed into a
// histogram of "how many players nailed exactly N exact scores".
import { scoreSubmission, scoreBracket } from './score.js';

export function exactCountHistogram(submissions, fixtures, results, knockout) {
  const byEmail = new Map();
  for (const sub of submissions || []) {
    const row = byEmail.get(sub.email_hash) || { group: null, ko: null };
    if (sub.phase === 'knockout') row.ko = sub; else row.group = sub;
    byEmail.set(sub.email_hash, row);
  }

  const counts = [];
  for (const row of byEmail.values()) {
    const g = row.group ? scoreSubmission(row.group.picks, fixtures, results).exact_score_count : 0;
    const k = (row.ko && knockout) ? scoreBracket(row.ko.picks.bracket, knockout, results).exact_count : 0;
    counts.push(g + k);
  }
  if (!counts.length) return [];

  const max = Math.max(...counts);
  const hist = [];
  for (let x = 0; x <= max; x++) {
    hist.push({ exact: x, players: counts.filter((c) => c === x).length });
  }
  return hist;
}
