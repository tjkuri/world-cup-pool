import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFormState } from '../state.jsx';
import { useDerivedStandings } from '../useDerivedStandings.js';

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
    <div className="standings-panel">
      <h3>Predicted standings — Group {letter}</h3>
      {!allFilled && (
        <p className="standings-hint">Fill in all 6 match scores to derive the standings.</p>
      )}
      {allFilled && scoreOnlyTies.length === 0 && (
        <p className="standings-hint">Derived from your scores.</p>
      )}
      {allFilled && scoreOnlyTies.length > 0 && unresolvedTies.length > 0 && (
        <p className="standings-hint">
          <strong>Tie to break.</strong> Drag the highlighted teams to choose their finishing order.
        </p>
      )}
      {allFilled && scoreOnlyTies.length > 0 && unresolvedTies.length === 0 && (
        <p className="standings-hint">
          Tied on scores — your manual order shown. Drag any highlighted team to change your mind.
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} autoScroll={false}>
        <SortableContext items={standings} strategy={verticalListSortingStrategy}>
          <ol className="standings-list">
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
    opacity: isDragging ? 0.4 : 1,
  };
  const cls = [
    'standings-row',
    draggable && 'draggable',
    draggable && `tie-${tieIndex}`,
    isDragging && 'dragging',
  ].filter(Boolean).join(' ');
  return (
    <li ref={setNodeRef} style={style} className={cls}>
      {draggable ? (
        <span className="grip" {...attributes} {...listeners} aria-label="Drag to reorder">⠿</span>
      ) : (
        <span className="grip placeholder" aria-hidden></span>
      )}
      <span className="standings-rank">{rank}.</span>
      <span className="standings-team">{id}</span>
    </li>
  );
}
