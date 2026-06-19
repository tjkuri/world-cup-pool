import { useMemo } from 'react';
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

const KO_ROUND_LABELS = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarterfinals', SF: 'Semifinals', F: 'Final' };

export function MatchStrip({ fixtures, results, knockout, inKnockoutPhase, onSelect }) {
  const { matchInfo } = useMemo(
    () => (inKnockoutPhase && knockout ? resolveActualBracket(knockout, results) : { matchInfo: {} }),
    [inKnockoutPhase, knockout, results]
  );

  if (inKnockoutPhase && knockout) {
    // Knockout phase: a few recent-result pills + two dropdowns (knockout, group).
    const koFinished = [];
    for (const round of ['R32', 'R16', 'QF', 'SF', 'F']) {
      for (const slot of (knockout.rounds[round] || [])) {
        const r = slot.match_id ? results.matches?.[slot.match_id] : null;
        if (r && isMatchFinal(r.status)) {
          koFinished.push({ mid: slot.match_id, round, slot, kickoff: slot.kickoff_iso || '' });
        }
      }
    }
    // Pills: the most recently kicked-off finished knockout matches.
    const recent = [...koFinished].sort((a, b) => b.kickoff.localeCompare(a.kickoff)).slice(0, 6);
    // Knockout dropdown: all finished knockout matches, grouped by round.
    const koByRound = {};
    for (const item of koFinished) (koByRound[item.round] ??= []).push(item);

    // Group dropdown: all finished group matches, grouped by group letter.
    const { today, yesterday, older } = partitionFinishedMatches(fixtures, results, new Date());
    const allGroupMids = [...today, ...yesterday, ...older];
    const groupByGroup = {};
    for (const mid of allGroupMids) {
      const fx = fixtures.matches[mid];
      const r = results.matches[mid];
      (groupByGroup[fx.group] ??= []).push({ mid, label: optionLabel(fx, r) });
    }
    const groupLetters = Object.keys(groupByGroup).sort();

    if (koFinished.length === 0 && allGroupMids.length === 0) return null;

    const koOptionLabel = (item) => {
      const info = matchInfo[item.slot.slot] || {};
      return `${info.home ?? '?'} ${info.home_score ?? '?'}-${info.away_score ?? '?'} ${info.away ?? '?'}`;
    };
    const selectCls = 'bg-slate-800 text-slate-100 text-sm rounded-md px-2 py-1 ring-1 ring-slate-700 hover:bg-slate-700';
    const onPick = (e) => { if (e.target.value) { onSelect(e.target.value); e.target.value = ''; } };

    return (
      <div className="mb-4 space-y-2">
        {recent.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Recent results</div>
            <div className="flex gap-2 overflow-x-auto">
              {recent.map(({ mid, round, slot }) => {
                const info = matchInfo[slot.slot] || {};
                return (
                  <button
                    key={mid}
                    type="button"
                    onClick={() => onSelect(mid)}
                    className="flex-shrink-0 rounded-full bg-amber-900/60 px-3 py-1 text-sm text-amber-100 hover:bg-amber-800/80 whitespace-nowrap"
                  >
                    {round === 'F' ? 'Final' : round} · {teamFlag(info.home)} {info.home_score ?? '?'}-{info.away_score ?? '?'} {teamFlag(info.away)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          {koFinished.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500" htmlFor="ko-picker">Knockout stage:</label>
              <select id="ko-picker" className={selectCls} value="" onChange={onPick}>
                <option value="">All knockout matches…</option>
                {['R32', 'R16', 'QF', 'SF', 'F'].filter((rd) => koByRound[rd]?.length).map((rd) => (
                  <optgroup key={rd} label={KO_ROUND_LABELS[rd]}>
                    {koByRound[rd].map((item) => (
                      <option key={item.mid} value={item.mid}>{koOptionLabel(item)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
          {allGroupMids.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500" htmlFor="group-picker">Group stage:</label>
              <select id="group-picker" className={selectCls} value="" onChange={onPick}>
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
