import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bracketSimilarity, twinsGraph, twinFor } from './twins.js';

const subs = [
  { email_hash: 'h1', name: 'A', phase: 'knockout', picks: { bracket: { s1: { advances: 'X' }, s2: { advances: 'Y' } } } },
  { email_hash: 'h2', name: 'B', phase: 'knockout', picks: { bracket: { s1: { advances: 'X' }, s2: { advances: 'Y' } } } }, // identical to A
  { email_hash: 'h3', name: 'C', phase: 'knockout', picks: { bracket: { s1: { advances: 'Z' }, s2: { advances: 'W' } } } }, // opposite
  { email_hash: 'h4', name: 'D', phase: 'group', picks: { matches: {} } }, // ignored
];

test('bracketSimilarity is the fraction of matching advancers over shared slots', () => {
  assert.equal(bracketSimilarity(subs[0], subs[1]), 1);   // identical
  assert.equal(bracketSimilarity(subs[0], subs[2]), 0);   // no overlap
  const half = { picks: { bracket: { s1: { advances: 'X' }, s2: { advances: 'Q' } } } };
  assert.equal(bracketSimilarity(subs[0], half), 0.5);    // half match
});

test('twinsGraph builds knockout nodes, a symmetric similarity map, and thresholded links', () => {
  const { nodes, links, similarity, threshold } = twinsGraph(subs);
  assert.equal(nodes.length, 3); // group sub excluded
  // similarity map is symmetric + correct
  assert.equal(similarity.h1.h2, similarity.h2.h1);
  assert.equal(similarity.h1.h2, 1);
  assert.equal(similarity.h1.h3, 0);
  // links only for genuinely-similar (>0) pairs at/above threshold, referencing real nodes
  const ids = new Set(nodes.map((n) => n.id));
  for (const l of links) {
    assert.ok(l.similarity > 0 && l.similarity >= threshold);
    assert.ok(ids.has(l.source) && ids.has(l.target));
  }
  // A↔B (identical) must link; a 0-similarity pair must not
  assert.ok(links.some((l) => [l.source, l.target].sort().join('|') === 'h1|h2'));
  assert.ok(!links.some((l) => [l.source, l.target].sort().join('|') === 'h1|h3'));
});

test('twinFor returns the most- and least-similar others', () => {
  const { similarity, nodes } = twinsGraph(subs);
  const nameByHash = Object.fromEntries(nodes.map((n) => [n.id, n.name]));
  const { twin, evil } = twinFor('h1', similarity, nameByHash);
  assert.equal(twin.email_hash, 'h2');
  assert.equal(twin.similarity, 1);
  assert.equal(twin.name, 'B');
  assert.equal(evil.email_hash, 'h3');
  assert.equal(evil.similarity, 0);
});
