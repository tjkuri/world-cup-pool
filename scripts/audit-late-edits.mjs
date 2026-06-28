// Audit knockout submissions for edits made AFTER a match kicked off.
//
// The pool extended the bracket deadline past the first R32 kickoff, with the
// rule: any pick edited (or first submitted) after that match started gets its
// points nulled. The ?action=submissions API only returns each player's LATEST
// row, so it can't see edit history — this reads the full "submissions" sheet
// exported as TSV (Google Sheets → File → Download → Tab-separated values).
//
// Usage:
//   node scripts/audit-late-edits.mjs <submissions.tsv> [asOfISO]
//
// For each player and each match that had kicked off by `asOf` (default: now),
// it compares their FINAL pick to their last pick made BEFORE that match's
// kickoff. Flags it if they changed it, or never had a pre-kickoff pick (first
// submission after the match started). kickoff times come from public/knockout.json.

import { readFile } from 'node:fs/promises';

const [, , tsvPath, asOfArg] = process.argv;
if (!tsvPath) {
  console.error('Usage: node scripts/audit-late-edits.mjs <submissions.tsv> [asOfISO]');
  process.exit(1);
}
const asOf = asOfArg ? new Date(asOfArg) : new Date();

const ko = JSON.parse(await readFile(new URL('../public/knockout.json', import.meta.url)));
const kickoff = {}; // match_id -> Date
for (const round of Object.values(ko.rounds))
  for (const s of round)
    if (s.match_id && s.kickoff_iso) kickoff[s.match_id] = new Date(s.kickoff_iso);

const rows = (await readFile(tsvPath, 'utf8'))
  .split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim())
  .map((l) => l.split('\t'));

// columns: submitted_at | name | email | secret_hash | phase | picks_json | [version]
const byEmail = new Map();
for (const r of rows) {
  const [ts, name, email, , phase, picksJson] = r;
  if (phase !== 'knockout' || !picksJson) continue;
  let picks;
  try { picks = JSON.parse(picksJson); } catch { continue; }
  const key = (email || '').trim().toLowerCase();
  if (!byEmail.has(key)) byEmail.set(key, []);
  byEmail.get(key).push({ ts: new Date(ts), name, bracket: picks.bracket || {} });
}

const pickStr = (s) => (s ? `${s.advances} ${s.home_score}-${s.away_score}` : '—');
const same = (a, b) => a && b && a.advances === b.advances && a.home_score === b.home_score && a.away_score === b.away_score;

const flags = [];
for (const [email, subs] of byEmail) {
  subs.sort((a, b) => a.ts - b.ts);
  const final = subs[subs.length - 1];
  for (const [mid, kt] of Object.entries(kickoff)) {
    if (kt > asOf) continue; // match hasn't started yet — nothing to audit
    const slotKey = Object.keys(final.bracket).find((k) => String(final.bracket[k].match_id) === mid);
    if (!slotKey) continue;
    const finalPick = final.bracket[slotKey];
    const pre = [...subs].reverse().find((s) => s.ts < kt); // last submission before kickoff
    const prePick = pre ? pre.bracket[slotKey] : null;
    let reason = null;
    if (!pre) reason = 'first submission AFTER kickoff';
    else if (!same(prePick, finalPick)) reason = 'changed after kickoff';
    if (reason) flags.push({ name: final.name, email, slot: slotKey, mid, pre: pickStr(prePick), final: pickStr(finalPick), reason, finalTs: final.ts.toISOString() });
  }
}

console.log(`Audited ${byEmail.size} players, as of ${asOf.toISOString()}.\n`);
if (!flags.length) { console.log('✅ No post-kickoff edits found.'); process.exit(0); }
console.log(`🚩 ${flags.length} (player, match) pair(s) to NULL:\n`);
for (const f of flags.sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name)))
  console.log(`  ${f.name.padEnd(18)} ${f.slot.padEnd(6)} ${f.pre.padEnd(12)} -> ${f.final.padEnd(12)} [${f.reason}; latest ${f.finalTs}]`);
