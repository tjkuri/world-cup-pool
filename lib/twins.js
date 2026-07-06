// "Bracket Twins" similarity network: link each entrant to their most-similar
// brackets. Similarity = fraction of matching advancers across the slots both
// brackets filled. twinsGraph wires each entrant to its top-k nearest others
// (undirected, deduped) for an @nivo/network force layout.

export function bracketSimilarity(a, b) {
  const ba = a?.picks?.bracket || {};
  const bb = b?.picks?.bracket || {};
  let shared = 0;
  let match = 0;
  for (const slot of Object.keys(ba)) {
    const av = ba[slot]?.advances;
    const bv = bb[slot]?.advances;
    if (!av || !bv) continue; // only slots both brackets resolved
    shared += 1;
    if (av === bv) match += 1;
  }
  return shared ? match / shared : 0;
}

export function twinsGraph(submissions, k = 2) {
  const entrants = (submissions || []).filter((s) => s.phase === 'knockout');
  const nodes = entrants.map((e) => ({ id: e.email_hash, name: e.name }));
  const seen = new Set(); // dedupe undirected links: `${min}|${max}`
  const links = [];
  for (const e of entrants) {
    const nearest = entrants
      .filter((o) => o.email_hash !== e.email_hash)
      .map((o) => ({ id: o.email_hash, sim: bracketSimilarity(e, o) }))
      .sort((x, y) => y.sim - x.sim)
      .slice(0, k);
    for (const { id, sim } of nearest) {
      const key = [e.email_hash, id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      // Force distance: more similar → shorter (pulled closer together).
      links.push({ source: e.email_hash, target: id, distance: 30 + (1 - sim) * 120, similarity: sim });
    }
  }
  return { nodes, links };
}
