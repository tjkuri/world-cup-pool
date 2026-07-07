import { useMemo, useState, useCallback } from 'react';
import { ResponsiveCirclePacking } from '@nivo/circle-packing';
import { twinsGraph, twinFor } from '../../../lib/twins.js';
import { scoreSubmission, scoreBracket } from '../../../lib/score.js';
import { teamName, teamFlag } from '../../shared/teamNames.js';

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

// Stable filter: show labels only on leaf nodes (entrants), not champion group circles.
// Defined at module level so its reference never changes → nivo skips the memo re-run.
const LEAF_ONLY_LABELS = (l) => l.node.height === 0;

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Tooltip component — receives the ComputedDatum object as props.
// OrdinalColorScaleConfig<ComputedDatum> means tooltip(props: ComputedDatum) => JSX.Element.
function CircleTooltip({ depth, height, data }) {
  if (depth === 0) return null; // root circle — no tooltip
  const isLeaf = height === 0;
  return (
    <div
      style={{
        background: '#0b1220',
        color: '#e2e8f0',
        border: '1px solid #334155',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {isLeaf ? (
        <>
          <strong style={{ display: 'block' }}>{data.name}</strong>
          {data.champion && (
            <span style={{ color: '#94a3b8' }}>
              {teamFlag(data.champion)} {teamName(data.champion)} to win
            </span>
          )}
          <span style={{ color: '#64748b', marginLeft: data.champion ? 8 : 0 }}>
            {data.value} pts
          </span>
        </>
      ) : (
        <strong>
          {data.champion
            ? `${teamFlag(data.champion)} ${data.name}`
            : data.name}
        </strong>
      )}
    </div>
  );
}

export function BracketTwins({ submissions, fixtures, results, knockout }) {
  // ── All hooks unconditionally (hooks before any return) ──────────────────

  // Final bracket slot = the champion slot in the knockout tree.
  const finalSlot = knockout?.rounds?.F?.[0]?.slot;

  // Similarity map + node list from twinsGraph (filters to phase=knockout).
  // We no longer need `links` — circle-packing is position-based, not link-based.
  const { nodes, similarity } = useMemo(
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

  // Champion color map: most-picked camp first → palette[0], etc.
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

  // name → hash map for twinFor callout.
  const nameByHash = useMemo(() => {
    const m = {};
    for (const n of nodes) m[n.id] = n.name;
    return m;
  }, [nodes]);

  // Build the d3-hierarchy-compatible data tree:
  //   root → [champion group circles] → [entrant leaf bubbles]
  // Champion groups ordered by camp size desc; entrant value = total points.
  // Math.max(..., 1) so 0-point entrants still render a small bubble.
  const hierarchyData = useMemo(() => {
    const campsByChamp = {};
    for (const n of nodes) {
      const champ = championByHash[n.id] ?? '__none__';
      if (!campsByChamp[champ]) campsByChamp[champ] = [];
      campsByChamp[champ].push({
        id: n.id,
        champion: champ === '__none__' ? null : champ,
        name: n.name,
        value: Math.max(pointsByHash[n.id] ?? 0, 1),
      });
    }
    const champEntries = Object.entries(campsByChamp).sort(
      (a, b) => b[1].length - a[1].length,
    );
    return {
      id: 'root',
      children: champEntries.map(([champ, members]) => ({
        id: `champ_${champ}`,
        champion: champ === '__none__' ? null : champ,
        name: champ === '__none__' ? 'No pick' : teamName(champ),
        children: members,
      })),
    };
  }, [nodes, championByHash, pointsByHash]);

  // Selection state (null = nothing selected; non-null = an email_hash).
  const [selected, setSelected] = useState(null);

  // Callout data for the twin/evil-twin panel.
  const callout = useMemo(() => {
    if (!selected) return null;
    const n = nodes.find((nd) => nd.id === selected);
    if (!n) return null;
    const { twin, evil } = twinFor(selected, similarity, nameByHash);
    return {
      name: n.name,
      champion: championByHash[selected] ?? null,
      twin,
      evil,
    };
  }, [selected, nodes, similarity, nameByHash, championByHash]);

  // colors: OrdinalColorScaleConfig supports a plain function — nivo/colors returns it
  // directly from useOrdinalColorScale when typeof config === 'function', so this IS
  // called per node. Receives ComputedDatum (minus color/fill).
  // Depth 0 = root (blend to bg), depth 1 = champion group (faint tint), depth 2 = leaf.
  const colorFn = useMemo(
    () => (node) => {
      if (node.depth === 0) return '#0b1220'; // root: paint over with bg → invisible
      const champ = node.data.champion;
      const base = champ ? (championColorMap[champ] ?? '#475569') : '#475569';
      if (node.depth === 1) {
        // Champion group container: faint tint so grouping reads without overpowering leaves.
        return hexToRgba(base, 0.15);
      }
      // Leaf (entrant bubble)
      if (selected) {
        const isSelected = node.data.id === selected;
        if (isSelected) return base;
        const selectedChamp = championByHash[selected];
        // Same-camp peers: partial dim; out-of-camp: strong dim.
        return hexToRgba(base, champ === selectedChamp ? 0.45 : 0.18);
      }
      return base;
    },
    [championColorMap, selected, championByHash],
  );

  // borderColor: InheritedColorConfig also supports plain functions (nivo/colors
  // getInheritedColorGenerator returns the function directly when typeof config === 'function').
  // White ring on selected leaf; champion-tinted stroke on group circles; transparent elsewhere.
  const borderColorFn = useMemo(
    () => (node) => {
      if (node.depth === 0) return 'transparent';
      if (node.height === 0 && node.data.id === selected) return '#ffffff';
      if (node.depth === 1) {
        const champ = node.data.champion;
        const base = champ ? (championColorMap[champ] ?? '#334155') : '#334155';
        return hexToRgba(base, 0.5);
      }
      return 'transparent';
    },
    [selected, championColorMap],
  );

  // labelTextColor: same InheritedColorConfig function support.
  // Dim non-selected leaf labels when something is selected.
  const labelTextColorFn = useMemo(
    () => (node) => {
      if (selected && node.height === 0 && node.data.id !== selected) {
        return '#334155'; // dimmed
      }
      return '#94a3b8';
    },
    [selected],
  );

  // Click handler: toggle selection on leaf nodes (height === 0).
  // onClick signature from nivo: (datum: ComputedDatum, event: MouseEvent) => void.
  const handleClick = useCallback((node) => {
    if (node.height === 0) {
      setSelected((s) => (s === node.data.id ? null : node.data.id));
    }
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
        Grouped by champion pick · bubble size = total points · click a bubble to find your twin
      </p>

      {/* Twin / evil-twin callout — appears above the chart when a bubble is clicked */}
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
            {callout.name}
            {callout.champion && (
              <span className="ml-2 font-normal text-slate-400">
                {teamFlag(callout.champion)}{' '}
                {teamName(callout.champion)}
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

      {/* Circle-packing chart: deterministic layout, always fits, no clipping possible */}
      <div style={{ height: 520 }}>
        <ResponsiveCirclePacking
          data={hierarchyData}
          id="id"
          value="value"
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          padding={6}
          leavesOnly={false}
          colors={colorFn}
          colorBy="id"
          borderWidth={1.5}
          borderColor={borderColorFn}
          enableLabels={true}
          label={(node) => node.data.name ?? ''}
          labelsFilter={LEAF_ONLY_LABELS}
          labelsSkipRadius={16}
          labelTextColor={labelTextColorFn}
          onClick={handleClick}
          tooltip={CircleTooltip}
          theme={DARK_THEME}
          animate={true}
          motionConfig="gentle"
          isInteractive={true}
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
