import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFormState } from '../state.jsx';
import { useDerivedStandings } from '../useDerivedStandings.js';

export function PredictedStandings({ fixtures }) {
  const { state, dispatch } = useFormState();
  const letter = state.activeGroup;
  const { standings, source } = useDerivedStandings(letter, state, fixtures);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = standings.indexOf(active.id);
    const newIndex = standings.indexOf(over.id);
    const next = arrayMove(standings, oldIndex, newIndex);
    dispatch({ type: 'SET_MANUAL_STANDINGS', group: letter, order: next });
  }

  function resetToAuto() {
    dispatch({ type: 'CLEAR_MANUAL_STANDINGS', group: letter });
  }

  return (
    <div className="standings-panel">
      <div className="standings-header">
        <h3>Predicted standings — Group {letter}</h3>
        {source === 'manual' && (
          <button type="button" className="link-button" onClick={resetToAuto}>
            Reset to auto
          </button>
        )}
      </div>
      <p className="standings-hint">
        {source === 'placeholder' && 'Fill scores to derive standings — drag any time to override.'}
        {source === 'derived' && 'Auto-derived from your scores. Drag to override.'}
        {source === 'manual' && 'Manual order. Drag to adjust or reset to auto.'}
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} autoScroll={false}>
        <SortableContext items={standings} strategy={verticalListSortingStrategy}>
          <ol className="standings-list">
            {standings.map((team, i) => (
              <SortableRow key={team} id={team} rank={i + 1} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableRow({ id, rank }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className={'standings-row' + (isDragging ? ' dragging' : '')}>
      <span className="grip" {...attributes} {...listeners} aria-label="Drag to reorder">⠿</span>
      <span className="standings-rank">{rank}.</span>
      <span className="standings-team">{id}</span>
    </li>
  );
}
