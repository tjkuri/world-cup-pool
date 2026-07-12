import { useEffect, useMemo, useRef, useState } from 'react';
import { area, curveMonotoneX } from 'd3-shape';
import { teamRoundCounts } from '../../../lib/advancement.js';
import { teamName, teamFlag } from '../../shared/teamNames.js';

// Stage order, R16 → Champion. tc keys mirror teamRoundCounts output.
const STAGES = [
  { key: 'R16', label: 'R16' },
  { key: 'QF', label: 'QF' },
  { key: 'SF', label: 'SF' },
  { key: 'Final', label: 'Final' },
  { key: 'Champion', label: '🏆' },
];

// SVG geometry.
const HEIGHT = 340;
const LABEL_TOP_Y = 22; // stage labels row
const FUNNEL_TOP = 48;
const FUNNEL_BOTTOM = 296;
const CENTER_Y = (FUNNEL_TOP + FUNNEL_BOTTOM) / 2;
const MAX_BAR = FUNNEL_BOTTOM - FUNNEL_TOP;
const VALUE_Y = 322; // value labels row
const PAD_X = 44;
const DUR = 500;

// easeInOutCubic
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Default team: highest Champion count; tiebreak Final → SF → QF → R16 → name.
function pickDefault(teams, counts) {
  if (!teams.length) return null;
  return teams.reduce((best, code) => {
    if (!best) return code;
    const a = counts[code];
    const b = counts[best];
    for (const stage of ['Champion', 'Final', 'SF', 'QF', 'R16']) {
      if (a[stage] !== b[stage]) return a[stage] > b[stage] ? code : best;
    }
    return teamName(code) < teamName(best) ? code : best;
  }, null);
}

export function TeamAdvancement({ submissions, knockout }) {
  // All hooks MUST be called before any conditional return.
  const counts = useMemo(
    () => teamRoundCounts(submissions || [], knockout),
    [submissions, knockout],
  );

  // Teams with ≥1 bracket advancing to R16, sorted by display name.
  const teams = useMemo(
    () =>
      Object.keys(counts)
        .filter((code) => counts[code].R16 > 0)
        .sort((a, b) => teamName(a).localeCompare(teamName(b))),
    [counts],
  );

  // Global max = the biggest single-stage count across every team, so a
  // funnel's absolute size is comparable team-to-team (it grows/shrinks
  // on swap instead of always filling the height).
  const globalMax = useMemo(() => {
    let m = 1;
    for (const code of teams) {
      for (const s of STAGES) m = Math.max(m, counts[code][s.key]);
    }
    return m;
  }, [teams, counts]);

  const defaultTeam = useMemo(() => pickDefault(teams, counts), [teams, counts]);

  // null = "user hasn't chosen" → fall back to computed default.
  const [picked, setPicked] = useState(null);
  const team = picked ?? defaultTeam;
  const tc = counts[team] || { R16: 0, QF: 0, SF: 0, Final: 0, Champion: 0 };

  // Responsive width via ResizeObserver (mirrors ExactHistogram/GapPanel).
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Animated thickness values (one per stage), tweened frame-by-frame so a
  // team swap morphs the shape instead of jumping.
  const [displayed, setDisplayed] = useState([0, 0, 0, 0, 0]);
  const displayedRef = useRef([0, 0, 0, 0, 0]);
  const rafRef = useRef(0);
  const target = tc ? STAGES.map((s) => tc[s.key]) : [0, 0, 0, 0, 0];

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      displayedRef.current = target;
      setDisplayed(target);
      return;
    }
    const from = displayedRef.current.slice();
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DUR);
      const e = ease(t);
      const cur = target.map((v, i) => from[i] + (v - from[i]) * e);
      displayedRef.current = cur;
      setDisplayed(cur);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, target[0], target[1], target[2], target[3], target[4]]);

  // Empty-data guard — after all hooks.
  if (!teams.length) {
    return (
      <section>
        <h3 className="text-lg font-semibold mb-1">Team Advancement</h3>
        <p className="text-sm text-slate-500">No bracket data yet.</p>
      </section>
    );
  }

  const xs = STAGES.map(
    (_, i) => PAD_X + (i * (width - 2 * PAD_X)) / (STAGES.length - 1),
  );
  const pts = xs.map((x, i) => ({
    x,
    h: (displayed[i] / globalMax) * MAX_BAR,
  }));

  const bandPath = area()
    .x((d) => d.x)
    .y0((d) => CENTER_Y - d.h / 2)
    .y1((d) => CENTER_Y + d.h / 2)
    .curve(curveMonotoneX)(pts);

  const topLine = area()
    .x((d) => d.x)
    .y0((d) => CENTER_Y - d.h / 2)
    .y1((d) => CENTER_Y - d.h / 2)
    .curve(curveMonotoneX)(pts);

  return (
    <section>
      <h3 className="text-lg font-semibold mb-1">Team Advancement</h3>

      {/* Dropdown: dark slate-styled native <select> */}
      <div className="flex items-center gap-3 mb-2">
        <select
          className="bg-slate-800 border border-slate-600 text-slate-100 text-sm rounded px-2 py-1"
          value={team}
          onChange={(e) => setPicked(e.target.value)}
        >
          {teams.map((code) => (
            <option key={code} value={code}>
              {teamFlag(code)} {teamName(code)}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-slate-400 mb-3">
        How many brackets had {teamName(team)} reach each round. Funnel narrows
        R16 → 🏆.
      </p>

      <div ref={wrapRef} style={{ width: '100%' }}>
        <svg width={width} height={HEIGHT} role="img" aria-label={`${teamName(team)} advancement funnel`}>
          <defs>
            <linearGradient id="ta-fill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#065f46" />
            </linearGradient>
          </defs>

          {/* stage labels (top) + value labels (bottom) */}
          {STAGES.map((s, i) => (
            <text
              key={`lbl-${s.key}`}
              x={xs[i]}
              y={LABEL_TOP_Y}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={13}
              fontWeight={600}
            >
              {s.label}
            </text>
          ))}

          {/* funnel band */}
          <path d={bandPath} fill="url(#ta-fill)" fillOpacity={0.9} />
          <path d={topLine} fill="none" stroke="#5eead4" strokeWidth={1.5} strokeOpacity={0.5} />
          <path
            d={area()
              .x((d) => d.x)
              .y0((d) => CENTER_Y + d.h / 2)
              .y1((d) => CENTER_Y + d.h / 2)
              .curve(curveMonotoneX)(pts)}
            fill="none"
            stroke="#5eead4"
            strokeWidth={1.5}
            strokeOpacity={0.5}
          />

          {STAGES.map((s, i) => (
            <text
              key={`val-${s.key}`}
              x={xs[i]}
              y={VALUE_Y}
              textAnchor="middle"
              fill="#cbd5e1"
              fontSize={13}
            >
              {target[i]}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}
