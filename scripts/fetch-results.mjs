// Run by the GitHub Actions cron every 2 hours during the tournament.
// Reads fixtures.json to learn which match IDs we care about. For each date
// in the tournament range that isn't already fully STATUS_FINAL, hits ESPN's
// scoreboard endpoint and merges into results.json.
//
// Exits 0 if no changes, 0 if changes were written (workflow checks the file
// diff to decide whether to commit), and non-zero on error.

import { readFile, writeFile } from 'node:fs/promises';
import { fetchScoreboard, parseEvent } from './lib/espn.mjs';

const TOURNAMENT_START = '2026-06-11';
const TOURNAMENT_END = '2026-07-19';

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

function isInTournamentWindow() {
  const now = new Date();
  return now >= new Date(TOURNAMENT_START) && now <= new Date(TOURNAMENT_END + 'T23:59:59Z');
}

async function main() {
  if (!isInTournamentWindow()) {
    console.log('Outside tournament window; exiting cleanly.');
    return;
  }

  const fixtures = JSON.parse(await readFile('public/fixtures.json', 'utf8'));
  const existing = JSON.parse(await readFile('public/results.json', 'utf8'));
  const matchIds = new Set(Object.keys(fixtures.matches));

  // Index match IDs by date for cheap "is this date fully final?" checks.
  const idsByDate = {};
  for (const [mid, fx] of Object.entries(fixtures.matches)) {
    const ymd = fx.kickoff_iso.slice(0, 10).replaceAll('-', '');
    if (!idsByDate[ymd]) idsByDate[ymd] = [];
    idsByDate[ymd].push(mid);
  }

  const merged = { ...existing.matches };
  let changed = false;

  for (const dateStr of dateRange(TOURNAMENT_START, TOURNAMENT_END)) {
    const idsOnDate = idsByDate[dateStr];
    if (!idsOnDate) continue; // no matches on this date
    const allFinal = idsOnDate.every(mid => merged[mid]?.status === 'STATUS_FINAL');
    if (allFinal) continue;

    let data;
    try {
      data = await fetchScoreboard(dateStr);
    } catch (err) {
      console.error(`Failed to fetch ${dateStr}:`, err.message);
      process.exit(1);
    }
    for (const evt of (data.events || [])) {
      const parsed = parseEvent(evt);
      if (!matchIds.has(parsed.matchId)) continue;
      const prev = merged[parsed.matchId];
      const next = {
        home_score: Number.isFinite(parsed.home_score) ? parsed.home_score : (prev?.home_score ?? null),
        away_score: Number.isFinite(parsed.away_score) ? parsed.away_score : (prev?.away_score ?? null),
        status: parsed.status,
      };
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        merged[parsed.matchId] = next;
        changed = true;
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (changed) {
    const out = { updated_at: new Date().toISOString(), matches: merged };
    await writeFile('public/results.json', JSON.stringify(out, null, 2) + '\n');
    console.log(`Updated results.json (${Object.keys(merged).length} matches tracked).`);
  } else {
    console.log('No changes.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
