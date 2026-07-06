// scripts/build-history.mjs
// Walk the git history of public/results.json, replay each snapshot through the
// pure scorers, and write public/history.json (the time series behind "The Gap").
// Deterministic: picks are locked, so same history in → same file out.
//
// Usage:
//   node scripts/build-history.mjs
// Requires network access to the Apps Script submissions endpoint (post-lock).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildHistorySeries } from '../lib/history.js';

export function parseGitLog(stdout) {
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, t] = line.split('\t');
      return { sha, t };
    })
    .reverse(); // git log is newest-first; we want oldest-first
}

function gitShowJson(sha, path) {
  const raw = execFileSync('git', ['show', `${sha}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(raw);
}

async function main() {
  const config = JSON.parse(readFileSync('public/config.json', 'utf8'));
  const fixtures = JSON.parse(readFileSync('public/fixtures.json', 'utf8'));
  let knockout = null;
  try { knockout = JSON.parse(readFileSync('public/knockout.json', 'utf8')); } catch {}

  const log = execFileSync('git', ['log', '--format=%H\t%cI', '--', 'public/results.json'], { encoding: 'utf8' });
  const commits = parseGitLog(log);

  const snapshots = [];
  for (const { sha, t } of commits) {
    let results;
    try { results = gitShowJson(sha, 'public/results.json'); } catch { continue; }
    if (!results?.matches) continue;
    snapshots.push({ t, results });
  }

  const resp = await fetch(`${config.apps_script_url}?action=submissions`);
  const data = await resp.json();
  if (!data.locked) throw new Error('submissions not unlocked yet — cannot build history');
  const submissions = data.submissions;

  const series = buildHistorySeries({ snapshots, submissions, fixtures, knockout });
  const output = { built_at: new Date().toISOString(), ...series };
  writeFileSync('public/history.json', JSON.stringify(output));
  console.log(`Wrote public/history.json — ${series.snapshots.length} snapshots, ${series.snapshots.at(-1)?.standings.length ?? 0} entrants.`);
}

// Only run main() when invoked directly, not when imported by the test.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
