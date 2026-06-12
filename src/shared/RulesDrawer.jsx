import { useEffect } from 'react';

export function RulesDrawer({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-drawer-title"
        className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="mb-4 rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
          onClick={onClose}
        >
          Close
        </button>
        <h2 id="rules-drawer-title" className="mb-3 text-lg font-semibold text-slate-100">Pool Rules</h2>

        <div className="space-y-3 text-sm text-slate-300">
          <h3 className="mt-4 mb-2 text-base font-semibold text-slate-100">Format &amp; Prizes</h3>
          <p className="mb-2 text-sm text-slate-300">
            Two phases: <strong className="text-slate-100">Group Stage</strong> (all 72 group matches + predicted standings)
            and <strong className="text-slate-100">Knockout Bracket</strong> (R32 through Final).
            Everyone plays both phases — no one is eliminated after group stage. Group-stage points carry into the knockout.
          </p>
          <ul className="mb-2 list-disc pl-5 text-sm text-slate-300">
            <li><strong className="text-slate-100">30% of the pot</strong> → top points scorer after the group stage.</li>
            <li><strong className="text-slate-100">70% of the pot</strong> → top points scorer after the Final (group + knockout combined).</li>
          </ul>

          <h3 className="mt-4 mb-2 text-base font-semibold text-slate-100">Group Stage — Match Scoring</h3>
          <p className="mb-2 text-sm text-slate-300">For each of the 72 group stage matches, predict the exact score. Winner/draw is derived from the scores.</p>
          <ul className="mb-2 list-disc pl-5 text-sm text-slate-300">
            <li><strong className="text-slate-100">Correct winner or draw, wrong score:</strong> 3 points.</li>
            <li><strong className="text-slate-100">Exact score correct:</strong> 6 points (3 + 3 bonus).</li>
            <li><strong className="text-slate-100">Wrong winner:</strong> 0 points.</li>
          </ul>

          <h3 className="mt-4 mb-2 text-base font-semibold text-slate-100">Group Stage — Standings</h3>
          <p className="mb-2 text-sm text-slate-300">
            Your predicted standings are derived live from your match score predictions, applying the FIFA tiebreaker chain
            (points → goal difference → goals scored → head-to-head). When your scores leave teams tied, you'll be prompted
            to drag-rank them.
          </p>
          <ul className="mb-2 list-disc pl-5 text-sm text-slate-300">
            <li><strong className="text-slate-100">Correct 1st place:</strong> 15 points.</li>
            <li><strong className="text-slate-100">Correct 2nd place:</strong> 8 points.</li>
            <li><strong className="text-slate-100">Correct 3rd place:</strong> 4 points.</li>
            <li><strong className="text-slate-100">Perfect group order (1st–4th all correct):</strong> +8 bonus.</li>
          </ul>
          <p className="mb-2 text-xs text-slate-400">Max per group: 36 (matches) + 35 (standings) = 71 pts. Across all 12 groups: 852 pts max.</p>

          <h3 className="mt-4 mb-2 text-base font-semibold text-slate-100">Knockout Bracket</h3>
          <p className="mb-2 text-sm text-slate-300">
            Before the Round of 32 kicks off, submit your complete bracket: R32 winners → R16 → QF → SF → Finalists → Champion.
            You'll also predict the score of each knockout match. Phase 2 picks open after the group stage ends.
          </p>
          <ul className="mb-2 list-disc pl-5 text-sm text-slate-300">
            <li><strong className="text-slate-100">R32 winner:</strong> 4 pts each (16 matches).</li>
            <li><strong className="text-slate-100">R16 winner:</strong> 8 pts each (8 matches).</li>
            <li><strong className="text-slate-100">Quarterfinal winner:</strong> 16 pts each (4 matches).</li>
            <li><strong className="text-slate-100">Semifinal winner:</strong> 32 pts each (2 matches).</li>
            <li><strong className="text-slate-100">Correct finalist:</strong> 50 pts each (100 max).</li>
            <li><strong className="text-slate-100">Correct champion:</strong> 80 pts.</li>
            <li><strong className="text-slate-100">Exact score on any knockout match:</strong> +3 bonus.</li>
            <li><strong className="text-slate-100">Exact score on the Final:</strong> +5 bonus (instead of +3).</li>
          </ul>
          <p className="mb-2 text-xs text-slate-400">Knockout max: ~531 pts. Total tournament max: ~1,383 pts.</p>

          <h3 className="mt-4 mb-2 text-base font-semibold text-slate-100">Submissions</h3>
          <p className="mb-2 text-sm text-slate-300">
            Group-stage submissions lock at kickoff of the tournament's first match. After lock, all picks become visible on
            the leaderboard. You may re-submit until lock — your most recent valid submission wins.
          </p>

          <h3 className="mt-4 mb-2 text-base font-semibold text-slate-100">Identity &amp; Secret</h3>
          <p className="mb-2 text-sm text-slate-300">
            You enter a name, email, and a secret of your choosing. The secret prevents others from submitting picks under
            your email. Save it somewhere — re-submissions (and your knockout bracket entry) require it.
          </p>
        </div>
      </aside>
    </div>
  );
}
