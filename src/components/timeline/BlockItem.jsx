import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { blockStartTime } from '../../utils/time';
import { BLOCK_TOP, BLOCK_HEIGHT, MULTI_DRAG_SCALE } from '../../utils/constants';
import { ResizeHandle } from './ResizeHandle';
import useStore from '../../store/workoutStore';

function snapTo(value, step) {
  return Math.round(value / step) * step;
}

export function BlockItem({ block, index, blocks, pxPerSecond, onDoubleClick, dragActiveId, dragDeltaX, dragDeltaY, suppressTransition }) {
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

  // True for every block in an active multi-block drag (leader + companions)
  const isInMultiDrag = isCompanion || (isDragging && selectedIds.size > 1);

  // Compute per-block X offset that packs the group tightly on the inner (visual) div.
  // Each block's inner div translates so that the scaled blocks appear side-by-side with
  // no gap, anchored at the leftmost selected block's original left edge.
  // Derived from: desiredVisualLeft = L0 + sum(w[j]*S for j<i)
  //   actualVisualLeft (scale from center) = Li + wi*(1-S)/2
  //   offsetX = desiredVisualLeft - actualVisualLeft
  let innerGroupOffsetX = 0;
  if (isInMultiDrag) {
    const S = MULTI_DRAG_SCALE;
    const selectedData = blocks
      .map((b, i) => ({ id: b.id, w: b.duration * pxPerSecond, L: blockStartTime(blocks, i) * pxPerSecond }))
      .filter((b) => selectedIds.has(b.id))
      .sort((a, b) => a.L - b.L);
    const myIdx = selectedData.findIndex((b) => b.id === block.id);
    if (myIdx >= 0) {
      let sumPrev = 0;
      for (let i = 0; i < myIdx; i++) sumPrev += selectedData[i].w * S;
      const L0 = selectedData[0].L;
      const Li = blockStartTime(blocks, index) * pxPerSecond;
      const wi = block.duration * pxPerSecond;
      innerGroupOffsetX = L0 - Li + sumPrev - wi * (1 - S) / 2;
    }
  }

  // Compute snapped display duration from raw pixel delta
  const rawNewDuration = block.duration + resizeDeltaPx / pxPerSecond;
  const snappedDuration = isResizing
    ? Math.max(resizeStep, Math.min(3600, snapTo(rawNewDuration, resizeStep)))
    : block.duration;

  const left = blockStartTime(blocks, index) * pxPerSecond;
  const width = Math.max(4, snappedDuration * pxPerSecond);

  // Outer div: dnd-kit measures this for collision/sorting — keep it transparent, full-size
  const outerStyle = {
    position: 'absolute',
    left,
    top: BLOCK_TOP,
    width,
    height: BLOCK_HEIGHT,
    transform: isCompanion
      ? `translate(${dragDeltaX}px, ${dragDeltaY}px)`
      : CSS.Transform.toString(transform),
    transition: suppressTransition ? 'none' : (isResizing || isCompanion) ? undefined : transition,
    zIndex: 10,
    cursor: 'grab',
    userSelect: 'none',
    boxSizing: 'border-box',
  };

  // Inner div: all visuals live here so scale never affects dnd-kit's rect measurements
  const innerStyle = {
    position: 'absolute',
    inset: 0,
    borderRadius: 4,
    boxSizing: 'border-box',
    background: isWork ? 'oklch(0.65 0.22 35 / 0.7)' : 'oklch(0.35 0.05 250 / 0.7)',
    border: isSelected ? '2px solid oklch(0.75 0.15 200)' : '1px solid rgba(255,255,255,0.15)',
    opacity: (isDragging || isCompanion) ? 0.5 : 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingLeft: 6,
    overflow: 'hidden',
    transform: isInMultiDrag
      ? `translateX(${innerGroupOffsetX}px) scale(${MULTI_DRAG_SCALE})`
      : 'scale(1)',
    transition: 'transform 120ms ease',
  };

  function handleResizeMove(totalDeltaPx) {
    setResizeDeltaPx(totalDeltaPx);
  }

  function handleResizeEnd(totalDeltaPx) {
    const raw = block.duration + totalDeltaPx / pxPerSecond;
    const snapped = Math.max(resizeStep, Math.min(3600, snapTo(raw, resizeStep)));
    resizeBlock(block.id, snapped - block.duration);
    setResizeDeltaPx(0);
  }

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
      style={outerStyle}
      {...attributes}
      {...listeners}
      data-block="true"
      onClick={handleClick}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(block); }}
    >
      <div style={innerStyle}>
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
    </div>
  );
}
