export function SubmittedView({ submittedAt }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-emerald-500/40 bg-slate-900 p-6 text-center">
      <h2 className="mb-2 text-xl font-semibold text-emerald-300">Picks submitted</h2>
      <p className="text-slate-300">Submitted {new Date(submittedAt).toLocaleString()}.</p>
      <p className="mt-2 text-slate-300">You can re-submit until lock to update your picks — use the same email + secret.</p>
      <p className="mt-2 text-slate-400">
        <a href="./leaderboard.html" className="text-emerald-300 hover:text-emerald-400 underline">View leaderboard</a>
        {' '}(it goes live at kickoff).
      </p>
    </div>
  );
}
