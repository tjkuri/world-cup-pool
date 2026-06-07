import { useMemo } from 'react';
import { scoreSubmission } from '../../../lib/score.js';

export function LeaderboardTable({ fixtures, results, submissions, onRowClick }) {
  const scored = useMemo(() => {
    const rows = submissions.map((sub) => {
      const scoring = scoreSubmission(sub.picks, fixtures, results);
      return { ...sub, scoring };
    });
    rows.sort((a, b) => {
      if (b.scoring.total !== a.scoring.total) return b.scoring.total - a.scoring.total;
      if (b.scoring.exact_score_count !== a.scoring.exact_score_count) return b.scoring.exact_score_count - a.scoring.exact_score_count;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [fixtures, results, submissions]);

  if (!scored.length) return <p>No submissions to display yet.</p>;

  return (
    <table className="leaderboard-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Match pts</th>
          <th>Group pts</th>
          <th>Total</th>
          <th>Exact scores</th>
        </tr>
      </thead>
      <tbody>
        {scored.map((entry, i) => (
          <tr key={entry.email_hash} onClick={() => onRowClick(entry)}>
            <td>{i + 1}</td>
            <td>{entry.name}</td>
            <td>{entry.scoring.match_total}</td>
            <td>{entry.scoring.group_total}</td>
            <td><strong>{entry.scoring.total}</strong></td>
            <td>{entry.scoring.exact_score_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
