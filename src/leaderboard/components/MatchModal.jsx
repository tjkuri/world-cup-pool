import { useEffect, useMemo } from 'react';
import { teamFlag, teamName } from '../../shared/teamNames.js';
import { computeMatchSummary } from '../../../lib/leaderboardStats.js';
import { resolveActualBracket } from '../../../lib/bracket.js';
import { scoreKnockoutMatch } from '../../../lib/score.js';
import { isMatchFinal } from '../../../lib/status.js';

const OUTCOME_CLASSES = {
  exact: 'text-emerald-300',
  winner: 'text-sky-300',
  wrong: 'text-rose-400',
};

function classForPoints(pts) {
  if (pts >= 6) return OUTCOME_CLASSES.exact;
  if (pts === 3) return OUTCOME_CLASSES.winner;
  return OUTCOME_CLASSES.wrong;
}

// Per-person knockout row state, by how their pick landed on this match.
//  perfect   — advanced + exact score (the works)  · winner    — advanced, wrong score
//  exactPens — nailed the score but lost on pens    · ingame    — picked the OTHER team (lost)
//  out       — their team isn't in this match
// PERFECT is the only uppercase badge so it pops; the rest are lowercase.
const KO_STATE_BADGE = {
  perfect:   { label: 'PERFECT 🎯',  cls: 'bg-emerald-400/15 text-emerald-300 tracking-wide' },
  exactPens: { label: '🎯 lost pens', cls: 'bg-teal-400/15 text-teal-300' },
  winner:    { label: 'winner',       cls: 'bg-sky-400/15 text-sky-300' },
  ingame:    { label: 'in game',      cls: 'bg-amber-400/15 text-amber-300' },
  out:       { label: 'out',          cls: 'bg-slate-700/50 text-slate-400' },
};
// Score/flags stay neutral — the badge carries the colour signal.
const KO_STATE_TEXT = {
  perfect: 'text-slate-200', exactPens: 'text-slate-200', winner: 'text-slate-200',
  ingame: 'text-slate-400', out: 'text-slate-500', pending: 'text-slate-400',
};

// Derive a human-readable round label from the slot string (e.g. "R16-1" → "R16").
function roundLabel(slotStr) {
  const dash = slotStr.indexOf('-');
  return dash === -1 ? slotStr : slotStr.slice(0, dash);
}

