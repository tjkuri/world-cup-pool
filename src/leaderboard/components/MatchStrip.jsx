import { partitionFinishedMatches } from '../../../lib/leaderboardStats.js';
import { teamFlag } from '../../shared/teamNames.js';

function chipLabel(fx, result) {
  return `${teamFlag(fx.home)} ${result.home_score}-${result.away_score} ${teamFlag(fx.away)}`;
}

function optionLabel(fx, result) {
  return `${fx.home} ${result.home_score}-${result.away_score} ${fx.away}`;
}

export function MatchStrip({ fixtures, results, onSelect }) {
  const { today, yesterday, older } = partitionFinishedMatches(fixtures, results, new Date());

  if (today.length + yesterday.length + older.length === 0) return null;

  function chips(mids) {
    return mids.map((mid) => {
      const fx = fixtures.matches[mid];
      const r = results.matches[mid];
      return (
        <button
          key={mid}
          type="button"
          onClick={() => onSelect(mid)}
          className="flex-shrink-0 rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-100 hover:bg-slate-700 whitespace-nowrap"
        >
          {chipLabel(fx, r)}
        </button>
      );
    });
  }

  // The picker covers only matches NOT in today/yesterday chips.
  const olderByGroup = {};
  for (const mid of older) {
    const fx = fixtures.matches[mid];
    const r = results.matches[mid];
    if (!olderByGroup[fx.group]) olderByGroup[fx.group] = [];
    olderByGroup[fx.group].push({ mid, label: optionLabel(fx, r) });
  }
  const olderGroupLetters = Object.keys(olderByGroup).sort();

  return (
    <div className="mb-4 space-y-2">
      {today.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Today</div>
          <div className="flex gap-2 overflow-x-auto">{chips(today)}</div>
        </div>
      )}
      {yesterday.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Yesterday</div>
          <div className="flex gap-2 overflow-x-auto">{chips(yesterday)}</div>
        </div>
      )}
      {older.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <label className="text-xs text-slate-500" htmlFor="match-picker">More:</label>
          <select
            id="match-picker"
            className="bg-slate-800 text-slate-100 text-sm rounded-md px-2 py-1 ring-1 ring-slate-700 hover:bg-slate-700"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onSelect(e.target.value);
                e.target.value = '';
              }
            }}
          >
            <option value="">All matches…</option>
            {olderGroupLetters.map((letter) => (
              <optgroup key={letter} label={`Group ${letter}`}>
                {olderByGroup[letter].map(({ mid, label }) => (
                  <option key={mid} value={mid}>{label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
