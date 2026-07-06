import { useMemo, useState, useCallback, useRef } from 'react';
import { ResponsiveNetwork } from '@nivo/network';
import { twinsGraph, twinFor } from '../../../lib/twins.js';
import { scoreSubmission, scoreBracket } from '../../../lib/score.js';
import { teamName, teamFlag } from '../../shared/teamNames.js';

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

// Champion camp palette — readable on dark backgrounds, ordered by distinctness.
const CHAMPION_PALETTE = [
  '#38bdf8', // sky
  '#f472b6', // pink
  '#a3e635', // lime
  '#fb923c', // orange
  '#a78bfa', // violet
  '#22d3ee', // cyan
  '#facc15', // yellow
  '#f87171', // red
];

// nodeTooltip: receives { node: ComputedNode<enrichedNode> }.
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
      <strong>{node.data.name}</strong>
      {node.data.championCode && (
        <div style={{ marginTop: 2, color: '#94a3b8' }}>
          {teamFlag(node.data.championCode)} {teamName(node.data.championCode)} to win
        </div>
      )}
      {node.data.pts != null && (
        <div style={{ marginTop: 2, color: '#64748b' }}>{node.data.pts} pts</div>
      )}
    </div>
  );
}

export function BracketTwins({ submissions, fixtures, results, knockout }) {
  // ── All hooks unconditionally (hooks before any return) ──────────────────

  // Final bracket slot = the champion slot in the knockout tree.
  const finalSlot = knockout?.rounds?.F?.[0]?.slot;

  // Graph: nodes/links/similarity from twinsGraph (filters to phase=knockout).
  const { nodes, links, similarity } = useMemo(
    () => twinsGraph(submissions || []),
    [submissions],
  );

  // Champion pick per email_hash (reads bracket[finalSlot].advances).
  const championByHash = useMemo(() => {
    if (!finalSlot) return {};
    const map = {};
    for (const sub of submissions || []) {
      if (sub.phase !== 'knockout') continue;
      const champ = sub.picks?.bracket?.[finalSlot]?.advances;
      if (champ) map[sub.email_hash] = champ;
    }
    return map;
  }, [submissions, finalSlot]);

  // Total points per email_hash: group submission total + bracket total.
  // Group sub identified by phase !== 'knockout' with same email_hash.
  const pointsByHash = useMemo(() => {
    const map = {};
    if (!submissions || !fixtures || !results) return map;
    const groupSubByHash = {};
    for (const sub of submissions) {
      if (sub.phase !== 'knockout') groupSubByHash[sub.email_hash] = sub;
    }
    for (const sub of submissions) {
      if (sub.phase !== 'knockout') continue;
      const h = sub.email_hash;
      const groupSub = groupSubByHash[h];
      const groupTotal = groupSub
        ? (scoreSubmission(groupSub.picks, fixtures, results)?.total ?? 0)
        : 0;
      const bracketTotal = knockout
        ? (scoreBracket(sub.picks?.bracket, knockout, results)?.bracket_total ?? 0)
        : 0;
      map[h] = groupTotal + bracketTotal;
    }
    return map;
  }, [submissions, fixtures, results, knockout]);

  // Champion color map: most-picked first → palette[0], etc.
  const { championColorMap, sortedChampions } = useMemo(() => {
    const freq = {};
    for (const code of Object.values(championByHash)) {
      freq[code] = (freq[code] || 0) + 1;
    }
    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => code);
    const colorMap = {};
    sorted.forEach((code, i) => {
      colorMap[code] = CHAMPION_PALETTE[i] ?? '#64748b';
    });
    return { championColorMap: colorMap, sortedChampions: sorted };
  }, [championByHash]);

  // Enrich input nodes with stable visual data (no selection dependency).
  // nodeSize + nodeColor functions read from these fields, keeping data stable
  // so @nivo/network doesn't re-run the force simulation on selection changes.
  const enrichedNodes = useMemo(() => {
    const allPts = nodes.map((n) => pointsByHash[n.id] ?? 0);
    const min = allPts.length ? Math.min(...allPts) : 0;
    const max = allPts.length ? Math.max(...allPts) : 0;
    return nodes.map((n) => ({
      ...n,
      championCode: championByHash[n.id] ?? null,
      baseColor: championColorMap[championByHash[n.id]] ?? '#64748b',
      pts: pointsByHash[n.id] ?? 0,
      size: 8 + 16 * ((pointsByHash[n.id] ?? 0) - min) / (max - min || 1),
    }));
  }, [nodes, pointsByHash, championByHash, championColorMap]);

  // name → hash map for twinFor callout.
  const nameByHash = useMemo(() => {
    const m = {};
    for (const n of nodes) m[n.id] = n.name;
    return m;
  }, [nodes]);

  // Selection state (null = nothing selected).
  const [selected, setSelected] = useState(null);

  // Set of neighbor IDs (nodes sharing a link with the selected node).
  const neighborSet = useMemo(() => {
    if (!selected) return new Set();
    const s = new Set();
    for (const l of links) {
      if (l.source === selected) s.add(l.target);
      if (l.target === selected) s.add(l.source);
    }
    return s;
  }, [selected, links]);

  // Callout data: the selected node + its twin/evil-twin from similarity map.
  const callout = useMemo(() => {
    if (!selected) return null;
    const node = enrichedNodes.find((n) => n.id === selected);
    if (!node) return null;
    const { twin, evil } = twinFor(selected, similarity, nameByHash);
    return { node, twin, evil };
  }, [selected, enrichedNodes, similarity, nameByHash]);

  // Ref used by the stable custom layer to read current selection without
  // invalidating the layer function reference (which would cause nivo to
  // unmount + remount the layer component, resetting spring animations).
  const layerState = useRef({ selected: null, neighborSet: new Set() });
  layerState.current = { selected, neighborSet };

  // Stable custom labels layer — created once, reads from ref on each render.
  // nivo re-renders this when nodeColor prop changes (see nodeColor below),
  // which is the mechanism that propagates selection → label dimming.
  const LabelsLayer = useMemo(() => {
    function LabelsAndDim({ nodes: computedNodes }) {
      const { selected: sel, neighborSet: nbrs } = layerState.current;
      return (
        <g aria-hidden="true">
          {computedNodes.map((node) => {
            const dimmed = sel && node.id !== sel && !nbrs.has(node.id);
            return (
              <text
                key={node.id}
                x={node.x}
                y={node.y + node.size / 2 + 11}
                textAnchor="middle"
                dominantBaseline="hanging"
                fill={dimmed ? '#334155' : '#94a3b8'}
                fontSize={10}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {node.data.name}
              </text>
            );
          })}
        </g>
      );
    }
    LabelsAndDim.displayName = 'LabelsAndDim';
    return LabelsAndDim;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally stable — reads selection from layerState ref.

  // nodeColor: champion color when selected/neighbor, '#1e293b' when dimmed.
  // useCallback with [selected, neighborSet] deps means the function reference
  // changes on selection → nivo picks up the new prop → recomputes node colors
  // WITHOUT re-running the force simulation (simulation only re-runs on data change).
  const nodeColor = useCallback(
    (n) => {
      if (!selected) return n.baseColor;
      if (n.id === selected || neighborSet.has(n.id)) return n.baseColor;
      return '#1e293b';
    },
    [selected, neighborSet],
  );

  // nodeSize: stable function reading from baked-in node data.
  const nodeSize = useCallback((n) => n.size, []);

  // linkColor: dims non-incident links when something is selected.
  // InheritedColorConfig accepts a plain (datum) => string function where datum
  // is ComputedLink<Node,Link> minus color/thickness — includes source/target nodes.
  const linkColor = useCallback(
    (link) => {
      if (!selected) return 'rgba(148,163,184,0.3)';
      const incident =
        link.source.id === selected || link.target.id === selected;
      return incident ? 'rgba(148,163,184,0.55)' : 'rgba(15,23,42,0.2)';
    },
    [selected],
  );

  // Click handler: toggle selection.
  const handleClick = useCallback((node) => {
    setSelected((s) => (s === node.id ? null : node.id));
  }, []);

  // ── Conditional return after all hooks ──────────────────────────────────

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
        Color = champion pick · Size = total points · Click a dot to find your twin
      </p>

      {/* Twin / evil-twin callout — appears above the graph when a node is selected */}
      {callout && (
        <div className="relative mb-3 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm">
          <button
            onClick={() => setSelected(null)}
            className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 leading-none"
            aria-label="Clear selection"
          >
            ✕
          </button>
          <div className="font-semibold text-slate-100 mb-1">
            {callout.node.name}
            {callout.node.championCode && (
              <span className="ml-2 font-normal text-slate-400">
                {teamFlag(callout.node.championCode)}{' '}
                {teamName(callout.node.championCode)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-300">
            {callout.twin && (
              <span>
                <span className="text-slate-500">Twin </span>
                <span className="font-medium">{callout.twin.name}</span>
                <span className="text-slate-500">
                  {' '}
                  ({Math.round(callout.twin.similarity * 100)}% same)
                </span>
              </span>
            )}
            {callout.evil && (
              <span>
                <span className="text-slate-500">Evil twin </span>
                <span className="font-medium">{callout.evil.name}</span>
                <span className="text-slate-500">
                  {' '}
                  ({Math.round(callout.evil.similarity * 100)}% same)
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Network graph */}
      <div style={{ height: 460 }}>
        <ResponsiveNetwork
          data={{ nodes: enrichedNodes, links }}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          // linkDistance receives InputLink (raw); our links carry .distance.
          linkDistance={(l) => l.distance}
          repulsivity={8}
          centeringStrength={0.05}
          iterations={120}
          nodeSize={nodeSize}
          activeNodeSize={(n) => n.size + 4}
          inactiveNodeSize={(n) => n.size}
          nodeColor={nodeColor}
          nodeBorderWidth={0}
          // linkThickness receives ComputedLink (minus color/thickness); raw data at .data.
          linkThickness={(l) => 1 + l.data.similarity * 3}
          linkColor={linkColor}
          layers={['links', 'nodes', 'annotations', LabelsLayer]}
          nodeTooltip={NodeTooltip}
          onClick={handleClick}
          theme={DARK_THEME}
          animate={true}
          motionConfig="gentle"
        />
      </div>

      {/* Champion color legend */}
      {sortedChampions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {sortedChampions.map((code) => (
            <div key={code} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span
                style={{
                  background: championColorMap[code],
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {teamFlag(code)} {teamName(code)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
