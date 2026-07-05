/**
 * GapLegend.jsx — scrollable player list for The Gap chart.
 * Hovering a row spotlights that player's line; clicking pins/unpins it for
 * multi-player comparison.  Sorted by current total (last snapshot y) desc.
 *
 * Props:
 *   series        [{ email_hash, name, data: [{x, y}] }]
 *   leader        email_hash | null  — shown in gold
 *   hovered       email_hash | null
 *   pinned        Set<email_hash>
 *   onHover       (email_hash | null) => void
 *   onTogglePin   (email_hash) => void
 */
import { useMemo } from 'react';

const LEADER_COLOR = '#fbbf24'; // amber-400
const SPOTLIGHT_COLOR = '#94a3b8'; // slate-400 — active non-leader
const DEFAULT_COLOR = '#334155'; // slate-700 — idle

/** Stable empty Map to use as default for pinnedColors prop. */
const EMPTY_MAP = new Map();

/**
 * swatchColor — returns the dot/swatch color for a legend row.
 * Priority: pinned (palette color) > leader (gold) > active (slate) > idle.
 */
function swatchColor(emailHash, leader, isActive, isPinned, pinnedColors) {
  if (isPinned) return pinnedColors.get(emailHash) ?? SPOTLIGHT_COLOR;
  if (emailHash === leader) return LEADER_COLOR;
  return isActive ? SPOTLIGHT_COLOR : DEFAULT_COLOR;
}

export function GapLegend({ series, leader, hovered, pinned, pinnedColors = EMPTY_MAP, onHover, onTogglePin }) {
  const hasSpotlight = hovered !== null || (pinned instanceof Set && pinned.size > 0);

  // Sort by current total desc; break ties by name.
  const sorted = useMemo(
    () =>
      [...series].sort((a, b) => {
        const ay = a.data.at(-1)?.y ?? 0;
        const by = b.data.at(-1)?.y ?? 0;
        return by - ay || a.name.localeCompare(b.name);
      }),
    [series],
  );

  if (!sorted.length) return null;

  return (
    <div
      className="flex flex-col gap-px overflow-y-auto pr-0.5"
      style={{ maxHeight: 380 }}
    >
      {sorted.map((s) => {
        const isPinned = pinned instanceof Set && pinned.has(s.email_hash);
        const isHovered = hovered === s.email_hash;
        const isActive = isHovered || isPinned;
        const currentTotal = s.data.at(-1)?.y ?? 0;
        const swatch = swatchColor(s.email_hash, leader, isActive, isPinned, pinnedColors);

        return (
          <button
            key={s.email_hash}
            type="button"
            onMouseEnter={() => onHover(s.email_hash)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onTogglePin(s.email_hash)}
            title={isPinned ? `Unpin ${s.name}` : `Pin ${s.name}`}
            className={[
              'flex items-center gap-1.5 px-2 py-[3px] rounded text-left w-full',
              'transition-colors duration-75 cursor-pointer select-none',
              isActive
                ? 'bg-slate-700/60'
                : hasSpotlight
                  ? 'opacity-30'
                  : 'hover:bg-slate-800/40',
              isPinned ? 'ring-1 ring-inset ring-slate-500/60' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {/* Colour swatch */}
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: swatch,
                flexShrink: 0,
                boxShadow: isActive ? `0 0 4px ${swatch}` : 'none',
              }}
            />

            {/* Name */}
            <span
              className={[
                'truncate text-[11px] flex-1',
                isActive ? 'text-slate-100' : 'text-slate-300',
              ].join(' ')}
            >
              {s.name}
            </span>

            {/* Current total */}
            <span
              className={[
                'text-[10px] tabular-nums flex-shrink-0 ml-0.5',
                isActive ? 'text-slate-300' : 'text-slate-600',
              ].join(' ')}
            >
              {currentTotal}
            </span>
          </button>
        );
      })}
    </div>
  );
}
