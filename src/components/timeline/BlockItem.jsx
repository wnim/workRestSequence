import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { blockStartTime } from '../../utils/time';
import { BLOCK_TOP, BLOCK_HEIGHT } from '../../utils/constants';
import { ResizeHandle } from './ResizeHandle';
import useStore from '../../store/workoutStore';

function snapTo(value, step) {
  return Math.round(value / step) * step;
}

export function BlockItem({ block, index, blocks, pxPerSecond, onDoubleClick, dragActiveId, dragDeltaX, dragDeltaY }) {
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const toggleSelected = useStore((s) => s.toggleSelected);
  const extendSelectionTo = useStore((s) => s.extendSelectionTo);
  const resizeBlock = useStore((s) => s.resizeBlock);
  const resizeStep = useStore((s) => s.resizeStep);

  const [resizeDeltaPx, setResizeDeltaPx] = useState(0);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const isSelected = selectedIds.has(block.id);
  const isWork = block.type === 'work';
  const isResizing = resizeDeltaPx !== 0;

  // True when another selected block is being dragged and this block rides along
  const isCompanion = !!(
    dragActiveId &&
    dragActiveId !== block.id &&
    selectedIds.has(block.id) &&
    selectedIds.has(dragActiveId) &&
    selectedIds.size > 1
  );

  // Compute snapped display duration from raw pixel delta
  const rawNewDuration = block.duration + resizeDeltaPx / pxPerSecond;
  const snappedDuration = isResizing
    ? Math.max(resizeStep, Math.min(3600, snapTo(rawNewDuration, resizeStep)))
    : block.duration;

  const left = blockStartTime(blocks, index) * pxPerSecond;
  const width = Math.max(4, snappedDuration * pxPerSecond);
  const top = BLOCK_TOP;
  const height = BLOCK_HEIGHT;

  function handleResizeMove(totalDeltaPx) {
    setResizeDeltaPx(totalDeltaPx);
  }

  function handleResizeEnd(totalDeltaPx) {
    const raw = block.duration + totalDeltaPx / pxPerSecond;
    const snapped = Math.max(resizeStep, Math.min(3600, snapTo(raw, resizeStep)));
    resizeBlock(block.id, snapped - block.duration);
    setResizeDeltaPx(0);
  }

  const style = {
    position: 'absolute',
    left,
    top,
    width,
    height,
    transform: isCompanion
      ? `translate(${dragDeltaX}px, ${dragDeltaY}px)`
      : CSS.Transform.toString(transform),
    transition: (isResizing || isCompanion) ? undefined : transition,
    opacity: (isDragging || isCompanion) ? 0.5 : 1,
    zIndex: 10,
    cursor: 'grab',
    borderRadius: 4,
    boxSizing: 'border-box',
    background: isWork ? 'oklch(0.65 0.22 35 / 0.7)' : 'oklch(0.35 0.05 250 / 0.7)',
    border: isSelected ? '2px solid oklch(0.75 0.15 200)' : '1px solid rgba(255,255,255,0.15)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingLeft: 6,
    overflow: 'hidden',
    userSelect: 'none',
  };

  function handleClick(e) {
    if (e.ctrlKey || e.metaKey) toggleSelected(block.id);
    else if (e.shiftKey) extendSelectionTo(block.id, blocks);
    else setSelectedIds(new Set([block.id]));
  }

  const labelText = block.label || (isWork ? 'Work' : 'Rest');
  const durationText = `${snappedDuration}s`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-block="true"
      onClick={handleClick}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(block); }}
    >
      {width > 20 && (
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1.3 }}>
          {width > 50 ? labelText : ''}
        </span>
      )}
      {width > 20 && (
        <span style={{ fontSize: isResizing ? 11 : 10, fontWeight: isResizing ? 600 : 400, color: isResizing ? 'white' : 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
          {durationText}
        </span>
      )}
      <ResizeHandle onResizeMove={handleResizeMove} onResizeEnd={handleResizeEnd} />
    </div>
  );
}
