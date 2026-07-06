/**
 * GapChart.jsx — visx-based SVG chart for "The Gap".
 * Shows every entrant's cumulative points over the tournament.
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
 *   zoomBind  { onWheel, onPointerDown, onPointerMove, onPointerUp } | null
 *             from useGapZoom — attached to the interaction surface.
 *             onWheel is also added via a non-passive addEventListener so that
 *             event.preventDefault() reliably prevents page scroll during zoom.
 *   isDragging boolean — when true, the crosshair tooltip is suppressed so it
 *             doesn't interfere with pan gestures.
 *   children  React node  (seam for future overlays)
 */
import { useMemo, useRef, useCallback, useId, useEffect } from 'react';
import { Group } from '@visx/group';
import { LinePath } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleTime, scaleLinear } from '@visx/scale';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip } from '@visx/tooltip';
import { timeFormat } from 'd3-time-format';
import { PhaseBands } from './PhaseBands.jsx';

const MARGIN = { top: 20, right: 40, bottom: 50, left: 52 };
const TICK_COLOR = '#94a3b8';
const GRID_COLOR = '#1e293b';
const DEFAULT_LINE_COLOR = '#334155';  // idle non-leader
const SPOTLIGHT_COLOR = '#94a3b8';    // spotlighted non-leader (brighter)
const DIMMED_LINE_COLOR = '#1e293b';  // dimmed when another line is spotlit
const LEADER_COLOR = '#fbbf24';       // always gold

/** Stable empty Map to use as default for pinnedColors prop. */
const EMPTY_MAP = new Map();

const formatDate = timeFormat('%b %-d');

