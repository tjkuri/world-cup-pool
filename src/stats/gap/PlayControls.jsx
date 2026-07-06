/**
 * PlayControls.jsx — play/pause button + scrubber for the Gap animate mode.
 *
 * Props:
 *   index         number        current playback position (0-based)
 *   playing       boolean       true while animation is running
 *   count         number        total snapshot count
 *   onToggle      () => void    play/pause toggle handler
 *   onSeek        (i) => void   called when scrubber changes
 *   snapshotDate  Date | null   date at current index (for the label)
 */
import { timeFormat } from 'd3-time-format';

const fmt = timeFormat('%b %-d');

export function PlayControls({ index, playing, count, onToggle, onSeek, snapshotDate }) {
  const disabled = count <= 1;

  return (
    <div
      className="flex items-center gap-2"
      style={{
        padding: '4px 0 8px',
        color: '#94a3b8',
        userSelect: 'none',
      }}
    >
      {/* Play / Pause */}
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        title={playing ? 'Pause' : 'Play animation'}
        style={{
          background: 'rgba(15,23,42,0.88)',
          border: '1px solid #334155',
          borderRadius: 4,
          color: disabled ? '#475569' : '#94a3b8',
          fontSize: 12,
          padding: '3px 10px',
          cursor: disabled ? 'default' : 'pointer',
          lineHeight: 1.5,
          flexShrink: 0,
          minWidth: 42,
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={Math.max(0, count - 1)}
        value={index}
        disabled={disabled}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#38bdf8', cursor: disabled ? 'default' : 'pointer' }}
        aria-label="Playback position"
      />

      {/* Date label */}
      <span
        style={{
          fontSize: 11,
          flexShrink: 0,
          minWidth: 48,
          textAlign: 'right',
          color: '#64748b',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {snapshotDate ? fmt(snapshotDate) : '—'}
      </span>
    </div>
  );
}
