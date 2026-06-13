// One-shot. Run locally ONCE after the group stage resolves (~Jun 27):
//   node scripts/seed-knockout.mjs
//
// Pulls the resolved 32-team knockout bracket from ESPN, writes
// public/knockout.json, and prints the first R32 kickoff for config.json +
// the Apps Script "knockout_lock_iso" property.
//
// The standard 32-team bracket tree (which R32 slot feeds which R16 slot, etc.)
// is fixed; buildKnockout wires `from`/`feeds` from it. Verify the printed tree
// against the official bracket before committing knockout.json.

import { writeFile } from 'node:fs/promises';
import { fetchScoreboard, parseEvent } from './lib/espn.mjs';

const ROUND_SIZES = { R32: 16, R16: 8, QF: 4, SF: 2, F: 1 };
// Round-32 dates per the schedule; adjust if the calendar shifts.
const R32_DATES = ['20260705', '20260706', '20260707', '20260708'];

// Standard single-elimination feed map: slot i of a round is fed by slots
// 2i-1 and 2i of the previous round. F-1 is fed by SF-1 and SF-2.
function feedMap() {
  const order = ['R32', 'R16', 'QF', 'SF', 'F'];
  const feeds = {};   // childSlot -> parentSlot
  const from = {};    // parentSlot -> [childA, childB]
  for (let r = 1; r < order.length; r++) {
    const round = order[r];
    for (let i = 1; i <= ROUND_SIZES[round]; i++) {
      const parent = `${round}-${i}`;
      const childRound = order[r - 1];
      const a = `${childRound}-${2 * i - 1}`;
      const b = `${childRound}-${2 * i}`;
      from[parent] = [a, b];
      feeds[a] = parent;
      feeds[b] = parent;
    }
  }
  return { feeds, from };
}

// Pure: turn parsed R32 events (each with a bracketSlot 1..16) into knockout.json.
export function buildKnockout(parsedR32) {
  const { feeds, from } = feedMap();
  const sorted = [...parsedR32].sort((a, b) => (a.kickoff_iso ?? '').localeCompare(b.kickoff_iso ?? ''));
  const rounds = { R32: [], R16: [], QF: [], SF: [], F: [] };

  sorted.forEach((evt, idx) => {
    const slot = `R32-${idx + 1}`;
    rounds.R32.push({
      slot, match_id: evt.matchId, home: evt.home, away: evt.away,
      kickoff_iso: evt.kickoff_iso, feeds: feeds[slot],
    });
  });
  for (const round of ['R16', 'QF', 'SF', 'F']) {
    for (let i = 1; i <= ROUND_SIZES[round]; i++) {
      const slot = `${round}-${i}`;
      rounds[round].push({ slot, match_id: null, from: from[slot], kickoff_iso: null, ...(feeds[slot] ? { feeds: feeds[slot] } : {}) });
    }
  }

  const first_kickoff_iso = rounds.R32.length ? rounds.R32[0].kickoff_iso : null;
  return { seeded_at: new Date().toISOString(), first_kickoff_iso, rounds };
}

async function main() {
  const parsed = [];
  for (const dateStr of R32_DATES) {
    console.log(`Fetching ${dateStr}...`);
    const data = await fetchScoreboard(dateStr);
    for (const evt of (data.events || [])) {
      const p = parseEvent(evt); // no group map needed for knockout
      parsed.push(p);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (parsed.length !== ROUND_SIZES.R32) {
    console.warn(`Expected ${ROUND_SIZES.R32} R32 matches, found ${parsed.length}. Inspect before committing.`);
  }
  const ko = buildKnockout(parsed);
  await writeFile(new URL('../public/knockout.json', import.meta.url), JSON.stringify(ko, null, 2) + '\n');
  console.log('Wrote public/knockout.json');
  console.log('\nR32 bracket:');
  for (const s of ko.rounds.R32) console.log(`  ${s.slot}: ${s.home} vs ${s.away}  (${s.match_id})`);
  console.log(`\nFirst kickoff (paste into config.json.knockout_lock_iso + Apps Script "knockout_lock_iso"): ${ko.first_kickoff_iso}`);
}

// Only run main() when executed directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
