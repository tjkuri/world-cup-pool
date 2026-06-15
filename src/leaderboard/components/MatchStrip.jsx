import { partitionFinishedMatches } from '../../../lib/leaderboardStats.js';
import { isMatchFinal } from '../../../lib/status.js';
import { resolveActualBracket } from '../../../lib/bracket.js';
import { teamFlag } from '../../shared/teamNames.js';

function chipLabel(fx, result) {
  return `${teamFlag(fx.home)} ${result.home_score}-${result.away_score} ${teamFlag(fx.away)}`;
}

function optionLabel(fx, result) {
  return `${fx.home} ${result.home_score}-${result.away_score} ${fx.away}`;
}

function knockoutChips(knockout, results) {
  const out = [];
  for (const round of ['F', 'SF', 'QF', 'R16', 'R32']) {
    for (const slot of (knockout.rounds[round] || [])) {
      const r = slot.match_id ? results.matches?.[slot.match_id] : null;
      if (r && isMatchFinal(r.status)) out.push({ mid: slot.match_id, round, slot });
    }
  }
  return out;
}

export function MatchStrip({ fixtures, results, knockout, inKnockoutPhase, onSelect }) {
  if (inKnockoutPhase && knockout) {
    // Knockout phase: prominent KO chips, group matches demoted to a dropdown.
    const koChips = knockoutChips(knockout, results);
    const { matchInfo } = resolveActualBracket(knockout, results);

    // Build group-stage finished matches for the dropdown.
    const { today, yesterday, older } = partitionFinishedMatches(fixtures, results, new Date());
    const allGroupMids = [...today, ...yesterday, ...older];
    const groupByGroup = {};
    for (const mid of allGroupMids) {
      const fx = fixtures.matches[mid];
      const r = results.matches[mid];
      if (!groupByGroup[fx.group]) groupByGroup[fx.group] = [];
      groupByGroup[fx.group].push({ mid, label: optionLabel(fx, r) });
    }
    const groupLetters = Object.keys(groupByGroup).sort();

    if (koChips.length === 0 && allGroupMids.length === 0) return null;

    return (
      <div className="mb-4 space-y-2">
        {koChips.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Knockout</div>
            <div className="flex gap-2 overflow-x-auto flex-wrap">
              {koChips.map(({ mid, round, slot }) => {
                const info = matchInfo[slot.slot];
                const home = info?.home ?? '?';
                const away = info?.away ?? '?';
                const hs = info?.home_score ?? '?';
                const as_ = info?.away_score ?? '?';
                return (
                  <button
                    key={mid}
                    type="button"
                    onClick={() => onSelect(mid)}
                    className="flex-shrink-0 rounded-full bg-amber-900/60 px-3 py-1 text-sm text-amber-100 hover:bg-amber-800/80 whitespace-nowrap"
                  >
                    {round} · {teamFlag(home)} {hs}-{as_} {teamFlag(away)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {allGroupMids.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <label className="text-xs text-slate-500" htmlFor="match-picker">Group stage:</label>
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
              <option value="">All group matches…</option>
              {groupLetters.map((letter) => (
                <optgroup key={letter} label={`Group ${letter}`}>
                  {groupByGroup[letter].map(({ mid, label }) => (
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

  // Group phase (default): existing behavior — Today/Yesterday chips + older dropdown.
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
