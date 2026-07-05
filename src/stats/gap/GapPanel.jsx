/**
 * GapPanel.jsx — responsive wrapper for The Gap chart.
 * Measures container width, holds placeholder state for hovered/pinned (set in later tasks),
 * and renders GapChart.
 */
import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { toSeries, leaderEmail } from './series.js';
import { GapChart } from './GapChart.jsx';

const CHART_HEIGHT = 380;

/**
 * Simple hook: observes a container element and returns its current pixel width.
 */
function useContainerWidth(ref) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    obs.observe(ref.current);
    // Set initial width immediately.
    setWidth(ref.current.getBoundingClientRect().width);
    return () => obs.disconnect();
  }, [ref]);

  return width;
}

export function GapPanel({ history }) {
  const containerRef = useRef(null);
  const width = useContainerWidth(containerRef);

  // Placeholder state stubs — interactions added in later tasks.
  const [hovered, setHovered] = useState(null);   // email_hash | null
  const [pinned, setPinned] = useState(new Set()); // Set<email_hash>

  const series = useMemo(() => (history ? toSeries(history) : []), [history]);
  const leader = useMemo(() => (history ? leaderEmail(history) : null), [history]);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">The Gap</h2>
      <p className="text-sm text-slate-400 mb-3">
        Every entrant's cumulative points over the tournament. Leader in gold — hover a moment
        for the standing there.
      </p>
      <div ref={containerRef} style={{ width: '100%', minHeight: CHART_HEIGHT }}>
        {width > 0 && series.length > 0 ? (
          <GapChart
            series={series}
            leader={leader}
            width={width}
            height={CHART_HEIGHT}
            hovered={hovered}
            pinned={pinned}
          />
        ) : series.length === 0 ? (
          <p className="text-slate-500">No history yet.</p>
        ) : null}
      </div>
    </section>
  );
}
