/**
 * GapPanel.jsx — responsive wrapper for The Gap chart + legend.
 * Measures chart container width; owns hovered/pinned spotlight state;
 * owns zoom/pan state via useGapZoom; lays out chart (flex-1) + legend
 * (fixed-width sidebar) side-by-side on md+ screens, stacked on narrow.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toSeries, leaderEmail } from './series.js';
import { GapChart } from './GapChart.jsx';
import { GapLegend } from './GapLegend.jsx';
import { useGapZoom } from './useGapZoom.js';
import { phaseBoundaries } from '../../../lib/phases.js';

const CHART_HEIGHT = 380;

// Mirror GapChart's MARGIN so we can compute innerWidth/innerHeight here.
// These must stay in sync with the MARGIN constant in GapChart.jsx.
const MARGIN = { top: 20, right: 40, bottom: 50, left: 52 };

/**
 * Palette for pinned player lines — dark-friendly, avoids gold (#fbbf24 is the leader).
 * Colors are assigned in insertion order of the pinned Set; cycling if > 6 pins.
 */
const PINNED_PALETTE = ['#22d3ee', '#f472b6', '#a78bfa', '#a3e635', '#fb923c', '#38bdf8'];

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

export function GapPanel({ history, knockout }) {
  // chartRef measures only the chart wrapper (not the legend) so the chart
  // fills its flex-1 cell correctly.
  const chartRef = useRef(null);
  const width = useContainerWidth(chartRef);

  // Spotlight state: hovered = one email_hash | null, pinned = Set of hashes.
  const [hovered, setHovered] = useState(null); // email_hash | null
  const [pinned, setPinned] = useState(() => new Set()); // Set<email_hash>

  const onHover = useCallback((hash) => setHovered(hash), []);

  // Returns a new Set so React sees a changed reference and re-renders.
  const onTogglePin = useCallback((hash) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) {
        next.delete(hash);
      } else {
        next.add(hash);
      }
      return next;
    });
  }, []);

  const series = useMemo(() => (history ? toSeries(history) : []), [history]);
  const leader = useMemo(() => (history ? leaderEmail(history) : null), [history]);
  const boundaries = useMemo(() => phaseBoundaries(knockout ?? null), [knockout]);

  // Derive a stable color for each pinned player (insertion-order → palette index).
  // Removing a pin and re-adding may get a new color; that is acceptable.
  const pinnedColors = useMemo(() => {
    const map = new Map();
    let i = 0;
    for (const hash of pinned) {
      map.set(hash, PINNED_PALETTE[i % PINNED_PALETTE.length]);
      i++;
    }
    return map;
  }, [pinned]);

  // Full data extent — used to seed useGapZoom and passed as domain to GapChart.
  const { xDomainFull, yDomainFull } = useMemo(() => {
    const allPoints = series.flatMap((s) => s.data);
    if (!allPoints.length) return { xDomainFull: null, yDomainFull: null };
    const xMin = allPoints.reduce((m, p) => (p.x < m ? p.x : m), allPoints[0].x);
    const xMax = allPoints.reduce((m, p) => (p.x > m ? p.x : m), allPoints[0].x);
    const yMax = Math.max(...allPoints.map((p) => p.y));
    return { xDomainFull: [xMin, xMax], yDomainFull: [0, yMax] };
  }, [series]);

  // Inner plot dimensions (must mirror GapChart MARGIN so zoom transform is accurate).
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, CHART_HEIGHT - MARGIN.top - MARGIN.bottom);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  // disabled seam: pass disabled={true} here when Task 9 play mode is active.
  const {
    xDomain: zoomedXDomain,
    yDomain: zoomedYDomain,
    bind: zoomBind,
    reset: zoomReset,
    isZoomed,
    isDragging,
  } = useGapZoom({
    xDomainFull,
    yDomainFull,
    innerWidth,
    innerHeight,
    disabled: false, // Task 9 will wire a `disabled` prop here
  });

  const hasData = series.length > 0;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">The Gap</h2>
      <p className="text-sm text-slate-400 mb-3">
        Every entrant&apos;s cumulative points over the tournament. Leader in gold — hover a
        moment for the standing there. Click a name to pin it for comparison.
        Scroll to zoom · drag to pan.
      </p>

      <div className="flex flex-col md:flex-row gap-3 items-start">
        {/* Chart — flex-1 so it takes the remaining width beside the legend */}
        <div
          ref={chartRef}
          className="flex-1 min-w-0 relative"
          style={{ minHeight: CHART_HEIGHT }}
        >
          {width > 0 && hasData ? (
            <>
              <GapChart
                series={series}
                leader={leader}
                width={width}
                height={CHART_HEIGHT}
                xDomain={zoomedXDomain}
                yDomain={zoomedYDomain}
                hovered={hovered}
                pinned={pinned}
                pinnedColors={pinnedColors}
                boundaries={boundaries}
                zoomBind={zoomBind}
                isDragging={isDragging}
              />

              {/* Reset zoom button — shown only when transform deviates from identity */}
              {isZoomed && (
                <button
                  type="button"
                  onClick={zoomReset}
                  style={{
                    position: 'absolute',
                    top: MARGIN.top + 4,
                    right: MARGIN.right + 4,
                    background: 'rgba(15,23,42,0.88)',
                    border: '1px solid #334155',
                    borderRadius: 4,
                    color: '#94a3b8',
                    fontSize: 11,
                    padding: '3px 8px',
                    cursor: 'pointer',
                    zIndex: 20,
                    lineHeight: 1.4,
                  }}
                >
                  Reset zoom
                </button>
              )}
            </>
          ) : hasData ? null : (
            <p className="text-slate-500">No history yet.</p>
          )}
        </div>

        {/* Legend sidebar */}
        {hasData && (
          <div className="flex-shrink-0 w-full md:w-44">
            <GapLegend
              series={series}
              leader={leader}
              hovered={hovered}
              pinned={pinned}
              pinnedColors={pinnedColors}
              onHover={onHover}
              onTogglePin={onTogglePin}
            />
          </div>
        )}
      </div>
    </section>
  );
}
