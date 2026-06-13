// Thin client for ESPN's public soccer scoreboard endpoint.
// No auth required. CORS-permissive. Documented in spec §3 and §7.
//
// Returns the raw JSON from the API. Callers are responsible for parsing the
// shape they need.

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const STANDINGS_URL = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings?season=2026';

export async function fetchScoreboard(dateYyyymmdd) {
  const url = `${BASE}?dates=${dateYyyymmdd}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN request failed for ${dateYyyymmdd}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Fetches the standings endpoint and builds a Map from team ID (string) -> group letter (A-L).
// ESPN's scoreboard events don't include group info in their notes/name fields, but the
// standings endpoint has "children" with names like "Group A" that list team IDs.
export async function fetchTeamGroupMap() {
  const res = await fetch(STANDINGS_URL);
  if (!res.ok) {
    throw new Error(`ESPN standings request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const teamGroupMap = new Map(); // teamId (string) -> groupLetter (string)
  for (const child of (data.children || [])) {
    const m = /Group\s+([A-L])/i.exec(child.name || child.abbreviation || '');
    if (!m) continue;
    const letter = m[1].toUpperCase();
    const entries = child.standings?.entries || [];
    for (const entry of entries) {
      if (entry.team?.id) {
        teamGroupMap.set(String(entry.team.id), letter);
      }
    }
  }
  return teamGroupMap;
}

// Parse one event from ESPN's scoreboard.events[] into our internal fixture shape.
// ESPN returns competitors as a 2-element array with home_away keys.
//
// teamGroupMap: Map<teamId, groupLetter> built by fetchTeamGroupMap().
//
// Returns { matchId, group, home, away, kickoff_iso, status, home_score, away_score }
// home/away are FIFA-style 3-letter codes (e.g. "MEX"). ESPN uses 3-letter
// abbreviations consistent with that convention; we uppercase to be safe.
export function parseEvent(event, teamGroupMap) {
  const competition = event.competitions?.[0];
  if (!competition) throw new Error(`Event ${event.id} has no competition`);
  const competitors = competition.competitors || [];
  const homeC = competitors.find(c => c.homeAway === 'home');
  const awayC = competitors.find(c => c.homeAway === 'away');
  if (!homeC || !awayC) throw new Error(`Event ${event.id} missing home/away`);

  // Look up group letter via team ID in the standings-derived map.
  // Both home and away should map to the same group letter.
  const group = extractGroupLetter(event, competition, teamGroupMap, homeC);

  return {
    matchId: String(event.id),
    group,
    home: (homeC.team?.abbreviation || homeC.team?.shortDisplayName || '').toUpperCase(),
    away: (awayC.team?.abbreviation || awayC.team?.shortDisplayName || '').toUpperCase(),
    kickoff_iso: event.date,
    status: event.status?.type?.name || 'STATUS_SCHEDULED',
    home_score: parseInt(homeC.score ?? '', 10),
    away_score: parseInt(awayC.score ?? '', 10),
    // For knockout matches ESPN flags the winning competitor; null until decided.
    advancer: homeC.winner === true ? (homeC.team?.abbreviation || '').toUpperCase()
            : awayC.winner === true ? (awayC.team?.abbreviation || '').toUpperCase()
            : null,
  };
}

function extractGroupLetter(event, competition, teamGroupMap, homeC) {
  // Primary: look up via team ID in standings-derived map.
  if (teamGroupMap && homeC?.team?.id) {
    const letter = teamGroupMap.get(String(homeC.team.id));
    if (letter) return letter;
  }

  // Fallback: Try competition.notes[*].headline like "Group A" or "Group H".
  for (const note of (competition.notes || [])) {
    const m = /Group\s+([A-L])/i.exec(note.headline || note.text || '');
    if (m) return m[1].toUpperCase();
  }
  // Fallback: Try event.name or shortName.
  for (const s of [event.name, event.shortName, event.season?.slug]) {
    const m = /Group\s+([A-L])/i.exec(s || '');
    if (m) return m[1].toUpperCase();
  }
  // Not found — caller will need to handle null group for non-group-stage events.
  return null;
}
