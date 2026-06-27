// One-shot. Run locally ONCE after the group stage resolves (~Jun 27):
//   node scripts/seed-knockout.mjs
//
// Pulls the resolved knockout bracket from ESPN, writes public/knockout.json,
// and prints the first R32 kickoff for config.json + the Apps Script
// "knockout_lock_iso" property.
//
// HOW THE TREE IS WIRED (don't reintroduce the old bug):
//   The 2026 bracket is NOT sequential — R16-1 is NOT fed by R32-1 & R32-2.
//   ESPN publishes the real wiring as placeholder team names on each later-round
//   match ("Round of 32 3 Winner", "Quarterfinal 1 Winner", ...). We parse those
//   to build the exact tree, number each round's matches by ascending ESPN match
//   id, then relabel slots in clean top-to-bottom bracket order. Every knockout
//   match already exists in ESPN (with id + kickoff) before its teams resolve, so
//   we seed match_id + kickoff_iso for ALL rounds — the cron only fetches slots
//   that already have a match_id.
//
// Still verify the printed tree against the official bracket before committing.

import { writeFile } from 'node:fs/promises';
import { fetchScoreboard, parseEvent } from './lib/espn.mjs';

const ROUND_SIZES = { R32: 16, R16: 8, QF: 4, SF: 2, F: 1 };

// All knockout broadcast days (UTC). After-midnight-UTC kickoffs surface on the
// prior day's scoreboard, so consecutive days cover everything; a couple of
// trailing days are padding. Verified against ESPN's live scoreboard 2026-06-27.
const KO_DATES = [
  '20260628', '20260629', '20260630', '20260701', '20260702', '20260703', // R32
  '20260704', '20260705', '20260706', '20260707',                         // R16
  '20260709', '20260710', '20260711', '20260712',                         // QF
  '20260714', '20260715',                                                  // SF
  '20260718', '20260719',                                                  // F + 3rd-place
];

// A later-round match names its feeders like "Round of 32 3 Winner". Parse one.
const FEEDER_RE = /^(Round of 32|Round of 16|Quarterfinal|Semifinal) (\d+) (Winner|Loser)$/;
const FEEDER_ROUND = {
  'Round of 32': 'R32', 'Round of 16': 'R16', 'Quarterfinal': 'QF', 'Semifinal': 'SF',
};
// Which round a match belongs to, given the round its feeders come from.
const NEXT_ROUND = { R32: 'R16', R16: 'QF', QF: 'SF', SF: 'F' };

export function parseFeederRef(displayName) {
  const m = String(displayName || '').match(FEEDER_RE);
  if (!m) return null;
  return { round: FEEDER_ROUND[m[1]], num: Number(m[2]), result: m[3] };
}

// Pure: turn classified events into knockout.json. Input shape:
//   { R32: [{matchId, home, away, kickoff_iso}],
//     R16|QF|SF|F: [{matchId, kickoff_iso, feeders:[ref, ref]}] }
// (F holds the Final only — the 3rd-place match is dropped during classification.)
export function buildKnockout(byRound) {
  // 1. Number each round's matches by ascending match id → ESPN bracket number.
  //    `num['R32#3']` is the 3rd R32 match by id, which is what "Round of 32 3"
  //    refers to.
  const num = {};
  for (const round of ['R32', 'R16', 'QF', 'SF', 'F']) {
    const items = [...(byRound[round] || [])].sort((a, b) => Number(a.matchId) - Number(b.matchId));
    const expected = ROUND_SIZES[round];
    if (items.length !== expected) {
      throw new Error(`Expected ${expected} ${round} matches, got ${items.length}`);
    }
    items.forEach((it, i) => { num[`${round}#${i + 1}`] = it; });
  }

  // 2. Build parent/children edges from the feeder references.
  const children = {};  // node -> [childNode, childNode]
  const parent = {};    // node -> parentNode
  for (const round of ['R16', 'QF', 'SF', 'F']) {
    for (let n = 1; n <= ROUND_SIZES[round]; n++) {
      const node = `${round}#${n}`;
      const kids = num[node].feeders.map((f) => {
        if (!f) throw new Error(`${node} has an unparseable feeder`);
        return `${f.round}#${f.num}`;
      });
      children[node] = kids;
      for (const k of kids) {
        if (!num[k]) throw new Error(`${node} feeds from missing ${k}`);
        if (parent[k]) throw new Error(`${k} feeds two parents (${parent[k]} & ${node})`);
        parent[k] = node;
      }
    }
  }

  // 3. Every non-Final slot must feed exactly one parent (complete binary tree).
  for (const round of ['R32', 'R16', 'QF', 'SF']) {
    for (let n = 1; n <= ROUND_SIZES[round]; n++) {
      if (!parent[`${round}#${n}`]) throw new Error(`${round}#${n} feeds nothing`);
    }
  }

  // 4. Post-order DFS from the Final → clean top-to-bottom order per round, then
  //    relabel. This restores the nested layout the UI expects (and makes the
  //    `from` arrays line up sequentially) while keeping ESPN's real wiring.
  const ordered = { R32: [], R16: [], QF: [], SF: [], F: [] };
  (function dfs(node) {
    for (const k of (children[node] || [])) dfs(k);
    ordered[node.split('#')[0]].push(node);
  })('F#1');

  const label = {};
  for (const round of ['R32', 'R16', 'QF', 'SF', 'F']) {
    ordered[round].forEach((node, i) => { label[node] = `${round}-${i + 1}`; });
  }

  // 5. Emit.
  const rounds = { R32: [], R16: [], QF: [], SF: [], F: [] };
  for (const round of ['R32', 'R16', 'QF', 'SF', 'F']) {
    for (const node of ordered[round]) {
      const it = num[node];
      const slot = label[node];
      const feeds = parent[node] ? label[parent[node]] : undefined;
      if (round === 'R32') {
        rounds.R32.push({ slot, match_id: it.matchId, home: it.home, away: it.away, kickoff_iso: it.kickoff_iso, feeds });
      } else {
        const from = children[node].map((k) => label[k]);
        rounds[round].push({ slot, match_id: it.matchId, from, kickoff_iso: it.kickoff_iso, ...(feeds ? { feeds } : {}) });
      }
    }
  }

  const r32Kicks = rounds.R32.map((s) => s.kickoff_iso).filter(Boolean).sort();
  return { seeded_at: new Date().toISOString(), first_kickoff_iso: r32Kicks[0] ?? null, rounds };
}

