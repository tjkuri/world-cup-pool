import { ResponsiveBar } from '@nivo/bar';
import { useMemo } from 'react';
import { maxReachablePoints } from '../../../lib/ceiling.js';

// groupTotalsByEmail: Map(email_hash -> frozen group points). knockout/results as loaded.
function buildRows({ submissions, groupTotalsByEmail, knockout, results }) {
  const byEmail = new Map();
  for (const sub of submissions) {
    const row = byEmail.get(sub.email_hash) || { email_hash: sub.email_hash, name: sub.name, knockout: null };
    if (sub.phase === 'knockout') row.knockout = sub;
    row.name = sub.name;
    byEmail.set(sub.email_hash, row);
  }
  const rows = [...byEmail.values()].map((row) => {
    const groupBase = groupTotalsByEmail.get(row.email_hash) ?? 0;
    const ko = (row.knockout && knockout) ? maxReachablePoints(row.knockout.picks.bracket, knockout, results) : { current: 0, ceiling: 0 };
    const current = groupBase + ko.current;
    const ceiling = groupBase + ko.ceiling;
    return { name: row.name, current, upside: Math.max(0, ceiling - current), ceiling };
  });
  rows.sort((a, b) => b.ceiling - a.ceiling);
  return rows;
}

export function LiveCeiling({ submissions, groupTotalsByEmail, knockout, results }) {
  const rows = useMemo(
    () => (knockout && results ? buildRows({ submissions, groupTotalsByEmail, knockout, results }) : []),
    [submissions, groupTotalsByEmail, knockout, results],
  );
  if (!rows.length) return null;
  const leaderCurrent = Math.max(...rows.map((r) => r.current));

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">Live Ceiling</h2>
      <p className="text-sm text-slate-400 mb-3">Solid = points now, faded = max still reachable given who's alive in your bracket. Anyone whose ceiling is below the current leader's {leaderCurrent} is out of it.</p>
      <div style={{ height: Math.max(240, rows.length * 22) }}>
        <ResponsiveBar
          data={rows}
          keys={['current', 'upside']}
          indexBy="name"
          layout="horizontal"
          margin={{ top: 16, right: 20, bottom: 30, left: 90 }}
          padding={0.25}
          colors={({ id }) => (id === 'current' ? '#4ade80' : '#a78bfa')}
          markers={[{ axis: 'x', value: leaderCurrent, lineStyle: { stroke: '#fb7185', strokeWidth: 2, strokeDasharray: '5 4' } }]}
          label={(d) => `${d.value}`}
          labelTextColor="#0f172a"
          enableGridY={false}
          valueFormat={(v) => `${v}`}
          theme={{
            text: { fill: '#cbd5e1' },
            axis: { ticks: { text: { fill: '#94a3b8' } } },
            tooltip: { container: { background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', fontSize: 12, borderRadius: 6 } },
          }}
        />
      </div>
    </section>
  );
}
