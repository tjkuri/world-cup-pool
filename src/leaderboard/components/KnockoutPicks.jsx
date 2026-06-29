import { resolveActualBracket, KO_ROUND_ORDER } from '../../../lib/bracket.js';
import { scoreKnockoutMatch } from '../../../lib/score.js';
import { teamFlag } from '../../shared/teamNames.js';

const ROUND_LABELS = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarterfinals', SF: 'Semifinals', F: 'Final' };

// A person's knockout bracket, rendered as a bracket. It's THEIR predicted tree,
// annotated against reality: a team carried into a round it never actually
// reached is muted grey; ▸ marks the team they picked to advance; the cell is
// outlined when they called the advancer right (gold for the champion); every
// match shows the real result and the points earned.
export function KnockoutPicks({ entry, knockout, results }) {
  const picks = entry.knockoutSub.picks.bracket || {};
  const championPick = entry.knockoutSub.picks.champion ?? null;
  const { matchInfo } = resolveActualBracket(knockout, results);
  const s = entry.bracketScoring;
  const rounds = KO_ROUND_ORDER.filter((r) => (knockout.rounds[r] || []).length > 0);

  // Slim summary stats: correct advancers, exact scorelines, and per-round
  // "how many of the teams that actually reached this round did you have here".
  let correctWinners = 0;
  for (const round of rounds) {
    for (const slot of knockout.rounds[round]) {
      const p = picks[slot.slot];
      const a = matchInfo[slot.slot];
      if (a?.final && p?.advances && p.advances === a.advances) correctWinners++;
    }
  }
  const reachStat = (round) => {
    const actual = new Set();
    const predicted = new Set();
    for (const slot of (knockout.rounds[round] || [])) {
      const a = matchInfo[slot.slot] || {};
      if (a.home) actual.add(a.home);
      if (a.away) actual.add(a.away);
      const p = picks[slot.slot] || {};
      if (p.home) predicted.add(p.home);
      if (p.away) predicted.add(p.away);
    }
    let hit = 0;
    for (const t of predicted) if (actual.has(t)) hit++;
    return { hit, total: actual.size };
  };
  const qf = reachStat('QF');
  const sf = reachStat('SF');
  const championRight = !!(s && s.champion_points > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
        <span className="text-slate-400">
          🏆 <span className={`font-semibold ${championRight ? 'text-emerald-300' : 'text-slate-200'}`}>
            {championPick ? <>{teamFlag(championPick)} {championPick}</> : '—'}
          </span>
        </span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400"><span className="font-semibold text-slate-200">{correctWinners}</span> winners</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400"><span className="font-semibold text-slate-200">{s?.exact_count ?? 0}</span> exact</span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {qf.total > 0 && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 ring-1 ring-inset ring-slate-700">QF {qf.hit}/{qf.total}</span>}
          {sf.total > 0 && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 ring-1 ring-inset ring-slate-700">SF {sf.hit}/{sf.total}</span>}
          <span className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ring-inset ${championRight ? 'bg-amber-500/20 text-amber-300 ring-amber-400/40' : 'bg-slate-800 text-slate-500 ring-slate-700'}`}>
            🏆 {championRight ? 'Champion ✓' : 'Champion ✗'}
          </span>
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max">
          {rounds.map((round, ri) => {
            const notLast = ri < rounds.length - 1;
            return (
              <div key={round} className="flex flex-col px-3" style={{ minWidth: '162px' }}>
                <div className="mb-2 text-center text-[10px] uppercase tracking-wide text-slate-500">{ROUND_LABELS[round]}</div>
                <div className="flex flex-1 flex-col justify-around">
                {knockout.rounds[round].map((slot) => {
                  const pick = picks[slot.slot] || {};
                  const actual = matchInfo[slot.slot] || {};
                  const m = scoreKnockoutMatch(round, pick, actual);
                  const isFinal = round === 'F';
                  const championRight = isFinal && m.correctAdvancer;
                  const participants = [actual.home, actual.away].filter(Boolean);
                  const teamCls = (t) =>
                    !t ? 'text-slate-600'
                    : (actual.final && !participants.includes(t)) ? 'text-slate-500'
                    : 'text-slate-200';
                  const cellCls = [
                    'relative my-2 rounded-md border px-2 py-1 font-mono text-xs',
                    notLast ? "after:absolute after:-right-3 after:top-1/2 after:h-px after:w-3 after:bg-slate-700 after:content-['']" : '',
                    championRight ? 'border-amber-400 bg-amber-500/10'
                      : m.correctAdvancer ? 'border-emerald-500/70 bg-emerald-500/5'
                      : 'border-slate-800 bg-slate-900',
                  ].join(' ');
                  const ptsCls = m.exact ? 'text-emerald-300' : m.correctAdvancer ? 'text-sky-300' : 'text-slate-500';
                  const teams = [
                    [pick.home, pick.home_score],
                    [pick.away, pick.away_score],
                  ];
                  return (
                    <div key={slot.slot} className={cellCls}>
                      {teams.map(([t, sc], i) => {
                        const isAdv = pick.advances && t && pick.advances === t;
                        return (
                          <div key={i} className="flex items-center gap-1">
                            <span className="w-2.5 text-slate-300">{isAdv ? '▸' : ''}</span>
                            <span className={`flex-1 ${teamCls(t)} ${isAdv ? 'font-semibold' : ''}`}>
                              {t ? <>{teamFlag(t)} {t}</> : '—'}
                            </span>
                            <span className="tabular-nums text-slate-500">{Number.isInteger(sc) ? sc : '–'}</span>
                          </div>
                        );
                      })}
                      <div className="mt-1 flex items-center justify-between border-t border-slate-800/60 pt-1 text-[10px]">
                        <span className="text-slate-500">
                          {actual.final
                            ? <>real {teamFlag(actual.home)} {actual.home_score}–{actual.away_score} {teamFlag(actual.away)}</>
                            : 'pending'}
                        </span>
                        <span className={`font-semibold tabular-nums ${ptsCls}`}>
                          {championRight && '🏆 '}{m.exact && '🎯 '}{actual.final ? (m.points > 0 ? `+${m.points}` : '0') : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
