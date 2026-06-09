import { useEffect, useMemo } from 'react';
import { computeStandings } from '../../../lib/standings.js';
import { teamName, teamFlag } from '../../shared/teamNames.js';

export function PickModal({ entry, fixtures, results, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    history.replaceState(null, '', `#picks/${entry.email_hash}`);
    return () => {
      document.removeEventListener('keydown', onKey);
      history.replaceState(null, '', location.pathname + location.search);
    };
  }, [entry, onClose]);

  const letters = Object.keys(fixtures.groups).sort();
  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-lg bg-slate-900 text-slate-100 ring-1 ring-slate-800 shadow-2xl overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold">{entry.name}'s picks</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Total: <span className="text-emerald-300 font-semibold">{entry.scoring.total}</span>
              <span className="text-slate-600"> · </span>Match pts: {entry.scoring.match_total}
              <span className="text-slate-600"> · </span>Group pts: {entry.scoring.group_total}
              <span className="text-slate-600"> · </span>Exact scores: {entry.scoring.exact_score_count}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >×</button>
        </header>
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-5">
          {letters.map((letter) => (
            <GroupCard key={letter} letter={letter} entry={entry} fixtures={fixtures} results={results} />
          ))}
        </div>
        <footer className="flex justify-end border-t border-slate-800 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >Close</button>
        </footer>
      </div>
    </div>
  );
}

const OUTCOME_CLASSES = {
  exact: 'text-emerald-300',
  winner: 'text-sky-300',
  wrong: 'text-rose-400',
  pending: 'text-slate-500',
};

function GroupCard({ letter, entry, fixtures, results }) {
  const group = fixtures.groups[letter];
  const groupPts = entry.scoring.group_points[letter]?.subtotal ?? 0;
  const matchPtsInGroup = group.matches.reduce((sum, mid) => sum + (entry.scoring.match_points[mid] || 0), 0);
  const isPerfectGroup = (entry.scoring.group_points[letter]?.perfect ?? 0) > 0;

  const actualStandings = useMemo(() => {
    const allFinal = group.matches.every((mid) => results?.matches?.[mid]?.status === 'STATUS_FINAL');
    if (!allFinal) return null;
    const matchScores = {};
    for (const mid of group.matches) {
      const r = results.matches[mid];
      matchScores[mid] = { home_score: r.home_score, away_score: r.away_score };
    }
    return computeStandings(letter, matchScores, fixtures).standings;
  }, [letter, group, results, fixtures]);

  const predicted = entry.picks.group_standings[letter] || [];

  return (
    <section>
      <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-300">
        <span>
          Group {letter}
          <span className="ml-2 text-xs font-normal text-slate-500">· {matchPtsInGroup + groupPts} pts</span>
        </span>
        {isPerfectGroup && (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-400/40">
            ✨ Perfect Group!
          </span>
        )}
      </h3>
      <div className="space-y-1">
        {group.matches.map((mid) => {
          const fx = fixtures.matches[mid];
          const pick = entry.picks.matches[mid] || {};
          const result = results.matches[mid];
          let cls = 'pending';
          if (result && result.status === 'STATUS_FINAL') {
            const pts = entry.scoring.match_points[mid];
            if (pts >= 6) cls = 'exact';
            else if (pts === 3) cls = 'winner';
            else cls = 'wrong';
          }
          const isExact = cls === 'exact';
          const predictedStr = `${pick.home_score ?? '–'}-${pick.away_score ?? '–'}`;
          const actualStr = result && result.status === 'STATUS_FINAL' ? `${result.home_score}-${result.away_score}` : '—';
          return (
            <div
              key={mid}
              className={`flex items-center justify-between gap-2 font-mono text-sm ${isExact ? 'rounded border-l-2 border-emerald-400/70 bg-emerald-500/5 py-0.5 pl-2' : ''}`}
            >
              <span className="w-12 text-right font-semibold text-slate-300">{fx.home}</span>
              <span className={`flex-shrink-0 ${OUTCOME_CLASSES[cls]}`}>
                {isExact && <span className="mr-1" aria-label="exact score">🎯</span>}
                <strong>{predictedStr}</strong>
                <span className="ml-1 text-xs text-slate-500">(actual {actualStr})</span>
              </span>
              <span className="w-12 font-semibold text-slate-300">{fx.away}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {predicted.map((team, i) => {
          const correct = actualStandings && actualStandings[i] === team;
          return (
            <span
              key={team}
              className={`rounded px-1.5 py-0.5 text-xs font-mono ${correct ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}
            >
              {i + 1}. {teamFlag(team)} {teamName(team)}
            </span>
          );
        })}
        {!actualStandings && <span className="text-xs text-slate-600">(standings pending)</span>}
      </div>
    </section>
  );
}
