import { useEffect, useMemo } from 'react';
import { computeStandings } from '../../../lib/standings.js';

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
    <div className="pick-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <header>
          <h2>{entry.name}'s picks</h2>
          <p>
            Total: <strong>{entry.scoring.total}</strong> · Match pts: {entry.scoring.match_total} · Group pts: {entry.scoring.group_total} · Exact scores: {entry.scoring.exact_score_count}
          </p>
        </header>
        {letters.map((letter) => (
          <GroupCard key={letter} letter={letter} entry={entry} fixtures={fixtures} results={results} />
        ))}
        <footer>
          <button type="button" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}

function GroupCard({ letter, entry, fixtures, results }) {
  const group = fixtures.groups[letter];
  const groupPts = entry.scoring.group_points[letter]?.subtotal ?? 0;
  const matchPtsInGroup = group.matches.reduce((sum, mid) => sum + (entry.scoring.match_points[mid] || 0), 0);

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
    <section className="group-card">
      <h3>Group {letter} <small>· {matchPtsInGroup + groupPts} pts</small></h3>
      {group.matches.map((mid) => {
        const fx = fixtures.matches[mid];
        const pick = entry.picks.matches[mid] || {};
        const result = results.matches[mid];
        let cls = 'pending';
        if (result && result.status === 'STATUS_FINAL') {
          const pts = entry.scoring.match_points[mid];
          if (pts === 5) cls = 'exact';
          else if (pts === 3) cls = 'winner';
          else cls = 'wrong';
        }
        const predictedStr = `${pick.home_score ?? '–'}-${pick.away_score ?? '–'}`;
        const actualStr = result && result.status === 'STATUS_FINAL' ? `${result.home_score}-${result.away_score}` : '—';
        return (
          <div key={mid} className={`match-result-row ${cls}`}>
            <span>{fx.home}</span>
            <span><strong>{predictedStr}</strong> <small>(actual {actualStr})</small></span>
            <span>{fx.away}</span>
          </div>
        );
      })}
      <div className="standings-strip">
        {predicted.map((team, i) => {
          const correct = actualStandings && actualStandings[i] === team;
          return (
            <span key={team} className={'standings-chip' + (correct ? ' correct' : '')}>
              {i + 1}. {team}
            </span>
          );
        })}
        {!actualStandings && <span className="loading"> (pending)</span>}
      </div>
    </section>
  );
}
