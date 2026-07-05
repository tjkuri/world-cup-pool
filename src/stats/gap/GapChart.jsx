/**
 * GapChart.jsx — visx-based SVG chart for "The Gap".
 * Shows every entrant's cumulative points over the tournament.
 * BASE RENDER ONLY — no legend-highlighting, zoom, phase bands, or play mode yet.
 *
 * Props:
 *   series    [{ email_hash, name, data: [{x: Date, y: number}] }]
 *   leader    email_hash | null   — drawn in gold, slightly thicker
 *   width     number
 *   height    number
 *   xDomain   [Date, Date]  (optional; defaults to extent of all points)
 *   yDomain   [number, number]  (optional; defaults to [0, max total])
 *   hovered   email_hash | null  (spotlight — dims others when set)
 *   pinned    Set<email_hash>    (spotlight — dims others when non-empty)
 *   children  React node          (seam for PhaseBands, dot overlays, etc.)
 */
import { useMemo, useRef, useCallback } from 'react';
import { Group } from '@visx/group';
import { LinePath } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleTime, scaleLinear } from '@visx/scale';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip } from '@visx/tooltip';
import { timeFormat } from 'd3-time-format';

const MARGIN = { top: 20, right: 40, bottom: 50, left: 52 };
const TICK_COLOR = '#94a3b8';
const GRID_COLOR = '#1e293b';
const DEFAULT_LINE_COLOR = '#334155';  // idle non-leader
const SPOTLIGHT_COLOR = '#94a3b8';    // spotlighted non-leader (brighter)
const DIMMED_LINE_COLOR = '#1e293b';  // dimmed when another line is spotlit
const LEADER_COLOR = '#fbbf24';       // always gold

const formatDate = timeFormat('%b %-d');

