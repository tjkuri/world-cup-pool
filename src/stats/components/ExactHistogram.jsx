/**
 * ExactHistogram.jsx — visx shaded density curve for exact-score distribution.
 * Replaced @nivo/bar histogram with a smooth AreaClosed + LinePath on @visx.
 *
 * Data: exactCountHistogram → [{ exact: 0, players: N }, { exact: 1, players: M }, …]
 * x = exact count (integer), y = number of players who hit that count.
 */
import { useMemo, useRef, useEffect, useState, useId } from 'react';
import { Group } from '@visx/group';
import { AreaClosed, LinePath } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleLinear } from '@visx/scale';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip } from '@visx/tooltip';
import { exactCountHistogram } from '../../../lib/distributions.js';

const MARGIN = { top: 20, right: 20, bottom: 52, left: 50 };
const CHART_HEIGHT = 280;
const TICK_COLOR = '#94a3b8';
const GRID_COLOR = '#1e293b';
const ACCENT = '#34d399'; // emerald-400

/** Mirror the responsive-width hook from GapPanel. */
function useContainerWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    obs.observe(ref.current);
    setWidth(ref.current.getBoundingClientRect().width);
    return () => obs.disconnect();
  }, [ref]);
  return width;
}

export function ExactHistogram({ submissions, fixtures, results, knockout }) {
  const data = useMemo(
    () => exactCountHistogram(submissions || [], fixtures, results, knockout),
    [submissions, fixtures, results, knockout],
  );

  const containerRef = useRef(null);
  const width = useContainerWidth(containerRef);

  const { tooltipOpen, tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } =
    useTooltip();

  // Stable gradient id — no collision across multiple chart instances.
  const uid = useId();
  const gradientId = `exact-grad-${uid.replace(/:/g, '')}`;

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, CHART_HEIGHT - MARGIN.top - MARGIN.bottom);

  const maxExact = data.length ? data[data.length - 1].exact : 0;
  const maxPlayers = data.length ? Math.max(...data.map((d) => d.players), 1) : 1;

  const xScale = useMemo(
    () => scaleLinear({ domain: [0, Math.max(maxExact, 1)], range: [0, innerWidth] }),
    [maxExact, innerWidth],
  );
  const yScale = useMemo(
    () => scaleLinear({ domain: [0, maxPlayers], range: [innerHeight, 0] }),
    [maxPlayers, innerHeight],
  );

  const getX = (d) => xScale(d.exact) ?? 0;
  const getY = (d) => yScale(d.players) ?? 0;

  // Integer-only y ticks (player counts are whole numbers).
  const yTicks = useMemo(
    () => yScale.ticks(5).filter((v) => Number.isInteger(v)),
    [yScale],
  );

  // Nearest-bucket lookup: maps mouse x → closest data point.
  const handleMouseMove = (event) => {
    if (!containerRef.current || !data.length) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - MARGIN.left;
    const exactVal = xScale.invert(mouseX);
    const nearest = data.reduce(
      (best, d) =>
        Math.abs(d.exact - exactVal) < Math.abs(best.exact - exactVal) ? d : best,
      data[0],
    );
    showTooltip({
      tooltipData: nearest,
      // Tooltip position relative to the container div.
      tooltipLeft: xScale(nearest.exact) + MARGIN.left,
      tooltipTop: yScale(nearest.players) + MARGIN.top,
    });
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!data.length) {
    return (
      <section>
        <h3 className="text-lg font-semibold mb-1">Exact-Score Distribution</h3>
        <p className="text-sm text-slate-400">
          How many players nailed N exact scorelines (whole tournament).
        </p>
        <p className="text-sm text-slate-500 mt-4">No exact-score data yet.</p>
      </section>
    );
  }

  // ── Chart ─────────────────────────────────────────────────────────────────
  return (
    <section>
      <h3 className="text-lg font-semibold mb-1">Exact-Score Distribution</h3>
      <p className="text-sm text-slate-400 mb-3">
        How many players nailed N exact scorelines (whole tournament).
      </p>

      {/* Responsive container — measured by ResizeObserver */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: CHART_HEIGHT, position: 'relative' }}
      >
        {width > 0 && innerWidth > 0 && (
          <>
            <svg width={width} height={CHART_HEIGHT}>
              <defs>
                {/* Vertical gradient: emerald at top → transparent at bottom */}
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>

              <Group left={MARGIN.left} top={MARGIN.top}>
                {/* Subtle horizontal grid */}
                {yTicks.map((tick) => (
                  <line
                    key={tick}
                    x1={0}
                    x2={innerWidth}
                    y1={yScale(tick)}
                    y2={yScale(tick)}
                    stroke={GRID_COLOR}
                    strokeWidth={1}
                  />
                ))}

                {/* Shaded area under the curve (closes to yScale baseline) */}
                <AreaClosed
                  data={data}
                  x={getX}
                  y={getY}
                  yScale={yScale}
                  curve={curveMonotoneX}
                  fill={`url(#${gradientId})`}
                />

                {/* Curve stroke on top of shading */}
                <LinePath
                  data={data}
                  x={getX}
                  y={getY}
                  curve={curveMonotoneX}
                  stroke={ACCENT}
                  strokeWidth={2}
                  fill="none"
                />

                {/* Small circles at each discrete integer bucket */}
                {data.map((d) => (
                  <circle
                    key={d.exact}
                    cx={getX(d)}
                    cy={getY(d)}
                    r={4}
                    fill={ACCENT}
                    stroke="#0f172a"
                    strokeWidth={1.5}
                    pointerEvents="none"
                  />
                ))}

                {/* Vertical crosshair at hovered bucket */}
                {tooltipOpen && tooltipData && (
                  <line
                    x1={xScale(tooltipData.exact)}
                    x2={xScale(tooltipData.exact)}
                    y1={0}
                    y2={innerHeight}
                    stroke={TICK_COLOR}
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    pointerEvents="none"
                  />
                )}

                {/* X axis — ticks only at actual bucket positions */}
                <AxisBottom
                  scale={xScale}
                  top={innerHeight}
                  tickValues={data.map((d) => d.exact)}
                  label="exact scores nailed"
                  labelProps={{
                    fill: TICK_COLOR,
                    fontSize: 11,
                    fontFamily: 'inherit',
                    textAnchor: 'middle',
                  }}
                  labelOffset={30}
                  stroke={GRID_COLOR}
                  tickStroke={GRID_COLOR}
                  tickLabelProps={{
                    fill: TICK_COLOR,
                    fontSize: 11,
                    fontFamily: 'inherit',
                    textAnchor: 'middle',
                  }}
                />

                {/* Y axis — whole-number player counts */}
                <AxisLeft
                  scale={yScale}
                  label="players"
                  labelProps={{
                    fill: TICK_COLOR,
                    fontSize: 11,
                    fontFamily: 'inherit',
                    textAnchor: 'middle',
                  }}
                  labelOffset={36}
                  numTicks={5}
                  tickFormat={(v) => (Number.isInteger(v) ? `${v}` : '')}
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

                {/* Transparent interaction surface — topmost, captures hover */}
                <rect
                  x={0}
                  y={0}
                  width={innerWidth}
                  height={innerHeight}
                  fill="transparent"
                  style={{ cursor: 'crosshair' }}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={hideTooltip}
                />
              </Group>
            </svg>

            {/* Dark tooltip — absolute over the SVG container */}
            {tooltipOpen && tooltipData && (
              <div
                style={{
                  position: 'absolute',
                  left: Math.min(tooltipLeft + 10, width - 180),
                  top: Math.max(tooltipTop - 30, 4),
                  background: '#0b1220',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 12,
                  color: '#e2e8f0',
                  pointerEvents: 'none',
                  zIndex: 10,
                  whiteSpace: 'nowrap',
                }}
              >
                <strong>{tooltipData.exact}</strong> exact →{' '}
                <strong>{tooltipData.players}</strong>{' '}
                player{tooltipData.players !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
