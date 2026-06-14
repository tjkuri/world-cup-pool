// Assemble the knockout picks_json payload from bracket state + resolved matchups.
export function buildBracketPayload(state, matchups, knockout) {
  const bracket = {};
  for (const round of Object.keys(knockout.rounds)) {
    for (const slot of knockout.rounds[round]) {
      const m = matchups[slot.slot] || {};
      const pick = state.bracket[slot.slot] || {};
      bracket[slot.slot] = {
        match_id: slot.match_id ?? null,
        home: m.home ?? null,
        away: m.away ?? null,
        home_score: pick.home_score ?? null,
        away_score: pick.away_score ?? null,
        advances: pick.advances ?? null,
      };
    }
  }
  return { bracket, champion: state.champion ?? null };
}
