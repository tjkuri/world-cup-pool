import { useMemo } from 'react';
import { rankMovements } from '../../../lib/history.js';
import { scoreSubmission } from '../../../lib/score.js';
import { aliveTeams } from '../../../lib/ceiling.js';

function computeAwards({ history, submissions, fixtures, results, knockout }) {
  const awards = [];

  if (history?.snapshots?.length) {
    const moves = rankMovements(history);
    const riser = [...moves].sort((a, b) => b.delta - a.delta)[0];
    const faller = [...moves].sort((a, b) => a.delta - b.delta)[0];
    if (riser && riser.delta > 0) awards.push({ title: 'Biggest Riser', who: riser.name, detail: `▲ ${riser.delta} spots` });
    if (faller && faller.delta < 0) awards.push({ title: 'Biggest Faller', who: faller.name, detail: `▼ ${-faller.delta} spots` });
  }

  if (submissions?.length && fixtures && results) {
    let best = null;
    for (const sub of submissions) {
      if (sub.phase === 'knockout') continue;
      const n = scoreSubmission(sub.picks, fixtures, results).exact_score_count;
      if (!best || n > best.n) best = { name: sub.name, n };
    }
    if (best && best.n > 0) awards.push({ title: 'Most 🎯 Exact', who: best.name, detail: `${best.n} exact scores` });
  }

  if (submissions?.length && knockout && results) {
    const alive = aliveTeams(knockout, results);
    const finalSlot = (knockout.rounds.F || [])[0]?.slot;
    if (finalSlot) {
      const tally = new Map(); // team -> [names]
      for (const sub of submissions) {
        if (sub.phase !== 'knockout') continue;
        const champ = sub.picks?.bracket?.[finalSlot]?.advances;
        if (champ && alive.has(champ)) {
          if (!tally.has(champ)) tally.set(champ, []);
          tally.get(champ).push(sub.name);
        }
      }
      // Rarest still-alive champion pick (fewest backers).
      const rarest = [...tally.entries()].sort((a, b) => a[1].length - b[1].length)[0];
      if (rarest) awards.push({ title: 'Live Longshot', who: rarest[1][0], detail: `${rarest[0]} 🏆 · ${rarest[1].length} backer${rarest[1].length > 1 ? 's' : ''}` });
    }
  }

  return awards;
}

export function Superlatives({ history, submissions, fixtures, results, knockout }) {
  const awards = useMemo(
    () => computeAwards({ history, submissions, fixtures, results, knockout }),
    [history, submissions, fixtures, results, knockout],
  );
  if (!awards.length) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">🏅 Superlatives</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {awards.map((a) => (
          <div key={a.title} className="rounded-lg bg-slate-800 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">{a.title}</div>
            <div className="mt-1 font-semibold text-slate-100">{a.who}</div>
            <div className="text-sm text-emerald-400">{a.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
