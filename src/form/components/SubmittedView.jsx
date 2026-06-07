export function SubmittedView({ submittedAt }) {
  return (
    <div className="submitted-view">
      <h2>Picks submitted</h2>
      <p>Recorded at <strong>{submittedAt}</strong>.</p>
      <p>You can re-submit until lock to update your picks — use the same email + secret.</p>
      <p><a href="./leaderboard.html">View leaderboard</a> (it goes live at kickoff).</p>
    </div>
  );
}
