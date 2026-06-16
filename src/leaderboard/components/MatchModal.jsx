import { useEffect, useMemo } from 'react';
import { teamFlag, teamName } from '../../shared/teamNames.js';
import { computeMatchSummary } from '../../../lib/leaderboardStats.js';
import { resolveActualBracket } from '../../../lib/bracket.js';
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
    return entries
      .filter((e) => e.knockoutSub != null)
      .map((e) => {
        const pick = e.knockoutSub.picks.bracket[slot.slot] ?? {};
        const pts = e.bracketScoring?.round_points?.[slot.slot] ?? 0;
        return { name: e.name, email_hash: e.email_hash, pick, pts, entry: e };
      })
      .sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        return a.name.localeCompare(b.name);
      });
  }, [slot, entries]);

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
        <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400">No brackets submitted yet.</p>
          ) : (
            <ul className="space-y-1">
              {rows.map((r) => {
                const predictedHome = r.pick.home_score ?? '–';
                const predictedAway = r.pick.away_score ?? '–';
                const predictedAdvances = r.pick.advances ?? null;
                const advancerCorrect = actualAdvances && predictedAdvances && predictedAdvances === actualAdvances;
                const advancerClass = actualAdvances
                  ? (advancerCorrect ? 'text-emerald-300' : 'text-rose-400')
                  : 'text-slate-400';
                return (
                  <li key={r.email_hash} className="flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => onSelectEntry(r.entry)}
                      className="flex-1 truncate text-left text-slate-100 hover:text-emerald-300 hover:underline"
                    >
                      {r.name}
                    </button>
                    <span className="font-mono text-slate-300">
                      {predictedHome}-{predictedAway}
                    </span>
                    {predictedAdvances && (
                      <span className={`font-mono ${advancerClass}`}>
                        {teamFlag(predictedAdvances)}
                      </span>
                    )}
                    <span className="tabular-nums text-slate-400 w-8 text-right">{r.pts}</span>
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
