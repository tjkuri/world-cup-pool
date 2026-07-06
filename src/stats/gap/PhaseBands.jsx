/**
 * PhaseBands.jsx — shaded, labeled background regions for tournament phases.
 * Renders one <rect> per phase (Group → R32 → R16 → QF → SF → Final) behind
 * the Gap lines, plus a subtle vertical divider line at each phase boundary.
 *
 * Props:
 *   boundaries   [{ round: 'R32'|'R16'|'QF'|'SF'|'F', start: ISO }]
 *                  from phaseBoundaries(knockout). Group is implicit.
 *   xScale       visx/d3 scaleTime instance (same as GapChart uses).
 *   innerWidth   number  — plot width in px (right edge of the clamped area).
 *   innerHeight  number  — plot height in px.
 */

const FILL_A = 'rgba(148,163,184,0.05)';
const FILL_B = 'rgba(148,163,184,0.10)';
const DIVIDER_STROKE = 'rgba(148,163,184,0.25)';
const LABEL_COLOR = '#64748b';
const LABEL_FONT_SIZE = 10;
const LABEL_Y = 12;          // px from top of the plot area
const LABEL_MIN_WIDTH = 28;  // skip label when band is narrower than this

const PHASE_LABELS = {
  Group: 'Group',
  R32: 'R32',
  R16: 'R16',
  QF: 'QF',
  SF: 'SF',
  F: 'Final',
};

export function PhaseBands({ boundaries, xScale, innerWidth, innerHeight }) {
  if (!boundaries || boundaries.length === 0) return null;

  // Build ordered list of phases: Group is implicit at the domain start.
  // The Group band starts at x=0 (domain left edge).
  const phases = [
    { round: 'Group', startDate: xScale.domain()[0] },
    ...boundaries.map((b) => ({ round: b.round, startDate: new Date(b.start) })),
  ];

  // Build segments: each segment spans from its phase's start to the next phase's start
  // (or to innerWidth for the last phase).
  const segments = phases.map((phase, i) => {
    const nextPhase = phases[i + 1];

    // Raw x positions (may fall outside [0, innerWidth] when zoom is in play).
    const x0Raw = i === 0 ? 0 : (xScale(phase.startDate) ?? 0);
    const x1Raw = nextPhase ? (xScale(nextPhase.startDate) ?? innerWidth) : innerWidth;

    // Clamp to [0, innerWidth] so bands never overflow the plot.
    const x0 = Math.max(0, Math.min(innerWidth, x0Raw));
    const x1 = Math.max(0, Math.min(innerWidth, x1Raw));

    // Show divider only when the boundary's raw x falls strictly inside the visible domain.
    const showDivider = i > 0 && x0Raw > 0 && x0Raw < innerWidth;

    return { round: phase.round, x0, x1, width: x1 - x0, showDivider };
  });

  return (
    <g aria-hidden="true">
      {segments.map((seg, i) => (
        <g key={seg.round}>
          {/* Phase fill — alternating subtle tints */}
          {seg.width > 0 && (
            <rect
              x={seg.x0}
              y={0}
              width={seg.width}
              height={innerHeight}
              fill={i % 2 === 0 ? FILL_A : FILL_B}
            />
          )}

          {/* Vertical divider line at the start of each non-Group phase */}
          {seg.showDivider && (
            <line
              x1={seg.x0}
              x2={seg.x0}
              y1={0}
              y2={innerHeight}
              stroke={DIVIDER_STROKE}
              strokeWidth={1}
            />
          )}

          {/* Phase label — centered in the band; omitted when band is too narrow */}
          {seg.width >= LABEL_MIN_WIDTH && (
            <text
              x={seg.x0 + seg.width / 2}
              y={LABEL_Y}
              textAnchor="middle"
              fill={LABEL_COLOR}
              fontSize={LABEL_FONT_SIZE}
              fontFamily="inherit"
              pointerEvents="none"
            >
              {PHASE_LABELS[seg.round] ?? seg.round}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}
