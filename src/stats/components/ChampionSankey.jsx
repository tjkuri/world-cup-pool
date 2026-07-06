import { useMemo } from 'react';
import { ResponsiveSankey } from '@nivo/sankey';
import { advancementFlows } from '../../../lib/advancement.js';
import { teamName, teamFlag } from '../../shared/teamNames.js';

// Mirror LiveCeiling's dark theme — tooltip container uses the same bg + border.
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

// PropertyAccessor: receives Omit<SankeyNodeDatum, 'color'|'label'>, still has `id`.
function nodeLabel(node) {
  const code = node.id.split(':')[1];
  return `${teamFlag(code)} ${teamName(code)}`;
}

export function ChampionSankey({ submissions, knockout }) {
  const { nodes, links } = useMemo(
    () => advancementFlows(submissions || [], knockout),
    [submissions, knockout],
  );

  if (!links.length) {
    return (
      <section>
        <h2 className="text-lg font-semibold mb-1">Advancement Flow</h2>
        <p className="text-sm text-slate-500">No bracket data yet.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">Advancement Flow</h2>
      <p className="text-sm text-slate-400 mb-3">
        Ribbon width = number of brackets routing that team to the next round (R16 → QF → SF → Final → Champion).
      </p>
      <div style={{ height: 460 }}>
        <ResponsiveSankey
          data={{ nodes, links }}
          margin={{ top: 10, right: 180, bottom: 10, left: 180 }}
          align="justify"
          colors={{ scheme: 'category10' }}
          nodeOpacity={0.9}
          nodeHoverOpacity={1}
          nodeHoverOthersOpacity={0.35}
          nodeThickness={18}
          nodeSpacing={10}
          nodeBorderWidth={0}
          nodeBorderRadius={2}
          linkOpacity={0.45}
          linkHoverOpacity={0.75}
          linkHoverOthersOpacity={0.1}
          linkBlendMode="normal"
          enableLinkGradient={true}
          label={nodeLabel}
          labelPosition="outside"
          labelPadding={14}
          labelTextColor="#cbd5e1"
          theme={DARK_THEME}
          valueFormat=" >-d"
        />
      </div>
    </section>
  );
}
