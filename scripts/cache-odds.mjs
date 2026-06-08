// One-shot script: fetch h2h World Cup odds from The Odds API, normalize to
// vig-removed implied probabilities averaged across bookmakers, and write
// public/odds.json keyed by ESPN match ID.
//
// Usage: ODDS_API_KEY=... node scripts/cache-odds.mjs
//
// Cost: 1 credit per run. Re-run manually to refresh.

import { readFile, writeFile } from 'node:fs/promises';

const API_KEY = process.env.ODDS_API_KEY;
if (!API_KEY) {
  console.error('Missing ODDS_API_KEY env var.');
  process.exit(1);
}

const HOST = process.env.ODDS_HOST || 'https://api.the-odds-api.com';
const SPORT = 'soccer_fifa_world_cup';

const fixtures = JSON.parse(await readFile(new URL('../public/fixtures.json', import.meta.url), 'utf8'));

// Build reverse name → code map from teamNames, plus aliases for the two
// places where The Odds API spelling differs.
const TEAM_NAMES_SRC = await readFile(new URL('../src/shared/teamNames.js', import.meta.url), 'utf8');
const NAME_TO_CODE = {};
for (const m of TEAM_NAMES_SRC.matchAll(/^\s*([A-Z]{3}):\s*'([^']+)',/gm)) {
  NAME_TO_CODE[m[2]] = m[1];
}
NAME_TO_CODE['USA'] = 'USA';
NAME_TO_CODE['Turkey'] = 'TUR';

const url = `${HOST}/v4/sports/${SPORT}/odds?apiKey=${API_KEY}&regions=us&markets=h2h&oddsFormat=decimal`;
const res = await fetch(url);
if (!res.ok) {
  console.error(`API error: ${res.status} ${res.statusText}`);
  console.error(await res.text());
  process.exit(1);
}
const events = await res.json();
console.log(`fetched ${events.length} events (remaining: ${res.headers.get('x-requests-remaining')})`);

const matches = {};
let mappedCount = 0;
const unmapped = [];

for (const evt of events) {
  const apiHome = NAME_TO_CODE[evt.home_team];
  const apiAway = NAME_TO_CODE[evt.away_team];
  if (!apiHome || !apiAway) {
    unmapped.push(`unknown teams: ${evt.home_team} / ${evt.away_team}`);
    continue;
  }

  const espnMatchId = Object.keys(fixtures.matches).find((mid) => {
    const fx = fixtures.matches[mid];
    return (fx.home === apiHome && fx.away === apiAway) ||
           (fx.home === apiAway && fx.away === apiHome);
  });
  if (!espnMatchId) {
    unmapped.push(`no ESPN fixture: ${apiHome} vs ${apiAway}`);
    continue;
  }

  // Per-bookmaker implied probs (vig-removed via normalization), averaged.
  let sumHome = 0, sumDraw = 0, sumAway = 0;
  let n = 0;
  for (const bk of evt.bookmakers) {
    const market = bk.markets.find((m) => m.key === 'h2h');
    if (!market) continue;
    let homeOdd, drawOdd, awayOdd;
    for (const o of market.outcomes) {
      if (o.name === evt.home_team) homeOdd = o.price;
      else if (o.name === evt.away_team) awayOdd = o.price;
      else if (o.name === 'Draw') drawOdd = o.price;
    }
    if (!homeOdd || !awayOdd || !drawOdd) continue;
    const rawH = 1 / homeOdd, rawD = 1 / drawOdd, rawA = 1 / awayOdd;
    const total = rawH + rawD + rawA;
    sumHome += rawH / total;
    sumDraw += rawD / total;
    sumAway += rawA / total;
    n++;
  }
  if (n === 0) {
    unmapped.push(`no usable h2h: ${apiHome} vs ${apiAway}`);
    continue;
  }

  const fx = fixtures.matches[espnMatchId];
  const flipped = fx.home === apiAway;
  matches[espnMatchId] = {
    home_implied: round3(flipped ? sumAway / n : sumHome / n),
    draw_implied: round3(sumDraw / n),
    away_implied: round3(flipped ? sumHome / n : sumAway / n),
    bookmaker_count: n,
  };
  mappedCount++;
}

function round3(x) { return Math.round(x * 1000) / 1000; }

const out = {
  cached_at: new Date().toISOString(),
  source: `${HOST} (h2h, decimal, region=us)`,
  matches,
};

await writeFile(new URL('../public/odds.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(`wrote public/odds.json — ${mappedCount} matches mapped, ${unmapped.length} skipped`);
if (unmapped.length) {
  console.log('skipped:');
  for (const m of unmapped) console.log(`  ${m}`);
}