/** Return an ordinal suffix string for rank n (1st, 2nd, 3rd, 4th…). */
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function GapChart({
  series,
  leader,
  width,
  height,
  xDomain: xDomainProp,
  yDomain: yDomainProp,
  hovered = null,
  pinned = null,
  pinnedColors = EMPTY_MAP,
  boundaries = [],
  zoomBind = null,
  isDragging = false,
  children,
}) {
  const { tooltipOpen, tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } =
    useTooltip();

  const svgRef = useRef(null);
  // Ref for the interaction rect: used to attach a non-passive wheel listener
  // so event.preventDefault() reliably suppresses page scroll during zoom.
  const interactionRectRef = useRef(null);

  // Unique clip-path id — useId guarantees no collision across multiple instances.
  const clipId = useId();
  const clipPathId = `gap-clip-${clipId.replace(/:/g, '')}`;

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

  // Build scales from the (possibly zoomed) xDomain/yDomain props.
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
  // Priority when spotlight active: pinned → palette color; leader (not pinned) → gold;
  // hovered non-leader → slate spotlight; everything else → dimmed.
  const lineStroke = useCallback(
    (s) => {
      if (hasSpotlight) {
        const isPinned = pinned instanceof Set && pinned.has(s.email_hash);
        if (isPinned) return pinnedColors.get(s.email_hash) ?? SPOTLIGHT_COLOR;
        if (s.email_hash === leader) return LEADER_COLOR; // leader stays gold even in spotlight
        if (s.email_hash === hovered) return SPOTLIGHT_COLOR;
        return DIMMED_LINE_COLOR;
      }
      // No spotlight — standard two-tone render.
      if (s.email_hash === leader) return LEADER_COLOR;
      return DEFAULT_LINE_COLOR;
    },
    [leader, hovered, pinned, pinnedColors, hasSpotlight],
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
  // Only called when NOT dragging (isDragging suppresses it).
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
      // valueAtSnap: Map(email_hash → total) — used for selection-aware tooltip rank.
      const rows = [];
      const valueAtSnap = new Map();
      for (const s of series) {
        const pt = s.data.find((d) => d.x.getTime() === snapDate.getTime());
        if (pt !== undefined) {
          rows.push({ email_hash: s.email_hash, name: s.name, total: pt.y });
          valueAtSnap.set(s.email_hash, pt.y);
        }
      }

      // Bucket by equal total (for no-selection tooltip).
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
        tooltipData: { snapDate, sortedBuckets, crosshairX: xScale(snapDate) ?? 0, valueAtSnap },
      });
    },
    [snapshotXs, xScale, series, showTooltip],
  );

  // ── Non-passive wheel listener ────────────────────────────────────────────
  // Attaching via addEventListener({ passive: false }) ensures event.preventDefault()
  // reliably suppresses page scroll when the user zooms over the chart.
  // This supplements (or replaces) the React onWheel prop which may be passive
  // depending on the React root configuration.
  useEffect(() => {
    const el = interactionRectRef.current;
    const handler = zoomBind?.onWheel;
    if (!el || !handler) return;
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [zoomBind?.onWheel]);

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
        {/* Clip path constrains lines/dots to the inner plot area.
            Applied only to data layers so axes/phase labels stay unclipped. */}
        <defs>
          <clipPath id={clipPathId}>
            <rect x={0} y={0} width={innerWidth} height={innerHeight} />
          </clipPath>
        </defs>

        <Group left={MARGIN.left} top={MARGIN.top}>
          {/* Phase bands — backmost layer, behind grid lines and data lines.
              Not clipped so band labels at the edge remain visible. */}
          <PhaseBands
            boundaries={boundaries}
            xScale={xScale}
            innerWidth={innerWidth}
            innerHeight={innerHeight}
          />

          {/* Subtle horizontal grid lines — not clipped (extend to axis edges) */}
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

          {/* ── Clipped data group ────────────────────────────────────────────
              Lines, dots, and the crosshair are all clipped to the plot bounds
              so that when zoomed, data never overflows past the axis lines.   */}
          <g clipPath={`url(#${clipPathId})`}>
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

            {/* Crosshair vertical line — suppressed while dragging to pan */}
            {!isDragging && tooltipOpen && tooltipData && (
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
          </g>
          {/* ── End clipped data group ──────────────────────────────────────── */}

          {/* Seam: children slot for future overlays */}
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

          {/* Transparent interaction rect — topmost layer so it captures all events.
              Zoom handlers (pan + scroll) coexist with the crosshair tooltip:
                • onPointerMove: calls zoom pan handler first; crosshair only when
                  not dragging (isDragging prop suppresses it during pan).
                • onWheel: also attached non-passively via useEffect above so that
                  event.preventDefault() reliably prevents page scroll.
                • onPointerDown: hides crosshair tooltip at drag start.
                • onPointerUp / onPointerLeave: ends drag and hides tooltip.     */}
          <rect
            ref={interactionRectRef}
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            style={{ cursor: isDragging ? 'grabbing' : zoomBind?.onPointerDown ? 'grab' : 'crosshair' }}
            onPointerDown={
              zoomBind?.onPointerDown
                ? (e) => { hideTooltip(); zoomBind.onPointerDown(e); }
                : undefined
            }
            onPointerMove={(e) => {
              // Pan if dragging; crosshair if hovering.
              zoomBind?.onPointerMove?.(e);
              if (!isDragging) handleMouseMove(e);
            }}
            onPointerUp={
              zoomBind?.onPointerUp
                ? (e) => { zoomBind.onPointerUp(e); }
                : undefined
            }
            onPointerLeave={(e) => {
              // End drag (pointer capture released) + hide crosshair.
              zoomBind?.onPointerUp?.(e);
              hideTooltip();
            }}
          />
        </Group>
      </svg>

      {/* Tooltip — absolutely positioned dark div over the SVG.
          Hidden while dragging to pan (isDragging=true).
          Selection-aware: when a player is hovered or pinned, shows only those
          players with their ordinal rank at that snapshot. Otherwise shows the
          full tied-bucket standings (existing behaviour). */}
      {!isDragging && tooltipOpen && tooltipData && (() => {
        const tooltipStyle = {
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
        };

        const header = (
          <div style={{ color: '#94a3b8', marginBottom: 4 }}>
            {formatDate(tooltipData.snapDate)}
          </div>
        );

        // --- Selection-aware mode ---
        if (hasSpotlight && tooltipData.valueAtSnap) {
          // Build rank map: standard competition rank (ties share lowest rank in group).
          const allSorted = [...tooltipData.valueAtSnap.entries()].sort(
            (a, b) => b[1] - a[1],
          );
          const rankMap = new Map();
          for (let i = 0; i < allSorted.length; i++) {
            if (i === 0 || allSorted[i][1] < allSorted[i - 1][1]) {
              rankMap.set(allSorted[i][0], i + 1);
            } else {
              rankMap.set(allSorted[i][0], rankMap.get(allSorted[i - 1][0]));
            }
          }

          // Collect selected players (hovered ∪ pinned) that appear in this snapshot.
          const selectedHashes = new Set();
          if (hovered !== null && tooltipData.valueAtSnap.has(hovered)) selectedHashes.add(hovered);
          if (pinned instanceof Set) {
            for (const h of pinned) {
              if (tooltipData.valueAtSnap.has(h)) selectedHashes.add(h);
            }
          }

          // Fall back to the default standings view when no selected player has
          // a data point at this snapshot (avoids a blank/vanishing tooltip).
          if (!selectedHashes.size) {
            return (
              <div style={tooltipStyle}>
                {header}
                {tooltipData.sortedBuckets.map(([pts, names]) => (
                  <div key={pts}>
                    <strong style={{ color: '#fbbf24' }}>{pts}</strong>
                    {' — '}
                    {names.join(' · ')}
                  </div>
                ))}
              </div>
            );
          }

          // Build display rows with rank + color, sorted rank asc.
          const selectedRows = [...selectedHashes]
            .map((hash) => {
              const seriesEntry = series.find((s) => s.email_hash === hash);
              const total = tooltipData.valueAtSnap.get(hash);
              const rank = rankMap.get(hash) ?? 1;
              // Match the color that the line uses in the chart.
              let color;
              const isPinned = pinned instanceof Set && pinned.has(hash);
              if (isPinned) color = pinnedColors.get(hash) ?? SPOTLIGHT_COLOR;
              else if (hash === leader) color = LEADER_COLOR;
              else color = SPOTLIGHT_COLOR;
              return { hash, name: seriesEntry?.name ?? hash, total, rank, color };
            })
            .sort((a, b) => a.rank - b.rank);

          return (
            <div style={tooltipStyle}>
              {header}
              {selectedRows.map((row) => (
                <div key={row.hash}>
                  <span style={{ color: '#64748b' }}>{ordinal(row.rank)}</span>
                  {' · '}
                  <span style={{ color: row.color }}>{row.name}</span>
                  {' · '}
                  <strong style={{ color: '#fbbf24' }}>{row.total}</strong>
                </div>
              ))}
            </div>
          );
        }

        // --- Default mode: full tied-bucket standings ---
        return (
          <div style={tooltipStyle}>
            {header}
            {tooltipData.sortedBuckets.map(([pts, names]) => (
              <div key={pts}>
                <strong style={{ color: '#fbbf24' }}>{pts}</strong>
                {' — '}
                {names.join(' · ')}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
