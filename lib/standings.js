// Computes group standings using the FIFA World Cup 2026 tiebreaker chain.
// NOTE: 2026 is the first World Cup to apply head-to-head BEFORE overall goal
// difference (UEFA-style), reversing the long-standing World Cup order. Among
// teams level on points the chain is:
//   1. Points (W=3, D=1, L=0)
//   2. Head-to-head points (among the teams still tied)
//   3. Head-to-head goal difference (among the teams still tied)
//   4. Head-to-head goals scored (among the teams still tied)
//   5. Overall goal difference
//   6. Overall goals scored
// We do NOT implement disciplinary points, FIFA ranking, or drawing-of-lots.
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
  // Rank purely by points first; head-to-head (not overall GD) is the first
  // tiebreaker among any teams left level on points (FIFA World Cup 2026 rule).
  const byPoints = [...teams].sort((a, b) => stats[b].pts - stats[a].pts);

  const result = [];
  let i = 0;
  while (i < byPoints.length) {
    let j = i;
    while (j + 1 < byPoints.length && stats[byPoints[j+1]].pts === stats[byPoints[i]].pts) j++;

    if (j === i) {
      result.push(byPoints[i]);
    } else {
      const tied = byPoints.slice(i, j + 1);
      const resolved = resolveTiedOnPoints(tied, stats, matchIds, matches, fixtures, manualTiebreakers, unresolvedTies);
      result.push(...resolved);
    }
    i = j + 1;
  }
  return result;
}

// Orders a set of teams that are level on points using the 2026 chain:
// head-to-head points → H2H GD → H2H goals → overall GD → overall goals. The
// head-to-head mini-table is computed over ONLY the tied teams' matches.
function resolveTiedOnPoints(tiedTeams, stats, matchIds, matches, fixtures, manualTiebreakers, unresolvedTies) {
  const mini = headToHeadStats(tiedTeams, matchIds, matches, fixtures);

  const compare = (a, b) => {
    if (mini[b].pts !== mini[a].pts) return mini[b].pts - mini[a].pts;
    if (mini[b].gd !== mini[a].gd) return mini[b].gd - mini[a].gd;
    if (mini[b].gf !== mini[a].gf) return mini[b].gf - mini[a].gf;
    if (stats[b].gd !== stats[a].gd) return stats[b].gd - stats[a].gd;
    if (stats[b].gf !== stats[a].gf) return stats[b].gf - stats[a].gf;
    return 0; // implemented chain exhausted — truly tied
  };

  const sorted = [...tiedTeams].sort(compare);
  return applyManualOrUnresolved(sorted, compare, manualTiebreakers, unresolvedTies);
}

// Mini-league stats counting ONLY matches played between the tied teams.
function headToHeadStats(tiedTeams, matchIds, matches, fixtures) {
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
  return mini;
}

// After the sporting chain, any remaining adjacent run that `compare` cannot
// separate is either (a) resolved by manualTiebreakers if the user ranked every
// team in it, or (b) reported in unresolvedTies and ordered alphabetically as a
// deterministic safety net.
function applyManualOrUnresolved(sorted, compare, manualTiebreakers, unresolvedTies) {
  const result = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && compare(sorted[j], sorted[j+1]) === 0) j++;
    if (j === i) {
      result.push(sorted[i]);
    } else {
      const subset = sorted.slice(i, j + 1);
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
