import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bracketSimilarity, twinsGraph } from './twins.js';

const subs = [
  { email_hash: 'h1', name: 'A', phase: 'knockout', picks: { bracket: { s1: { advances: 'X' }, s2: { advances: 'Y' } } } },
  { email_hash: 'h2', name: 'B', phase: 'knockout', picks: { bracket: { s1: { advances: 'X' }, s2: { advances: 'Y' } } } }, // identical to A
  { email_hash: 'h3', name: 'C', phase: 'knockout', picks: { bracket: { s1: { advances: 'Z' }, s2: { advances: 'W' } } } }, // opposite
  { email_hash: 'h4', name: 'D', phase: 'group', picks: { matches: {} } }, // ignored
];

test('bracketSimilarity is the fraction of matching advancers over shared slots', () => {
  assert.equal(bracketSimilarity(subs[0], subs[1]), 1);   // identical
  assert.equal(bracketSimilarity(subs[0], subs[2]), 0);   // no overlap
  // half match
  const half = { picks: { bracket: { s1: { advances: 'X' }, s2: { advances: 'Q' } } } };
  assert.equal(bracketSimilarity(subs[0], half), 0.5);
});

test('twinsGraph builds knockout-only nodes and deduped undirected links', () => {
  const { nodes, links } = twinsGraph(subs, 1);
  assert.equal(nodes.length, 3); // group sub excluded
  assert.ok(nodes.every((n) => n.id && n.name));
  // A↔B are mutual nearest (sim 1) → exactly one deduped link between them
  const ab = links.filter((l) => [l.source, l.target].sort().join('|') === 'h1|h2');
  assert.equal(ab.length, 1);
  assert.ok(ab[0].distance < 60); // high similarity → short distance
  // every link references real nodes
  const ids = new Set(nodes.map((n) => n.id));
  assert.ok(links.every((l) => ids.has(l.source) && ids.has(l.target)));
});
