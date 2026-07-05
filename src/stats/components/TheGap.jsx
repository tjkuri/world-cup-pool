import { ResponsiveLine } from '@nivo/line';
import { useMemo } from 'react';

// Transform history → Nivo series. Each entrant = one line of {x: Date, y: total}.
// Using native Date objects so xScale can use format:'native' — avoids d3 %Z parsing quirks.
function toSeries(history) {
  if (!Array.isArray(history?.snapshots)) return [];
  const byEmail = new Map();
  for (const snap of history.snapshots) {
    const xDate = new Date(snap.t);
    for (const s of snap.standings) {
      if (!byEmail.has(s.email_hash)) {
        byEmail.set(s.email_hash, { id: s.name, email_hash: s.email_hash, data: [] });
      }
      byEmail.get(s.email_hash).data.push({ x: xDate, y: s.total });
    }
  }
  return [...byEmail.values()];
}

function leaderEmail(history) {
  const last = history.snapshots.at(-1)?.standings ?? [];
  return [...last].sort((a, b) => b.total - a.total)[0]?.email_hash ?? null;
}

export function TheGap({ history }) {
  const series = useMemo(() => (history ? toSeries(history) : []), [history]);
  const leader = useMemo(() => (history ? leaderEmail(history) : null), [history]);
  if (!series.length) return <p className="text-slate-500">No history yet.</p>;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">The Gap</h2>
      <p className="text-sm text-slate-400 mb-3">
        Every entrant's cumulative points over the tournament. Leader in gold — hover a moment for
        the standing there.
      </p>
      <div style={{ height: 380 }}>
        <ResponsiveLine
          data={series}
          margin={{ top: 20, right: 90, bottom: 50, left: 50 }}
          xScale={{ type: 'time', format: 'native', precision: 'hour' }}
          xFormat="time:%b %-d"
          yScale={{ type: 'linear', min: 0, max: 'auto' }}
          axisBottom={{ format: '%b %-d', tickValues: 6 }}
          axisLeft={{ legend: 'points', legendOffset: -40, legendPosition: 'middle' }}
          curve="monotoneX"
          enablePoints={false}
          enableSlices="x"
          colors={(d) => (d.email_hash === leader ? '#fbbf24' : '#475569')}
          lineWidth={1.5}
          theme={{
            text: { fill: '#cbd5e1' },
            axis: { ticks: { text: { fill: '#94a3b8' } } },
            grid: { line: { stroke: '#1e293b' } },
          }}
          sliceTooltip={({ slice }) => {
            // Bucket points → names for a "tied at N" tooltip.
            const buckets = new Map();
            for (const p of slice.points) {
              const y = p.data.y;
              if (!buckets.has(y)) buckets.set(y, []);
              buckets.get(y).push(p.seriesId);
            }
            const rows = [...buckets.entries()]
              .sort((a, b) => b[0] - a[0])
              .slice(0, 6);
            return (
              <div
                style={{
                  background: '#0b1220',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: 8,
                  fontSize: 12,
                  color: '#e2e8f0',
                }}
              >
                <div style={{ color: '#94a3b8', marginBottom: 4 }}>
                  {String(slice.points[0]?.data?.xFormatted ?? '')}
                </div>
                {rows.map(([pts, names]) => (
                  <div key={pts}>
                    <strong style={{ color: '#fbbf24' }}>{pts}</strong> — {names.join(' · ')}
                  </div>
                ))}
              </div>
            );
          }}
        />
      </div>
    </section>
  );
}