// ---- Knockout match modal ----
function KnockoutMatchModal({ matchId, slot, knockout, results, entries, onClose, onSelectEntry }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    history.replaceState(null, '', `#match/${matchId}`);
    return () => {
      document.removeEventListener('keydown', onKey);
      history.replaceState(null, '', location.pathname + location.search);
    };
  }, [matchId, onClose]);

  const { matchInfo } = useMemo(() => resolveActualBracket(knockout, results), [knockout, results]);
  const info = matchInfo[slot.slot];
  const round = roundLabel(slot.slot);

  const rows = useMemo(() => {
    const actualPair = [info?.home, info?.away].filter(Boolean);
    return entries
      .filter((e) => e.knockoutSub != null)
      .map((e) => {
        const pick = e.knockoutSub.picks.bracket[slot.slot] ?? {};
        const m = scoreKnockoutMatch(round, pick, info);
        // Row state: advancing (winner pts) and exact score are independent —
        // the only way to be exact-but-not-advanced is losing a pens shootout.
        const advInMatch = pick.advances && actualPair.includes(pick.advances);
        let state;
        if (!info?.final) state = 'pending';
        else if (m.exact && m.correctAdvancer) state = 'perfect';
        else if (m.exact) state = 'exactPens';
        else if (m.correctAdvancer) state = 'winner';
        else if (advInMatch) state = 'ingame';
        else state = 'out';
        // Matchup coverage keys off which TEAMS they had in the slot (0/1/2).
        const predPair = [pick.home, pick.away].filter(Boolean);
        const matchupHits = predPair.reduce((n, t) => n + (actualPair.includes(t) ? 1 : 0), 0);
        return { name: e.name, email_hash: e.email_hash, pick, m, state, matchupHits, entry: e };
      })
      .sort((a, b) => {
        if (b.m.points !== a.m.points) return b.m.points - a.m.points;
        return a.name.localeCompare(b.name);
      });
  }, [slot, entries, round, info]);

  const exactCount = rows.filter((r) => r.m.exact).length;
  const advCount = rows.filter((r) => r.m.correctAdvancer).length;
  const bothCount = rows.filter((r) => r.matchupHits === 2).length;
  const oneCount = rows.filter((r) => r.matchupHits === 1).length;
  const neitherCount = rows.filter((r) => r.matchupHits === 0).length;

  const home = info?.home ?? '?';
  const away = info?.away ?? '?';
  const homeScore = info?.home_score ?? '?';
  const awayScore = info?.away_score ?? '?';
  const actualAdvances = info?.advances ?? null;

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-modal-title"
        className="w-full max-w-lg rounded-lg bg-slate-900 text-slate-100 ring-1 ring-slate-800 shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 id="match-modal-title" className="text-base font-semibold">
            {teamFlag(home)} {teamName(home)} {homeScore}–{awayScore} {teamName(away)} {teamFlag(away)}
            <span className="ml-2 text-xs font-normal text-slate-400">
              · {round}
              {actualAdvances && (
                <> · Advances: {teamFlag(actualAdvances)} {teamName(actualAdvances)}</>
              )}
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >×</button>
        </header>
        {rows.length > 0 && info?.final && (
          <div className="border-b border-slate-800 px-5 py-3 text-xs text-slate-300 space-y-1">
            <div>
              🎯 <span className="font-semibold text-slate-100">{exactCount}</span>/{rows.length} exact score
              {' · '}✅ <span className="font-semibold text-slate-100">{advCount}</span>/{rows.length} winner
            </div>
            {round !== 'R32' && (
              <div>
                Matchup: <span className="font-semibold text-slate-100">{bothCount}</span> both teams
                {' · '}<span className="font-semibold text-slate-100">{oneCount}</span> one
                {' · '}<span className="font-semibold text-slate-100">{neitherCount}</span> neither
              </div>
            )}
          </div>
        )}
        <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400">No brackets submitted yet.</p>
          ) : (
            <ul className="space-y-1">
              {rows.map((r) => {
                // In R32 everyone shares the real matchup, so "in game" is
                // trivially true for any losing pick — drop the badge there.
                const hideBadge = round === 'R32' && r.state === 'ingame';
                const badge = hideBadge ? null : KO_STATE_BADGE[r.state];
                const txt = KO_STATE_TEXT[r.state] ?? 'text-slate-400';
                const hasPick = r.pick.home || r.pick.away;
                const flagCls = (t) => `${r.pick.advances && r.pick.advances === t ? '' : 'opacity-40'}`;
                return (
                  <li key={r.email_hash} className="flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => onSelectEntry(r.entry)}
                      className={`flex-1 truncate text-left hover:text-emerald-300 hover:underline ${r.m.points === 0 ? 'text-slate-400' : 'text-slate-100'}`}
                    >
                      {r.name}
                    </button>
                    {badge && (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                    <span className={`font-mono ${txt}`}>
                      {hasPick ? (
                        <>
                          <span className={flagCls(r.pick.home)}>{teamFlag(r.pick.home)}</span>{' '}
                          {r.pick.home_score ?? '–'}–{r.pick.away_score ?? '–'}{' '}
                          <span className={flagCls(r.pick.away)}>{teamFlag(r.pick.away)}</span>
                        </>
                      ) : '—'}
                    </span>
                    <span className="tabular-nums text-slate-400 w-8 text-right">{r.m.points}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Group match modal ----
function GroupMatchModal({ matchId, fixtures, results, entries, onClose, onSelectEntry }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    history.replaceState(null, '', `#match/${matchId}`);
    return () => {
      document.removeEventListener('keydown', onKey);
      history.replaceState(null, '', location.pathname + location.search);
    };
  }, [matchId, onClose]);

  const fx = fixtures.matches[matchId];
  const result = results.matches[matchId];
  const matchFinal = result && isMatchFinal(result.status);
  const summary = useMemo(() => computeMatchSummary(matchId, entries), [matchId, entries]);

  const rows = useMemo(() => {
    return entries
      .filter((e) => e.picks?.matches?.[matchId] != null)
      .map((e) => ({
        name: e.name,
        email_hash: e.email_hash,
        pick: e.picks.matches[matchId] || {},
        pts: e.scoring?.match_points?.[matchId] ?? 0,
        entry: e,
      }))
      .sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        return a.name.localeCompare(b.name);
      });
  }, [matchId, entries]);

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-modal-title"
        className="w-full max-w-lg rounded-lg bg-slate-900 text-slate-100 ring-1 ring-slate-800 shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 id="match-modal-title" className="text-base font-semibold">
            {teamFlag(fx.home)} {fx.home} {matchFinal ? `${result.home_score}–${result.away_score}` : '—'} {fx.away} {teamFlag(fx.away)}
            <span className="ml-2 text-xs font-normal text-slate-400">· Group {fx.group}{matchFinal ? ' · Final' : ' · Not finished'}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >×</button>
        </header>
        <div className="border-b border-slate-800 px-5 py-3 text-xs text-slate-300 space-y-1">
          <div>🎯 {summary.exactCount}/{summary.totalCount} nailed the exact score</div>
          <div>✅ {summary.winnerCount}/{summary.totalCount} picked the winner correctly</div>
          <div>Consensus: {summary.consensus ?? 'split — no consensus'}</div>
        </div>
        <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
          <ul className="space-y-1">
            {rows.map((r) => {
              const predictedStr = `${r.pick.home_score ?? '–'}-${r.pick.away_score ?? '–'}`;
              return (
                <li key={r.email_hash} className="flex items-center gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => onSelectEntry(r.entry)}
                    className="flex-1 truncate text-left text-slate-100 hover:text-emerald-300 hover:underline"
                  >
                    {r.name}
                  </button>
                  <span className={`font-mono ${classForPoints(r.pts)}`}>
                    {r.pts >= 6 && <span className="mr-1" aria-label="exact score">🎯</span>}
                    {predictedStr}
                  </span>
                  <span className="tabular-nums text-slate-400 w-8 text-right">{r.pts}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---- "Not found" fallback ----
function NotFoundModal({ matchId, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-modal-title"
        className="w-full max-w-sm rounded-lg bg-slate-900 text-slate-100 ring-1 ring-slate-800 shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 id="match-modal-title" className="text-base font-semibold text-slate-400">Match not found</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >×</button>
        </header>
        <div className="px-5 py-4 text-sm text-slate-400">
          No data found for match ID {matchId}.
        </div>
      </div>
    </div>
  );
}

// ---- Public export: dispatches to the correct modal variant ----
export function MatchModal({ matchId, fixtures, results, entries, knockout, onClose, onSelectEntry }) {
  // Determine match kind.
  const isGroupMatch = Boolean(fixtures.matches[matchId]);

  const koSlot = useMemo(() => {
    if (!knockout) return null;
    return Object.values(knockout.rounds).flat().find((s) => s.match_id === matchId) ?? null;
  }, [knockout, matchId]);

  if (isGroupMatch) {
    return (
      <GroupMatchModal
        matchId={matchId}
        fixtures={fixtures}
        results={results}
        entries={entries}
        onClose={onClose}
        onSelectEntry={onSelectEntry}
      />
    );
  }

  if (koSlot) {
    return (
      <KnockoutMatchModal
        matchId={matchId}
        slot={koSlot}
        knockout={knockout}
        results={results}
        entries={entries}
        onClose={onClose}
        onSelectEntry={onSelectEntry}
      />
    );
  }

  return <NotFoundModal matchId={matchId} onClose={onClose} />;
}
