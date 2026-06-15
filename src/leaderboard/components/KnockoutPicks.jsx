import { resolveActualBracket } from '../../../lib/bracket.js';
import { BracketTree } from '../../shared/bracketTree.jsx';

export function KnockoutPicks({ entry, knockout, results }) {
  const picks = entry.knockoutSub.picks.bracket;
  const { matchInfo } = resolveActualBracket(knockout, results);
  const s = entry.bracketScoring;

  const slotInfo = (slot) => {
    const pick = picks[slot] || {};
    const actual = matchInfo[slot] || {};
    let cls = 'pending';
    if (actual.final) cls = pick.advances && pick.advances === actual.advances ? 'hit' : 'miss';
    return { home: pick.home, away: pick.away, advances: pick.advances, cls };
  };

  return (
    <div className="space-y-3">
      {s && (
        <p className="text-xs text-slate-400">
          Bracket: <span className="font-semibold text-emerald-300">{s.bracket_total}</span> pts ·
          R32 {s.round_totals.R32} · R16 {s.round_totals.R16} · QF {s.round_totals.QF} · SF {s.round_totals.SF} ·
          Finalists {s.finalist_points} · Champion {s.champion_points} · Exact +{s.exact_bonus}
        </p>
      )}
      <BracketTree knockout={knockout} slotInfo={slotInfo} />
      <p className="text-xs text-slate-500">Champion pick: {entry.knockoutSub.picks.champion || '—'}</p>
    </div>
  );
}
