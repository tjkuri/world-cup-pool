// scripts/build-history.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitLog } from './build-history.mjs';

test('parseGitLog turns "sha<TAB>iso" lines into ordered oldest-first records', () => {
  const stdout = [
    'aaa111\t2026-07-04T21:48:25+00:00',
    'bbb222\t2026-06-11T20:11:04+00:00',
  ].join('\n');
  const recs = parseGitLog(stdout);
  // git log is newest-first; parser reverses to oldest-first for a time series.
  assert.deepEqual(recs.map((r) => r.sha), ['bbb222', 'aaa111']);
  assert.equal(recs[0].t, '2026-06-11T20:11:04+00:00');
});
