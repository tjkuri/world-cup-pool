/**
 * series.js — data transforms for The Gap chart.
 * Ported from the old Nivo-based Gap component.
 */

/**
 * condenseDaily — keep only the LAST snapshot per local calendar day.
 * Snapshots are expected in chronological order (ascending t); the last
 * occurrence of each day naturally holds that day's end-of-day standings.
 *
 * Key format: local YYYY-MM-DD via toLocaleDateString('en-CA'), which outputs
 * that exact format natively across modern browsers and Node.js.
 *
 * Exported so it can be unit-tested independently of toSeries.
 */
export function condenseDaily(snapshots) {
  const dayMap = new Map(); // day-string → snapshot (last write wins)
  for (const snap of snapshots) {
    const day = new Date(snap.t).toLocaleDateString('en-CA'); // e.g. "2026-06-20"
    dayMap.set(day, snap);
  }
  return [...dayMap.values()];
}

/**
 * Transform history snapshot data into per-player series for the chart.
 * Each series is { email_hash, name, data: [{ x: Date, y: number }] }.
 *
 * Guards against missing/malformed history (returns [] if snapshots is not an array).
 * Snapshots are condensed to one per local calendar day (last of each day =
 * end-of-day standings), reducing ~118 raw snapshots to ~40 evenly-spaced points.
 */
export function toSeries(history) {
  if (!Array.isArray(history?.snapshots)) return [];
  // NOTE: assumes snapshots are in ascending chronological (t) order.
  // Condense to one snapshot per calendar day before building series.
  const condensed = condenseDaily(history.snapshots);
  const byEmail = new Map();
  for (const snap of condensed) {
    const xDate = new Date(snap.t);
    for (const s of snap.standings ?? []) {
      if (!byEmail.has(s.email_hash)) {
        byEmail.set(s.email_hash, { email_hash: s.email_hash, name: s.name, data: [] });
      }
      byEmail.get(s.email_hash).data.push({ x: xDate, y: s.total });
    }
  }
  return [...byEmail.values()];
}

/**
 * Return the email_hash of the current leader (highest total in the last snapshot),
 * or null if history is empty/malformed.
 */
export function leaderEmail(history) {
  if (!Array.isArray(history?.snapshots)) return null;
  const last = history.snapshots.at(-1)?.standings ?? [];
  return [...last].sort((a, b) => b.total - a.total)[0]?.email_hash ?? null;
}
