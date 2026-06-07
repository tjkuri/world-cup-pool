// Computes group standings using FIFA's tiebreaker chain:
//   1. Points (W=3, D=1, L=0)
//   2. Goal difference
//   3. Goals scored
//   4. Head-to-head points (among teams still tied)
//   5. Head-to-head goal difference (among teams still tied)
// We do NOT implement fair-play or drawing-of-lots — see spec §8.3.
//
// Returns { standings, unresolvedTies }.
// standings: 4-team ordered array, top → bottom.
// unresolvedTies: array of arrays — each inner array is a group of teams that
//   the chain could not separate. Empty when the chain produced a strict total
//   order. Task 4 will populate this; Task 3 leaves it always empty and falls
//   through to alphabetical for any final tie.
//
// `manualTiebreakers` is wired in Task 4. Task 3 ignores it.

export function computeStandings(groupLetter, matches, fixtures, manualTiebreakers) {
  const group = fixtures.groups[groupLetter];
  if (!group) throw new Error(`Unknown group: ${groupLetter}`);

  const stats = buildStats(groupLetter, group.teams, group.matches, matches, fixtures);

  const unresolvedTies = [];
  const standings = sortWithTiebreakers(
    group.teams,
    stats,
    group.matches,
    matches,
    fixtures,
    manualTiebreakers || {},
    unresolvedTies
  );

  return { standings, unresolvedTies };
}

// --- internal helpers ---

function buildStats(groupLetter, teams, matchIds, matches, fixtures) {
  const stats = Object.fromEntries(teams.map(t => [t, { pts: 0, gf: 0, ga: 0 }]));
  for (const mid of matchIds) {
    const fixture = fixtures.matches[mid];
    const score = matches[mid];
    if (!score || score.home_score == null || score.away_score == null) continue;
    const { home, away } = fixture;
    const { home_score: hs, away_score: as } = score;
    stats[home].gf += hs; stats[home].ga += as;
    stats[away].gf += as; stats[away].ga += hs;
    if (hs > as) stats[home].pts += 3;
    else if (as > hs) stats[away].pts += 3;
    else { stats[home].pts += 1; stats[away].pts += 1; }
  }
  for (const t of teams) {
    stats[t].gd = stats[t].gf - stats[t].ga;
  }
  return stats;
}

function sortWithTiebreakers(teams, stats, matchIds, matches, fixtures, manualTiebreakers, unresolvedTies) {
  const initial = [...teams].sort((a, b) => {
    if (stats[b].pts !== stats[a].pts) return stats[b].pts - stats[a].pts;
    if (stats[b].gd !== stats[a].gd) return stats[b].gd - stats[a].gd;
    if (stats[b].gf !== stats[a].gf) return stats[b].gf - stats[a].gf;
    return 0;
  });

  const result = [];
  let i = 0;
  while (i < initial.length) {
    let j = i;
    while (
      j + 1 < initial.length &&
      stats[initial[j+1]].pts === stats[initial[i]].pts &&
      stats[initial[j+1]].gd === stats[initial[i]].gd &&
      stats[initial[j+1]].gf === stats[initial[i]].gf
    ) j++;

    if (j === i) {
      result.push(initial[i]);
    } else {
      const tied = initial.slice(i, j + 1);
      const h2hResolved = resolveHeadToHead(tied, matchIds, matches, fixtures);
      const finallyResolved = applyManualOrUnresolved(h2hResolved, manualTiebreakers, unresolvedTies);
      result.push(...finallyResolved);
    }
    i = j + 1;
  }
  return result;
}

function resolveHeadToHead(tiedTeams, matchIds, matches, fixtures) {
  const tiedSet = new Set(tiedTeams);
  const mini = Object.fromEntries(tiedTeams.map(t => [t, { pts: 0, gf: 0, ga: 0 }]));
  for (const mid of matchIds) {
    const fx = fixtures.matches[mid];
    if (!tiedSet.has(fx.home) || !tiedSet.has(fx.away)) continue;
    const score = matches[mid];
    if (!score || score.home_score == null) continue;
    const { home, away } = fx;
    const { home_score: hs, away_score: as } = score;
    mini[home].gf += hs; mini[home].ga += as;
    mini[away].gf += as; mini[away].ga += hs;
    if (hs > as) mini[home].pts += 3;
    else if (as > hs) mini[away].pts += 3;
    else { mini[home].pts += 1; mini[away].pts += 1; }
  }
  for (const t of tiedTeams) mini[t].gd = mini[t].gf - mini[t].ga;
  return [...tiedTeams].sort((a, b) => {
    if (mini[b].pts !== mini[a].pts) return mini[b].pts - mini[a].pts;
    if (mini[b].gd !== mini[a].gd) return mini[b].gd - mini[a].gd;
    return 0; // leave as tied for the next pass
  });
}

// After H2H, any remaining tied runs are either (a) resolved by manualTiebreakers
// if the user gave us ranks, or (b) reported in unresolvedTies and left in their
// pre-tied position (which falls through to alphabetical as a safety net).
function applyManualOrUnresolved(h2hResolved, manualTiebreakers, unresolvedTies) {
  const result = [];
  let i = 0;
  while (i < h2hResolved.length) {
    let j = i;
    while (
      j + 1 < h2hResolved.length &&
      cmpForTieDetection(h2hResolved[j], h2hResolved[j+1], manualTiebreakers) === 0
    ) j++;
    if (j === i) {
      result.push(h2hResolved[i]);
    } else {
      const subset = h2hResolved.slice(i, j + 1);
      const allHaveManual = subset.every(t => Number.isFinite(manualTiebreakers[t]));
      if (allHaveManual) {
        const ordered = [...subset].sort((a, b) => manualTiebreakers[a] - manualTiebreakers[b]);
        result.push(...ordered);
      } else {
        // Truly tied. Report and fall back to alphabetical as a deterministic safety net.
        unresolvedTies.push([...subset]);
        const ordered = [...subset].sort();
        result.push(...ordered);
      }
    }
    i = j + 1;
  }
  return result;
}

// Two teams are considered "still tied after H2H" if they are not separated by
// any manual rank either. The H2H pass already preserved order for teams it
// couldn't separate (return 0), so we treat adjacency in h2hResolved as a proxy
// for "still tied" UNLESS the user provided distinguishing ranks.
function cmpForTieDetection(a, b, manualTiebreakers) {
  // If manual ranks distinguish them, they're not tied.
  if (Number.isFinite(manualTiebreakers[a]) && Number.isFinite(manualTiebreakers[b])
      && manualTiebreakers[a] !== manualTiebreakers[b]) {
    return manualTiebreakers[a] - manualTiebreakers[b];
  }
  return 0;
}
