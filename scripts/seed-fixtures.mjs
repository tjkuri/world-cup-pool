// One-shot script. Run locally with:
//   node scripts/seed-fixtures.mjs
//
// Iterates dates Jun 11–27, 2026, pulls each day's scoreboard from ESPN,
// extracts group-stage matches, and writes fixtures.json in the repo root.
// Prints the earliest kickoff time so the user can paste it into config.json
// and the Apps Script script properties.

import { writeFile } from 'node:fs/promises';
import { fetchScoreboard, fetchTeamGroupMap, parseEvent } from './lib/espn.mjs';

const START_DATE = '2026-06-11';
const END_DATE = '2026-06-27';

function* dateRange(start, end) {
  const d = new Date(start);
  const last = new Date(end);
  while (d <= last) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    yield `${y}${m}${day}`;
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

async function main() {
  // Build team-ID -> group-letter map from standings before iterating dates.
  console.log('Fetching group assignments from ESPN standings...');
  const teamGroupMap = await fetchTeamGroupMap();
  console.log(`Loaded ${teamGroupMap.size} team-to-group mappings.`);

  const groups = {};
  const matches = {};
  let earliestKickoff = null;

  for (const dateStr of dateRange(START_DATE, END_DATE)) {
    console.log(`Fetching ${dateStr}...`);
    const data = await fetchScoreboard(dateStr);
    const events = data.events || [];
    for (const evt of events) {
      let parsed;
      try {
        parsed = parseEvent(evt, teamGroupMap);
      } catch (err) {
        console.warn(`  Error parsing event ${evt.id}: ${err.message}`);
        continue;
      }
      if (!parsed.group) {
        console.warn(`  Skipping ${parsed.matchId}: no group letter found.`);
        continue;
      }
      matches[parsed.matchId] = {
        group: parsed.group,
        home: parsed.home,
        away: parsed.away,
        kickoff_iso: parsed.kickoff_iso,
      };
      if (!groups[parsed.group]) {
        groups[parsed.group] = { teams: new Set(), matches: [] };
      }
      groups[parsed.group].teams.add(parsed.home);
      groups[parsed.group].teams.add(parsed.away);
      groups[parsed.group].matches.push(parsed.matchId);
      if (!earliestKickoff || parsed.kickoff_iso < earliestKickoff) {
        earliestKickoff = parsed.kickoff_iso;
      }
    }
    await new Promise(r => setTimeout(r, 1000)); // be kind to ESPN
  }

  // Materialize: sort teams + matches per group, convert sets to arrays.
  const out = { groups: {}, matches };
  for (const letter of Object.keys(groups).sort()) {
    out.groups[letter] = {
      teams: [...groups[letter].teams].sort(),
      matches: groups[letter].matches.sort(),
    };
  }

  // Sanity check: 12 groups, 4 teams each, 6 matches each, 72 total.
  const expectErrors = [];
  if (Object.keys(out.groups).length !== 12) {
    expectErrors.push(`Expected 12 groups, got ${Object.keys(out.groups).length}`);
  }
  for (const [letter, g] of Object.entries(out.groups)) {
    if (g.teams.length !== 4) expectErrors.push(`Group ${letter}: expected 4 teams, got ${g.teams.length}`);
    if (g.matches.length !== 6) expectErrors.push(`Group ${letter}: expected 6 matches, got ${g.matches.length}`);
  }
  if (Object.keys(out.matches).length !== 72) {
    expectErrors.push(`Expected 72 matches, got ${Object.keys(out.matches).length}`);
  }
  if (expectErrors.length) {
    console.error('\nSanity check FAILED:');
    for (const e of expectErrors) console.error('  -', e);
    console.error('\nWriting fixtures.json anyway for inspection.');
  } else {
    console.log('\nSanity check passed.');
  }

  await writeFile(
    new URL('../fixtures.json', import.meta.url),
    JSON.stringify(out, null, 2) + '\n'
  );
  console.log('Wrote fixtures.json');
  console.log(`\nEarliest kickoff (for config.json + Apps Script lock): ${earliestKickoff}`);
  console.log(`Paste this into config.json.group_lock_iso and the Apps Script script property "group_lock_iso".`);
}

main().catch(err => { console.error(err); process.exit(1); });
