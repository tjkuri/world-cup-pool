import { scoreSubmission } from '../lib/score.js';

export function renderLeaderboardTable(rootEl, payload, onRowClick) {
  const { fixtures, results, submissions } = payload;
  rootEl.innerHTML = '';

  if (!submissions.length) {
    rootEl.innerHTML = '<p>No submissions to display yet.</p>';
    return;
  }

  // Score everyone, sort by total desc.
  const scored = submissions.map(sub => {
    const scoring = scoreSubmission(sub.picks, fixtures, results);
    return {
      name: sub.name,
      email_hash: sub.email_hash,
      submitted_at: sub.submitted_at,
      picks: sub.picks,
      scoring,
    };
  });
  scored.sort((a, b) => {
    if (b.scoring.total !== a.scoring.total) return b.scoring.total - a.scoring.total;
    if (b.scoring.exact_score_count !== a.scoring.exact_score_count) return b.scoring.exact_score_count - a.scoring.exact_score_count;
    return a.name.localeCompare(b.name);
  });

  const table = document.createElement('table');
  table.className = 'leaderboard-table';
  table.innerHTML = `
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
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  scored.forEach((entry, i) => {
    const tr = document.createElement('tr');
    tr.dataset.emailHash = entry.email_hash;
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(entry.name)}</td>
      <td>${entry.scoring.match_total}</td>
      <td>${entry.scoring.group_total}</td>
      <td><strong>${entry.scoring.total}</strong></td>
      <td>${entry.scoring.exact_score_count}</td>
    `;
    tr.addEventListener('click', () => onRowClick(entry, { fixtures, results }));
    tbody.appendChild(tr);
  });
  rootEl.appendChild(table);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
