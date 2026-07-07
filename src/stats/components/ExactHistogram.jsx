import { ResponsiveBar } from '@nivo/bar';
import { useMemo } from 'react';
import { exactCountHistogram } from '../../../lib/distributions.js';

const THEME = {
  text: { fill: '#cbd5e1' },
  axis: { ticks: { text: { fill: '#94a3b8' } }, legend: { text: { fill: '#94a3b8' } } },
  tooltip: { container: { background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', fontSize: 12, borderRadius: 6 } },
  grid: { line: { stroke: '#1e293b' } },
};

function ExactTooltip({ data }) {
  return (
    <div style={{ background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', fontSize: 12, borderRadius: 6, padding: '6px 10px' }}>
      <strong>{data.players}</strong> player{data.players !== 1 ? 's' : ''} — <strong>{data.exact}</strong> exact{data.exact !== 1 ? 's' : ''}
    </div>
  );
}

export function ExactHistogram({ submissions, fixtures, results, knockout }) {
  const data = useMemo(
    () => exactCountHistogram(submissions || [], fixtures, results, knockout),
    [submissions, fixtures, results, knockout],
  );

  if (!data.length) {
    return (
      <section>
        <h3 className="text-lg font-semibold mb-1">Exact-Score Distribution</h3>
        <p className="text-sm text-slate-400">How many players nailed N exact scorelines across the whole tournament.</p>
        <p className="text-sm text-slate-500 mt-4">No exact-score data yet.</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-lg font-semibold mb-1">Exact-Score Distribution</h3>
      <p className="text-sm text-slate-400 mb-3">How many players nailed N exact scorelines across the whole tournament.</p>
      <div style={{ height: 300 }}>
        <ResponsiveBar
          data={data}
          keys={['players']}
          indexBy="exact"
          layout="vertical"
          margin={{ top: 16, right: 20, bottom: 50, left: 50 }}
          padding={0.3}
          colors={() => '#34d399'}
          theme={THEME}
          enableGridY
          axisBottom={{
            legend: 'exact scores nailed',
            legendPosition: 'middle',
            legendOffset: 38,
          }}
          axisLeft={{
            legend: 'players',
            legendPosition: 'middle',
            legendOffset: -38,
            format: (v) => Number.isInteger(v) ? v : '',
          }}
          valueFormat={(v) => `${v}`}
          labelSkipHeight={16}
          labelTextColor="#0f172a"
          tooltip={({ data: d }) => <ExactTooltip data={d} />}
        />
      </div>
    </section>
  );
}
