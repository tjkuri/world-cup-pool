// "Bracket Twins" similarity network. Similarity between two entrants = fraction
// of matching advancers across the slots both brackets filled. twinsGraph links
// only the genuinely-similar pairs (sim at/above an adaptive percentile) so real
// clusters form and lone-wolf contrarians float free; it also returns the full
// pairwise similarity map so the UI can spotlight a person and name their twins.

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

function percentileValue(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
}

export function twinsGraph(submissions, { linkPercentile = 0.85 } = {}) {
  const entrants = (submissions || []).filter((s) => s.phase === 'knockout');
  const nodes = entrants.map((e) => ({ id: e.email_hash, name: e.name }));

  const similarity = {}; // similarity[a][b] = fraction
  for (const e of entrants) similarity[e.email_hash] = {};
  const flat = [];
  for (let i = 0; i < entrants.length; i++) {
    for (let j = i + 1; j < entrants.length; j++) {
      const a = entrants[i].email_hash;
      const b = entrants[j].email_hash;
      const s = bracketSimilarity(entrants[i], entrants[j]);
      similarity[a][b] = s;
      similarity[b][a] = s;
      flat.push(s);
    }
  }

  flat.sort((x, y) => x - y);
  const threshold = percentileValue(flat, linkPercentile);
  const links = [];
  for (let i = 0; i < entrants.length; i++) {
    for (let j = i + 1; j < entrants.length; j++) {
      const a = entrants[i].email_hash;
      const b = entrants[j].email_hash;
      const s = similarity[a][b];
      if (s > 0 && s >= threshold) {
        // Force distance: more similar → shorter (pulled together).
        links.push({ source: a, target: b, similarity: s, distance: 30 + (1 - s) * 120 });
      }
    }
  }
  return { nodes, links, similarity, threshold };
}

// Most-similar ("twin") and least-similar ("evil twin") other entrant, from the
// similarity map twinsGraph returns. `nameByHash` maps email_hash → display name.
export function twinFor(emailHash, similarity, nameByHash = {}) {
  const row = similarity?.[emailHash];
  const entries = row ? Object.entries(row) : [];
  if (!entries.length) return { twin: null, evil: null };
  let twin = entries[0];
  let evil = entries[0];
  for (const e of entries) {
    if (e[1] > twin[1]) twin = e;
    if (e[1] < evil[1]) evil = e;
  }
  return {
    twin: { email_hash: twin[0], name: nameByHash[twin[0]], similarity: twin[1] },
    evil: { email_hash: evil[0], name: nameByHash[evil[0]], similarity: evil[1] },
  };
}
