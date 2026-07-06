import { useMemo } from 'react';
import { scoreSubmission, scoreBracket } from '../../../lib/score.js';
import { aliveTeams } from '../../../lib/ceiling.js';
import { pickConsensus, contrarianCorrect, contrarianCorrectMatches, upsetScore } from '../../../lib/consensus.js';
import { rankVolatility } from '../../../lib/history.js';
import { teamName, teamFlag } from '../../shared/teamNames.js';

function computeAwards({ history, submissions, fixtures, results, knockout, odds }) {
  const awards = [];

  // 1. Most 🎯 Exact — WHOLE TOURNAMENT (group + knockout combined per email_hash)
  if (submissions?.length && fixtures && results) {
    const byEmail = new Map();
    for (const sub of submissions) {
      const row = byEmail.get(sub.email_hash) || { name: sub.name, group: null, ko: null };
      if (sub.phase === 'knockout') row.ko = sub; else row.group = sub;
      row.name = sub.name; // latest name wins
      byEmail.set(sub.email_hash, row);
    }
    let best = null;
    for (const row of byEmail.values()) {
      const groupExact = row.group
        ? scoreSubmission(row.group.picks, fixtures, results).exact_score_count
        : 0;
      const koExact = (row.ko && knockout)
        ? scoreBracket(row.ko.picks.bracket, knockout, results).exact_count
        : 0;
      const n = groupExact + koExact;
      if (!best || n > best.n) best = { name: row.name, n };
    }
    if (best && best.n > 0) {
      awards.push({ title: 'Most 🎯 Exact', who: best.name, detail: `${best.n} exact scores` });
    }
  }

  // 2. Live Longshot — unchanged
  if (submissions?.length && knockout && results) {
    const alive = aliveTeams(knockout, results);
    const finalSlot = (knockout.rounds.F || [])[0]?.slot;
    if (finalSlot) {
      const tally = new Map();
      for (const sub of submissions) {
        if (sub.phase !== 'knockout') continue;
        const champ = sub.picks?.bracket?.[finalSlot]?.advances;
        if (champ && alive.has(champ)) {
          if (!tally.has(champ)) tally.set(champ, []);
          tally.get(champ).push(sub.name);
        }
      }
      const rarest = [...tally.entries()].sort((a, b) => a[1].length - b[1].length)[0];
      if (rarest) {
        awards.push({
          title: 'Live Longshot',
          who: rarest[1][0],
          detail: `${rarest[0]} 🏆 · ${rarest[1].length} backer${rarest[1].length > 1 ? 's' : ''}`,
        });
      }
    }
  }

  // 3. Hipster — keep count logic, attach match detail for hover popover
  if (submissions?.length && fixtures && results) {
    const consensus = pickConsensus(submissions, fixtures);
    let best = null;
    let winnerSub = null;
    for (const sub of submissions) {
      if (sub.phase === 'knockout') continue;
      const n = contrarianCorrect(sub, fixtures, results, consensus);
      if (!best || n > best.n) { best = { name: sub.name, n }; winnerSub = sub; }
    }
    if (best && best.n > 0) {
      const matches = contrarianCorrectMatches(winnerSub, fixtures, results, consensus);
      awards.push({ title: 'Hipster', who: best.name, detail: `${best.n} rare correct calls`, matches });
    }
  }

  // 4. Giant Slayer (NEW) — most correctly-called upsets (odds-based, group phase)
  if (odds && submissions?.length && fixtures && results) {
    let best = null;
    for (const sub of submissions) {
      if (sub.phase === 'knockout') continue;
      const n = upsetScore(sub, fixtures, odds, results);
      if (!best || n > best.n) best = { name: sub.name, n };
    }
    if (best && best.n > 0) {
      awards.push({ title: 'Giant Slayer', who: best.name, detail: `${best.n} upset${best.n > 1 ? 's' : ''} called` });
    }
  }

  // 5. Roller Coaster (NEW) — max cumulative rank movement across snapshots
  if (history?.snapshots?.length) {
    const vols = rankVolatility(history);
    const top = vols.reduce((a, b) => (b.volatility > a.volatility ? b : a), { volatility: 0 });
    if (top.volatility > 0) {
      awards.push({ title: 'Roller Coaster', who: top.name, detail: `${top.volatility} places of movement` });
    }
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
          <div
            key={a.title}
            className={`rounded-lg bg-slate-800 p-3${a.matches?.length ? ' relative group' : ''}`}
            tabIndex={a.matches?.length ? 0 : undefined}
          >
            <div className="text-xs uppercase tracking-wide text-slate-400">{a.title}</div>
            <div className="mt-1 font-semibold text-slate-100">{a.who}</div>
            <div className="text-sm text-emerald-400">{a.detail}</div>
            {a.matches?.length ? (
              <div
                className="absolute top-full left-0 mt-1 hidden group-hover:block group-focus-within:block z-10 rounded-lg border border-slate-600 p-3 text-xs text-slate-300 overflow-auto"
                style={{ background: '#0b1220', minWidth: '240px', maxHeight: '16rem' }}
              >
                {a.matches.map((m) => (
                  <div key={m.matchId} className="py-0.5 whitespace-nowrap">
                    {teamFlag(m.home)}&thinsp;{teamName(m.home)} vs {teamName(m.away)}&thinsp;{teamFlag(m.away)}
                    {' '}—{' '}you: {m.home_score}–{m.away_score} · {Math.round(m.share * 100)}% of pool
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
