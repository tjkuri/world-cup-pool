// lib/phases.js
// Phase-band boundaries for the stats "Gap" chart: the earliest kickoff of each
// knockout round, derived from knockout.json (slots carry kickoff_iso).
const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'F'];

export function phaseBoundaries(knockout) {
  const out = [];
  for (const round of ROUND_ORDER) {
    const slots = knockout?.rounds?.[round] || [];
    const kicks = slots.map((s) => s.kickoff_iso).filter(Boolean).sort();
    if (kicks.length) out.push({ round, start: kicks[0] });
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}
