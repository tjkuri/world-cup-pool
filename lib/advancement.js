// Champion/advancement "waterway" flows for the stats Sankey: how many brackets
// routed each team deeper. Columns R16 → QF → SF → Final → Champion; a link
// (round column → next column) for team T carries the count of brackets that
// advanced T out of that round. R32 is intentionally excluded (32 teams = too
// dense to read). Nodes are `${column}:${team}` so the graph stays acyclic.

const FLOWS = [
  { round: 'R16', from: 'R16', to: 'QF' },
  { round: 'QF', from: 'QF', to: 'SF' },
  { round: 'SF', from: 'SF', to: 'Final' },
  { round: 'F', from: 'Final', to: 'Champion' },
];

export function advancementFlows(submissions, knockout) {
  const nodeIds = new Set();
  const linkMap = new Map(); // `${source}->${target}` -> value

  for (const { round, from, to } of FLOWS) {
    const slots = knockout?.rounds?.[round] || [];
    // reach[T] = # of knockout brackets that advanced T out of `round`.
    const reach = new Map();
    for (const sub of submissions) {
      if (sub.phase !== 'knockout') continue;
      const bracket = sub.picks?.bracket || {};
      const advanced = new Set();
      for (const slot of slots) {
        const a = bracket[slot.slot]?.advances;
        if (a) advanced.add(a);
      }
      for (const team of advanced) reach.set(team, (reach.get(team) || 0) + 1);
    }
    for (const [team, value] of reach) {
      if (value <= 0) continue;
      const source = `${from}:${team}`;
      const target = `${to}:${team}`;
      nodeIds.add(source);
      nodeIds.add(target);
      linkMap.set(`${source}->${target}`, value);
    }
  }

  const nodes = [...nodeIds].map((id) => ({ id }));
  const links = [...linkMap.entries()].map(([key, value]) => {
    const [source, target] = key.split('->');
    return { source, target, value };
  });
  return { nodes, links };
}

// Per-team advancement counts across all knockout brackets, for the team-selector
// funnel: for each team, how many brackets had them REACH each round (advanced out
// of the prior round). Reaching R16 = advanced out of R32, etc.
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