export function GapChart({
  series,
  leader,
  width,
  height,
  xDomain: xDomainProp,
  yDomain: yDomainProp,
  hovered = null,
  pinned = null,
  children,
}) {
  const { tooltipOpen, tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } =
    useTooltip();

  const svgRef = useRef(null);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  // Pre-compute all x (Date) and y (number) values across all series.
  const allPoints = useMemo(() => series.flatMap((s) => s.data), [series]);

  // Unique sorted snapshot x values for crosshair snapping.
  const snapshotXs = useMemo(() => {
    const times = [...new Set(allPoints.map((p) => p.x.getTime()))];
    times.sort((a, b) => a - b);
    return times.map((t) => new Date(t));
  }, [allPoints]);

  // Build scales.
  const xScale = useMemo(() => {
    const domain =
      xDomainProp ??
      (allPoints.length
        ? [allPoints.reduce((m, p) => (p.x < m ? p.x : m), allPoints[0].x),
           allPoints.reduce((m, p) => (p.x > m ? p.x : m), allPoints[0].x)]
        : [new Date(), new Date()]);
    return scaleTime({ domain, range: [0, innerWidth] });
  }, [xDomainProp, allPoints, innerWidth]);

  const yScale = useMemo(() => {
    const domain =
      yDomainProp ??
      [0, allPoints.length ? Math.max(...allPoints.map((p) => p.y)) : 10];
    return scaleLinear({ domain, range: [innerHeight, 0] });
  }, [yDomainProp, allPoints, innerHeight]);

  // Determine if any spotlight is active.
  const hasSpotlight = hovered !== null || (pinned instanceof Set && pinned.size > 0);

  // Helper: is this series currently spotlighted (hovered or pinned)?
  const isSpotlit = useCallback(
    (s) =>
      s.email_hash === hovered || (pinned instanceof Set && pinned.has(s.email_hash)),
    [hovered, pinned],
  );

  // Return stroke color for a given series.
  const lineStroke = useCallback(
    (s) => {
      if (s.email_hash === leader) return LEADER_COLOR;
      if (!hasSpotlight) return DEFAULT_LINE_COLOR;
      return isSpotlit(s) ? SPOTLIGHT_COLOR : DIMMED_LINE_COLOR;
    },
    [leader, isSpotlit, hasSpotlight],
  );

  // Return stroke opacity for a given series.
  const lineOpacity = useCallback(
    (s) => {
      if (!hasSpotlight) return 1;
      return isSpotlit(s) ? 1 : 0.25;
    },
    [isSpotlit, hasSpotlight],
  );

  // Return stroke width: spotlighted lines are slightly thicker.
  const lineWidth = useCallback(
    (s) => {
      if (s.email_hash === leader) return isSpotlit(s) ? 2.5 : 2;
      return isSpotlit(s) ? 2 : 1.5;
    },
    [leader, isSpotlit],
  );

  // Accessors for LinePath.
  const getX = (d) => xScale(d.x) ?? 0;
  const getY = (d) => yScale(d.y) ?? 0;

  // Grid line y positions.
  const yTicks = useMemo(() => yScale.ticks(5), [yScale]);

  // Mouse-move handler: snap to nearest snapshot x, build tooltip data.
  const handleMouseMove = useCallback(
    (event) => {
      if (!svgRef.current || !snapshotXs.length) return;
      const rect = svgRef.current.getBoundingClientRect();
      // Mouse position relative to inner plot area.
      const mouseX = event.clientX - rect.left - MARGIN.left;
      const mouseDate = xScale.invert(mouseX);

      // Bisect to find nearest snapshot.
      let nearestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < snapshotXs.length; i++) {
        const diff = Math.abs(snapshotXs[i].getTime() - mouseDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          nearestIdx = i;
        }
      }
      const snapDate = snapshotXs[nearestIdx];

      // Gather all players' values at this snapshot.
      const rows = [];
      for (const s of series) {
        const pt = s.data.find((d) => d.x.getTime() === snapDate.getTime());
        if (pt !== undefined) {
          rows.push({ name: s.name, total: pt.y });
        }
      }

      // Bucket by equal total.
      const buckets = new Map();
      for (const { name, total } of rows) {
        if (!buckets.has(total)) buckets.set(total, []);
        buckets.get(total).push(name);
      }
      const sortedBuckets = [...buckets.entries()]
        .sort((a, b) => b[0] - a[0])
        .slice(0, 6);

      const ttLeft = (xScale(snapDate) ?? 0) + MARGIN.left;
      const ttTop = MARGIN.top;

      showTooltip({
        tooltipLeft: ttLeft,
        tooltipTop: ttTop,
        tooltipData: { snapDate, sortedBuckets, crosshairX: xScale(snapDate) ?? 0 },
      });
    },
    [snapshotXs, xScale, series, showTooltip],
  );

  if (!series.length || innerWidth <= 0 || innerHeight <= 0) {
    return <p className="text-slate-500">No history yet.</p>;
  }

  // Sort series so leader is rendered last (on top).
  const sortedSeries = [...series].sort((a, b) =>
    a.email_hash === leader ? 1 : b.email_hash === leader ? -1 : 0,
  );

  return (
    <div style={{ position: 'relative', width, height }}>
      <svg ref={svgRef} width={width} height={height}>
        <Group left={MARGIN.left} top={MARGIN.top}>
          {/* Subtle horizontal grid lines */}
          {yTicks.map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={innerWidth}
              y1={yScale(tick) ?? 0}
              y2={yScale(tick) ?? 0}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          ))}

          {/* One LinePath per series */}
          {sortedSeries.map((s) => (
            <LinePath
              key={s.email_hash}
              data={s.data}
              x={getX}
              y={getY}
              curve={curveMonotoneX}
              stroke={lineStroke(s)}
              strokeWidth={lineWidth(s)}
              strokeOpacity={lineOpacity(s)}
              fill="none"
            />
          ))}

          {/* Snapshot dots — only on active (hovered / pinned) lines.
              Rendering all 24 lines × ~115 points would be ~2 800 DOM nodes;
              limiting to active lines keeps this snappy. */}
          {hasSpotlight &&
            sortedSeries.map((s) => {
              if (!isSpotlit(s)) return null;
              const color = lineStroke(s);
              return s.data.map((d, i) => (
                <circle
                  // eslint-disable-next-line react/no-array-index-key
                  key={`${s.email_hash}-dot-${i}`}
                  cx={getX(d)}
                  cy={getY(d)}
                  r={3}
                  fill={color}
                  fillOpacity={0.9}
                  stroke="#0f172a"
                  strokeWidth={0.5}
                  pointerEvents="none"
                />
              ));
            })}

          {/* Crosshair vertical line */}
          {tooltipOpen && tooltipData && (
            <line
              x1={tooltipData.crosshairX}
              x2={tooltipData.crosshairX}
              y1={0}
              y2={innerHeight}
              stroke={TICK_COLOR}
              strokeWidth={1}
              strokeDasharray="4 2"
              pointerEvents="none"
            />
          )}

          {/* Seam: children slot for phase bands, dot overlays, etc. */}
          {children}

          {/* X axis */}
          <AxisBottom
            scale={xScale}
            top={innerHeight}
            numTicks={6}
            tickFormat={formatDate}
            stroke={GRID_COLOR}
            tickStroke={GRID_COLOR}
            tickLabelProps={{
              fill: TICK_COLOR,
              fontSize: 11,
              fontFamily: 'inherit',
              textAnchor: 'middle',
            }}
          />

          {/* Y axis */}
          <AxisLeft
            scale={yScale}
            numTicks={5}
            label="pts"
            labelProps={{
              fill: TICK_COLOR,
              fontSize: 11,
              fontFamily: 'inherit',
              textAnchor: 'middle',
            }}
            labelOffset={36}
            stroke={GRID_COLOR}
            tickStroke={GRID_COLOR}
            tickLabelProps={{
              fill: TICK_COLOR,
              fontSize: 11,
              fontFamily: 'inherit',
              textAnchor: 'end',
              dx: '-0.25em',
              dy: '0.3em',
            }}
          />

          {/* Transparent mouse-capture rect */}
          <rect
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={hideTooltip}
          />
        </Group>
      </svg>

      {/* Tooltip — absolutely positioned dark div over the SVG */}
      {tooltipOpen && tooltipData && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(tooltipData.crosshairX + MARGIN.left + 10, width - 220),
            top: MARGIN.top + 8,
            background: '#0b1220',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 12,
            color: '#e2e8f0',
            minWidth: 200,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div style={{ color: '#94a3b8', marginBottom: 4 }}>
            {formatDate(tooltipData.snapDate)}
          </div>
          {tooltipData.sortedBuckets.map(([pts, names]) => (
            <div key={pts}>
              <strong style={{ color: '#fbbf24' }}>{pts}</strong>
              {' — '}
              {names.join(' · ')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
