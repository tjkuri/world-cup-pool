import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advancementFlows } from './advancement.js';

const knockout = { rounds: {
  R16: [{ slot: 'R16-1' }, { slot: 'R16-2' }],
  QF: [{ slot: 'QF-1' }],
  SF: [],
  F: [{ slot: 'F-1' }],
} };

const subs = [
  { phase: 'knockout', picks: { bracket: {
    'R16-1': { advances: 'BRA' }, 'R16-2': { advances: 'ARG' }, 'QF-1': { advances: 'BRA' }, 'F-1': { advances: 'BRA' },
  } } },
  { phase: 'knockout', picks: { bracket: {
    'R16-1': { advances: 'BRA' }, 'R16-2': { advances: 'GER' }, 'QF-1': { advances: 'GER' }, 'F-1': { advances: 'GER' },
  } } },
  { phase: 'group', picks: { matches: {} } }, // ignored
];

test('advancementFlows aggregates team flows across knockout brackets', () => {
  const { nodes, links } = advancementFlows(subs, knockout);
  const val = (s, t) => links.find((l) => l.source === s && l.target === t)?.value || 0;

  // R16→QF: BRA advanced by both → 2; ARG (sub1) → 1; GER (sub2) → 1.
  assert.equal(val('R16:BRA', 'QF:BRA'), 2);
  assert.equal(val('R16:ARG', 'QF:ARG'), 1);
  assert.equal(val('R16:GER', 'QF:GER'), 1);
  // QF→SF: QF-1 advances BRA (sub1), GER (sub2) → each 1.
  assert.equal(val('QF:BRA', 'SF:BRA'), 1);
  assert.equal(val('QF:GER', 'SF:GER'), 1);
  // SF empty → no SF→Final links.
  assert.equal(links.some((l) => l.source.startsWith('SF:') && l.target.startsWith('Final:')), false);
  // Final→Champion: sub1 BRA, sub2 GER → each 1.
  assert.equal(val('Final:BRA', 'Champion:BRA'), 1);
  assert.equal(val('Final:GER', 'Champion:GER'), 1);
  // nodes reference the links and are unique.
  assert.ok(nodes.some((n) => n.id === 'R16:BRA'));
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length);
});
