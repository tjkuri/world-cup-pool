import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFormState } from '../state.jsx';
import { useDerivedStandings } from '../useDerivedStandings.js';
import { teamName, teamFlag } from '../../shared/teamNames.js';

export function PredictedStandings({ fixtures }) {
  const { state, dispatch } = useFormState();
  const letter = state.activeGroup;
  const { standings, unresolvedTies, scoreOnlyTies, allFilled } = useDerivedStandings(letter, state, fixtures);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Drag is only valid within a single score-only tied subset (always draggable).
    const subset = scoreOnlyTies.find((s) => s.includes(active.id) && s.includes(over.id));
    if (!subset) return;
    // Compute the new order of the tied teams using their current standings positions.
    const subsetOrder = standings.filter((t) => subset.includes(t));
    const oldIdx = subsetOrder.indexOf(active.id);
    const newIdx = subsetOrder.indexOf(over.id);
    const newOrder = arrayMove(subsetOrder, oldIdx, newIdx);
    const ranks = { ...(state.manualTiebreakers[letter] || {}) };
    newOrder.forEach((team, i) => {
      ranks[team] = i + 1;
    });
    dispatch({ type: 'SET_MANUAL_TIEBREAKER', group: letter, ranks });
  }

  // Map each tied team to its subset index so distinct ties get distinct visuals.
  // Rows stay draggable even after the user has resolved them, so they can keep
  // changing their mind.
  const tieIndexByTeam = new Map();
  scoreOnlyTies.forEach((subset, i) => {
    for (const team of subset) tieIndexByTeam.set(team, i);
  });

  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
        Predicted standings — Group {letter}
      </h3>
      {!allFilled && (
        <p className="mb-3 text-sm text-slate-400">Fill in all 6 match scores to derive the standings.</p>
      )}
      {allFilled && scoreOnlyTies.length === 0 && (
        <p className="mb-3 text-sm text-slate-400">Derived from your scores.</p>
      )}
      {allFilled && scoreOnlyTies.length > 0 && (
        <p className="mb-3 text-sm text-slate-400">
          Tied on scores — drag the highlighted teams if you want a different order.
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} autoScroll={false}>
        <SortableContext items={standings} strategy={verticalListSortingStrategy}>
          <ol className="space-y-1.5">
            {standings.map((team, i) => (
              <SortableRow
                key={team}
                id={team}
                rank={i + 1}
                draggable={tieIndexByTeam.has(team)}
                tieIndex={tieIndexByTeam.get(team)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableRow({ id, rank, draggable, tieIndex }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !draggable });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const tieBg = !draggable
    ? 'bg-slate-900'
    : tieIndex === 1
    ? 'bg-blue-400/15 ring-1 ring-inset ring-blue-400/50 border-l-4 border-blue-400'
    : 'bg-amber-400/15 ring-1 ring-inset ring-amber-400/50 border-l-4 border-amber-400';

  const cls = [
    'flex items-center gap-3 rounded-md px-3 py-2 select-none touch-manipulation',
    tieBg,
    isDragging && 'opacity-40 shadow-lg',
  ].filter(Boolean).join(' ');

  return (
    <li ref={setNodeRef} style={style} className={cls}>
      {draggable ? (
        <span
          className="w-5 text-center text-lg text-slate-400 cursor-grab touch-none"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >⠿</span>
      ) : (
        <span className="w-5" aria-hidden></span>
      )}
      <span className="w-6 tabular-nums text-slate-400">{rank}.</span>
      <span className="text-slate-100 font-medium">
        <span className="mr-1.5">{teamFlag(id)}</span>{teamName(id)}
      </span>
    </li>
  );
}
