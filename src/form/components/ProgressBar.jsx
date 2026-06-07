export function ProgressBar({ state, fixtures }) {
  const totalMatches = Object.keys(fixtures.matches).length;
  let filled = 0;
  for (const mid of Object.keys(fixtures.matches)) {
    const p = state.matches[mid];
    if (p && Number.isInteger(p.home_score) && Number.isInteger(p.away_score)) filled++;
  }
  return (
    <div className="progress">
      <span className="progress-count">
        {filled} / {totalMatches} match picks complete
      </span>
    </div>
  );
}
