import { useMemo } from 'react';
import { ResponsiveNetwork } from '@nivo/network';
import { twinsGraph } from '../../../lib/twins.js';

// Mirror LiveCeiling's dark theme.
const DARK_THEME = {
  text: { fill: '#cbd5e1' },
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

// Node accent: a pleasant sky-blue readable on dark backgrounds.
const NODE_COLOR = '#38bdf8';

// @nivo/network v0.99 has no built-in label rendering (no `label` prop).
// We add a custom SVG layer that draws entrant names below each node.
// The layer receives ComputedNode[] with (x, y, size, data.name).
function LabelsLayer({ nodes }) {
  return (
    <g aria-hidden="true">
      {nodes.map((node) => (
        <text
          key={node.id}
          x={node.x}
          y={node.y + node.size / 2 + 11}
          textAnchor="middle"
          dominantBaseline="hanging"
          fill="#94a3b8"
          fontSize={10}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {node.data.name}
        </text>
      ))}
    </g>
  );
}

// nodeTooltip receives { node: ComputedNode<{ id, name }> }.
function NodeTooltip({ node }) {
  return (
    <div
      style={{
        background: '#0b1220',
        color: '#e2e8f0',
        border: '1px solid #334155',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 12,
      }}
    >
      {node.data.name}
    </div>
  );
}

export function BracketTwins({ submissions }) {
  const { nodes, links } = useMemo(
    () => twinsGraph(submissions || [], 2),
    [submissions],
  );

  if (nodes.length < 2) {
    return (
      <section>
        <h3 className="text-lg font-semibold mb-1">Bracket Twins</h3>
        <p className="text-sm text-slate-500">Not enough brackets yet.</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-lg font-semibold mb-1">Bracket Twins</h3>
      <p className="text-sm text-slate-400 mb-3">
        Closer + linked = more similar brackets; loners are the contrarians.
      </p>
      <div style={{ height: 460 }}>
        <ResponsiveNetwork
          data={{ nodes, links }}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          // linkDistance receives the raw InputLink, so l.distance is our computed value (30–150).
          linkDistance={(l) => l.distance}
          repulsivity={8}
          centeringStrength={0.05}
          iterations={120}
          nodeSize={12}
          activeNodeSize={16}
          inactiveNodeSize={10}
          nodeColor={NODE_COLOR}
          nodeBorderWidth={0}
          // linkThickness receives ComputedLink minus color/thickness; original fields live in l.data.
          linkThickness={(l) => 1 + l.data.similarity * 3}
          linkColor={{ from: 'source.color', modifiers: [['opacity', 0.35]] }}
          layers={['links', 'nodes', 'annotations', LabelsLayer]}
          nodeTooltip={NodeTooltip}
          theme={DARK_THEME}
          animate={true}
          motionConfig="gentle"
        />
      </div>
    </section>
  );
}
