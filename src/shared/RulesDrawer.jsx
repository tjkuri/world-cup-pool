import { useEffect } from 'react';

export function RulesDrawer({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="rules-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rules-drawer">
        <button type="button" className="close" aria-label="Close" onClick={onClose}>×</button>
        <h2>Pool Rules</h2>

        <h3>Group Stage</h3>
        <p>For each of the 72 group stage matches, predict the exact score. Winner/draw is derived from the scores.</p>

        <h3>Scoring</h3>
        <ul>
          <li><strong>Correct winner or draw, wrong score:</strong> 3 points.</li>
          <li><strong>Exact score correct:</strong> 5 points (3 + 2 bonus).</li>
          <li><strong>Wrong winner:</strong> 0 points.</li>
        </ul>

        <h3>Group Standings</h3>
        <p>
          Your predicted standings are derived live from your match score predictions, applying the FIFA tiebreaker chain
          (points → goal difference → goals scored → head-to-head). When your scores leave teams tied, you'll be prompted
          to drag-rank them.
        </p>
        <ul>
          <li><strong>Correct 1st place:</strong> 5 points.</li>
          <li><strong>Correct 2nd place:</strong> 3 points.</li>
          <li><strong>Perfect group order (1st–4th all correct):</strong> +3 bonus.</li>
        </ul>

        <h3>Submissions</h3>
        <p>
          Submissions lock at the kickoff of the tournament's first match. After lock, all picks become visible on the
          leaderboard. You may re-submit until lock — your most recent valid submission wins.
        </p>

        <h3>Identity &amp; Secret</h3>
        <p>
          You enter a name, email, and a secret of your choosing. The secret prevents others from submitting picks under
          your email. Save it somewhere — re-submissions require it.
        </p>

        <h3>Knockout Stage</h3>
        <p><em>Details for the knockout bracket challenge will be posted before the group stage ends.</em></p>
      </div>
    </div>
  );
}
