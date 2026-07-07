// Per-team advancement counts across all knockout brackets, for the stats page's
// Team Advancement funnel: for each team, how many brackets had them REACH each
// round (advanced out of the prior round). Reaching R16 = advanced out of R32, etc.

const REACH_ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F'];
const REACH_STAGE = { R32: 'R16', R16: 'QF', QF: 'SF', SF: 'Final', F: 'Champion' };

export function teamRoundCounts(submissions, knockout) {
  const out = {}; // team -> { R16, QF, SF, Final, Champion }
  for (const round of REACH_ROUNDS) {
    const slots = knockout?.rounds?.[round] || [];
    const stage = REACH_STAGE[round];
    for (const sub of submissions || []) {
      if (sub.phase !== 'knockout') continue;
      const bracket = sub.picks?.bracket || {};
      const advanced = new Set();
      for (const slot of slots) {
        const a = bracket[slot.slot]?.advances;
        if (a) advanced.add(a);
      }
      for (const team of advanced) {
        if (!out[team]) out[team] = { R16: 0, QF: 0, SF: 0, Final: 0, Champion: 0 };
        out[team][stage] += 1;
      }
    }
  }
  return out;
}
