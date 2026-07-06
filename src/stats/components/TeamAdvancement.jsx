import { useMemo, useState } from 'react';
import { ResponsiveFunnel } from '@nivo/funnel';
import { teamRoundCounts } from '../../../lib/advancement.js';
import { teamName, teamFlag } from '../../shared/teamNames.js';

// Mirror LiveCeiling's dark theme — tooltip container bg + text.
const DARK_THEME = {
  text: { fill: '#cbd5e1' },
  axis: { ticks: { text: { fill: '#94a3b8' } } },
  tooltip: {
    container: {
      background: '#0b1220',
      color: '#e2e8f0',
      border: '1px solid #334155',
      fontSize: 12,
      borderRadius: 6,
    },
  },
};

// Teal/emerald hues — 5 stages, darkens toward Champion.
// OrdinalColorScaleConfigCustomColors = string[] is supported by @nivo/colors.
const TEAL_COLORS = ['#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#065f46'];

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

  const defaultTeam = useMemo(() => pickDefault(teams, counts), [teams, counts]);

  // null = "user hasn't chosen" → fall back to computed default.
  const [picked, setPicked] = useState(null);
  const team = picked ?? defaultTeam;

  // Empty-data guard — after all hooks.
  if (!teams.length) {
    return (
      <section>
        <h3 className="text-lg font-semibold mb-1">Team Advancement</h3>
        <p className="text-sm text-slate-500">No bracket data yet.</p>
      </section>
    );
  }

  const tc = counts[team] || { R16: 0, QF: 0, SF: 0, Final: 0, Champion: 0 };

  // @nivo/funnel data shape: { id: string|number, value: number, label?: string }
  // Stages with value 0 render as zero-width parts (thin slivers); acceptable.
  const funnelData = [
    { id: 'R16',      label: 'R16',   value: tc.R16 },
    { id: 'QF',       label: 'QF',    value: tc.QF },
    { id: 'SF',       label: 'SF',    value: tc.SF },
    { id: 'Final',    label: 'Final', value: tc.Final },
    { id: 'Champion', label: '🏆',    value: tc.Champion },
  ];

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
        How many brackets had {teamName(team)} reach each round. Funnel narrows R16 → 🏆.
      </p>

      {/* height: 340px; ResponsiveFunnel fills its container. */}
      <div style={{ height: 340 }}>
        <ResponsiveFunnel
          data={funnelData}
          direction="horizontal"
          colors={TEAL_COLORS}
          labelColor="#cbd5e1"
          valueFormat={(v) => `${v} bracket${v === 1 ? '' : 's'}`}
          theme={DARK_THEME}
          enableLabel={true}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          spacing={4}
          shapeBlending={0.66}
          borderWidth={0}
          fillOpacity={0.85}
        />
      </div>
    </section>
  );
}
