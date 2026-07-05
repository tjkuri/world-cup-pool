import { useMemo } from 'react';
import { scoreSubmission } from '../../../lib/score.js';
import { aliveTeams } from '../../../lib/ceiling.js';
import { pickConsensus, contrarianCorrect, chalkScore } from '../../../lib/consensus.js';

function computeAwards({ history, submissions, fixtures, results, knockout, odds }) {
  const awards = [];

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

  if (submissions?.length && fixtures && results) {
    const consensus = pickConsensus(submissions, fixtures);
    let best = null;
    for (const sub of submissions) {
      if (sub.phase === 'knockout') continue;
      const n = contrarianCorrect(sub, fixtures, results, consensus);
      if (!best || n > best.n) best = { name: sub.name, n };
    }
    if (best && best.n > 0) awards.push({ title: 'Hipster', who: best.name, detail: `${best.n} rare correct calls` });
  }

  if (odds && submissions?.length && fixtures) {
    let best = null;
    for (const sub of submissions) {
      if (sub.phase === 'knockout') continue;
      const n = chalkScore(sub, fixtures, odds);
      if (!best || n > best.n) best = { name: sub.name, n };
    }
    if (best && best.n > 0) awards.push({ title: 'Chalk-Eater', who: best.name, detail: `${best.n} favorites backed` });
  }

  return awards;
}

export function Superlatives({ history, submissions, fixtures, results, knockout, odds }) {
  const awards = useMemo(
    () => computeAwards({ history, submissions, fixtures, results, knockout, odds }),
    [history, submissions, fixtures, results, knockout, odds],
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
