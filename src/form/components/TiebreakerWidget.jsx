import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFormState } from '../state.jsx';

export function TiebreakerWidget({ groupLetter, tiedGroups }) {
  return (
    <div className="tiebreaker-widget">
      <p>
        <strong>Tie to break.</strong> Your scores leave teams tied. Drag the pills to rank them, leftmost = best finish.
      </p>
      {tiedGroups.map((subset, i) => (
        <SubsetRow key={i} groupLetter={groupLetter} subset={subset} />
      ))}
    </div>
  );
}

function SubsetRow({ groupLetter, subset }) {
  const { state, dispatch } = useFormState();
  const existingManual = state.manualTiebreakers[groupLetter] || {};
  const ordered = [...subset].sort((a, b) => {
    const ra = Number.isFinite(existingManual[a]) ? existingManual[a] : Infinity;
    const rb = Number.isFinite(existingManual[b]) ? existingManual[b] : Infinity;
    if (ra !== rb) return ra - rb;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.indexOf(active.id);
    const newIndex = ordered.indexOf(over.id);
    const next = arrayMove(ordered, oldIndex, newIndex);
    const ranks = { ...existingManual };
    next.forEach((team, idx) => {
      ranks[team] = idx + 1;
    });
    dispatch({ type: 'SET_MANUAL_TIEBREAKER', group: groupLetter, ranks });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ordered} strategy={horizontalListSortingStrategy}>
        <div className="tiebreaker-subset">
          {ordered.map((team) => (
            <DraggablePill key={team} id={team} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function DraggablePill({ id }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <span
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={'tiebreaker-pill' + (isDragging ? ' dragging' : '')}
    >
      <span className="grip" aria-hidden>⠿</span>
      {id}
    </span>
  );
}