// Read one raw ESPN event's home/away competitor objects.
function competitors(event) {
  const comps = event.competitions?.[0]?.competitors || [];
  return {
    home: comps.find((x) => x.homeAway === 'home'),
    away: comps.find((x) => x.homeAway === 'away'),
  };
}

async function main() {
  const seen = new Set();
  const byRound = { R32: [], R16: [], QF: [], SF: [], F: [] };

  for (const dateStr of KO_DATES) {
    console.log(`Fetching ${dateStr}...`);
    const data = await fetchScoreboard(dateStr);
    for (const evt of (data.events || [])) {
      const id = String(evt.id);
      if (seen.has(id)) continue;
      seen.add(id);

      const { home, away } = competitors(evt);
      const fHome = parseFeederRef(home?.team?.displayName);
      const fAway = parseFeederRef(away?.team?.displayName);

      if (!fHome && !fAway) {
        // No feeder placeholders → real teams → Round of 32.
        const p = parseEvent(evt);
        byRound.R32.push({
          matchId: p.matchId, home: p.home, away: p.away,
          kickoff_iso: new Date(p.kickoff_iso).toISOString(),
        });
      } else {
        if (!fHome || !fAway) { console.warn(`Skipping ${id}: one side is a feeder, the other isn't`); continue; }
        // 3rd-place playoff feeds from Semifinal *Losers* — not part of the pool bracket.
        if (fHome.result === 'Loser' || fAway.result === 'Loser') continue;
        const round = NEXT_ROUND[fHome.round];
        byRound[round].push({ matchId: id, kickoff_iso: new Date(evt.date).toISOString(), feeders: [fHome, fAway] });
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Guard: don't seed a bracket whose R32 teams haven't resolved yet. ESPN uses
  // group-slot placeholders like "3RD" / "1L" / "2K" (they contain a digit)
  // until the group stage + best-third seeding are final.
  const unresolved = byRound.R32.filter((m) => /\d/.test(m.home) || /\d/.test(m.away) || !m.home || !m.away);
  if (unresolved.length) {
    console.error(`\n${unresolved.length} R32 match(es) still have unresolved teams (e.g. ${unresolved[0].home} vs ${unresolved[0].away}).`);
    console.error('The group stage / best-third seeding has not fully resolved on ESPN yet. Re-run later.');
    process.exit(1);
  }

  const ko = buildKnockout(byRound);
  await writeFile(new URL('../public/knockout.json', import.meta.url), JSON.stringify(ko, null, 2) + '\n');
  console.log('\nWrote public/knockout.json\n');

  for (const round of ['R32', 'R16', 'QF', 'SF', 'F']) {
    console.log(`${round}:`);
    for (const s of ko.rounds[round]) {
      const teams = round === 'R32' ? `${s.home} vs ${s.away}` : `${s.from[0]} / ${s.from[1]}`;
      console.log(`  ${s.slot.padEnd(6)} ${teams.padEnd(18)} ${s.match_id}  ${s.kickoff_iso}${s.feeds ? '  -> ' + s.feeds : ''}`);
    }
  }
  console.log(`\nFirst kickoff (config.json.knockout_lock_iso + Apps Script "knockout_lock_iso"): ${ko.first_kickoff_iso}`);
}

// Only run main() when executed directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
