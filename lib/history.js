// lib/history.js
// Reconstructs the leaderboard at every historical results snapshot by replaying
// the (locked) submissions through the existing pure scorers. Picks never change,
// so given the same git history this is deterministic.
import { scoreSubmission, scoreBracket } from './score.js';

function groupByEmail(submissions) {
  const byEmail = new Map();
  for (const sub of submissions) {
    const row = byEmail.get(sub.email_hash) || { email_hash: sub.email_hash, name: sub.name, group: null, knockout: null };
    if (sub.phase === 'knockout') row.knockout = sub; else row.group = sub;
    row.name = sub.name; // latest name wins
    byEmail.set(sub.email_hash, row);
  }
  return [...byEmail.values()];
}

export function buildHistorySeries({ snapshots, submissions, fixtures, knockout }) {
  const rows = groupByEmail(submissions);
  const out = snapshots.map(({ t, results }) => {
    const standings = rows.map((row) => {
      const g = row.group ? scoreSubmission(row.group.picks, fixtures, results) : null;
      const b = (row.knockout && knockout) ? scoreBracket(row.knockout.picks.bracket, knockout, results) : null;
      const groupTotal = g ? g.total : 0;
      const bracketTotal = b ? b.bracket_total : 0;
      return { email_hash: row.email_hash, name: row.name, groupTotal, bracketTotal, total: groupTotal + bracketTotal };
    });
    return { t, standings };
  });
  return { snapshots: out };
}

function rankSnapshot(standings) {
  const sorted = [...standings].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const rankByEmail = new Map();
  sorted.forEach((s, i) => rankByEmail.set(s.email_hash, i + 1));
  return rankByEmail;
}

export function rankMovements(series) {
  const snaps = series.snapshots;
  if (!snaps.length) return [];
  const firstScoredIdx = snaps.findIndex((s) => s.standings.some((x) => x.total > 0));
  const baseIdx = firstScoredIdx === -1 ? 0 : firstScoredIdx;
  const firstRanks = rankSnapshot(snaps[baseIdx].standings);
  const lastRanks = rankSnapshot(snaps[snaps.length - 1].standings);
  return snaps[snaps.length - 1].standings.map((s) => {
    const firstRank = firstRanks.get(s.email_hash);
    const lastRank = lastRanks.get(s.email_hash);
    return { email_hash: s.email_hash, name: s.name, firstRank, lastRank, delta: firstRank - lastRank };
  });
}
