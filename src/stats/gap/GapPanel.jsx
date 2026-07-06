/**
 * GapPanel.jsx — responsive wrapper for The Gap chart + legend.
 * Measures chart container width; owns hovered/pinned spotlight state;
 * owns zoom/pan state via useGapZoom; owns playback state via usePlayback.
 *
 * Playback (animate mode):
 *   When `playing` is true OR `index < snapshotCount - 1` (mid-reveal),
 *   `isPlaybackActive` is true:
 *     • Each series is sliced to data[0..index] (cumulative reveal).
 *     • xDomain / yDomain are derived from that slice so the axes
 *       auto-zoom-out as the reveal grows (the "zoom-out" animation effect).
 *     • Manual zoom is suspended (disabled={isPlaybackActive} on useGapZoom).
 *   When the animation completes (index === count-1, playing=false),
 *   isPlaybackActive becomes false and zoom re-enables automatically.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toSeries, leaderEmail } from './series.js';
import { GapChart, MARGIN } from './GapChart.jsx';
import { GapLegend } from './GapLegend.jsx';
import { useGapZoom } from './useGapZoom.js';
import { usePlayback } from './usePlayback.js';
import { PlayControls } from './PlayControls.jsx';
import { phaseBoundaries } from '../../../lib/phases.js';

const CHART_HEIGHT = 380;

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

  // ── Playback ──────────────────────────────────────────────────────────────
  const snapshotCount = series.length > 0 ? series[0].data.length : 0;
  const { index, playing, toggle: playToggle, seek } = usePlayback(snapshotCount);

  // isPlaybackActive: true when mid-reveal (not yet at the last snapshot).
  // When false (index === count-1, !playing), full series + zoom is restored.
  const isPlaybackActive = playing || index < snapshotCount - 1;

  // Sliced series + slice-derived domains for the animate mode.
  // x: [firstDate, sliceLastDate]  y: [0, sliceMaxTotal]
  const { displaySeries, sliceXDomain, sliceYDomain } = useMemo(() => {
    if (!isPlaybackActive || !series.length || snapshotCount === 0) {
      return { displaySeries: series, sliceXDomain: null, sliceYDomain: null };
    }

    const sliceEnd = index + 1;
    const slicedSeries = series.map((s) => ({ ...s, data: s.data.slice(0, sliceEnd) }));
    const slicePoints = slicedSeries.flatMap((s) => s.data);

    if (!slicePoints.length) {
      return { displaySeries: slicedSeries, sliceXDomain: null, sliceYDomain: null };
    }

    const xFirst = slicePoints.reduce((m, p) => (p.x < m ? p.x : m), slicePoints[0].x);
    const xLast = slicePoints.reduce((m, p) => (p.x > m ? p.x : m), slicePoints[0].x);
    // Guard against zero-width domain when only one snapshot is visible.
    const xLastAdj =
      xFirst.getTime() === xLast.getTime()
        ? new Date(xLast.getTime() + 24 * 60 * 60 * 1000)
        : xLast;

    const yMax = Math.max(...slicePoints.map((p) => p.y), 1);

    return {
      displaySeries: slicedSeries,
      sliceXDomain: [xFirst, xLastAdj],
      sliceYDomain: [0, yMax],
    };
  }, [isPlaybackActive, series, index, snapshotCount]);

  // Date label shown in PlayControls for the current scrubber position.
  const snapshotDate = useMemo(() => {
    if (!series.length || !series[0].data.length) return null;
    const safeIdx = Math.min(index, series[0].data.length - 1);
    return series[0].data[safeIdx]?.x ?? null;
  }, [series, index]);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  // disabled while playback is active so wheel/drag interactions are ignored.
  // The carry-forward drag-reset useEffect inside useGapZoom ensures a
  // mid-drag → play-start transition doesn't leave the crosshair stuck.
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
    disabled: isPlaybackActive,
  });

  // Choose which x/y domains to pass to GapChart.
  const xDomainForChart = isPlaybackActive ? sliceXDomain : zoomedXDomain;
  const yDomainForChart = isPlaybackActive ? sliceYDomain : zoomedYDomain;

  const hasData = series.length > 0;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">The Gap</h2>
      <p className="text-sm text-slate-400 mb-3">
        Every entrant&apos;s cumulative points over the tournament. Leader in gold — hover a
        moment for the standing there. Click a name to pin it for comparison.
        Scroll to zoom · drag to pan.
      </p>

      {/* Play controls — shown when there are at least 2 snapshots */}
      {hasData && snapshotCount > 1 && (
        <PlayControls
          index={index}
          playing={playing}
          count={snapshotCount}
          onToggle={playToggle}
          onSeek={seek}
          snapshotDate={snapshotDate}
        />
      )}

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
                series={displaySeries}
                leader={leader}
                width={width}
                height={CHART_HEIGHT}
                xDomain={xDomainForChart}
                yDomain={yDomainForChart}
                hovered={hovered}
                pinned={pinned}
                pinnedColors={pinnedColors}
                boundaries={boundaries}
                zoomBind={zoomBind}
                isDragging={isDragging}
              />

              {/* Reset zoom button — shown only when zoomed AND not in playback mode
                  (during playback the slice domains override zoom, so the button
                  would be misleading). */}
              {isZoomed && !isPlaybackActive && (
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

        {/* Legend sidebar — always gets the full series so rankings reflect final totals.
            When in playback mode the slicedSeries is passed so current-snapshot
            totals are shown, and the rankings change live as the animation plays. */}
        {hasData && (
          <div className="flex-shrink-0 w-full md:w-44">
            <GapLegend
              series={displaySeries}
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
