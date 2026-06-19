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

  return (
    <div className="space-y-3">
      {s && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span>Bracket <span className="font-semibold text-emerald-300">{s.bracket_total}</span> pts</span>
          <span className="text-slate-600">·</span>
          <span>Champion: {championPick ? <>{teamFlag(championPick)} {championPick}</> : '—'}{s.champion_points ? ' ✓' : ''}</span>
          <span className="text-slate-600">·</span>
          <span>Finalists {s.finalist_points}</span>
          <span className="text-slate-600">·</span>
          <span>Exact +{s.exact_bonus}</span>
        </div>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max">
          {rounds.map((round, ri) => {
            const notLast = ri < rounds.length - 1;
            return (
              <div key={round} className="flex flex-col justify-around px-3" style={{ minWidth: '162px' }}>
                <div className="mb-2 text-center text-[10px] uppercase tracking-wide text-slate-500">{ROUND_LABELS[round]}</div>
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
