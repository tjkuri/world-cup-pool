/**
 * series.js — data transforms for The Gap chart.
 * Ported from the old Nivo-based Gap component.
 */

/**
 * Transform history snapshot data into per-player series for the chart.
 * Each series is { email_hash, name, data: [{ x: Date, y: number }] }.
 *
 * Guards against missing/malformed history (returns [] if snapshots is not an array).
 */
export function toSeries(history) {
  if (!Array.isArray(history?.snapshots)) return [];
  const byEmail = new Map();
  for (const snap of history.snapshots) {
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
