import { useRef, useState, useCallback } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDndMonitor,
  closestCenter,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import useStore from '../../store/workoutStore';
import { blockStartTime, blocksToTotalDuration } from '../../utils/time';
import { TIMELINE_CANVAS_HEIGHT, BLOCK_TOP, BLOCK_HEIGHT, MULTI_DRAG_SCALE } from '../../utils/constants';
import { BlockItem } from './BlockItem';
import { WaveformSVG } from './WaveformSVG';
import { BlockEditModal } from '../modals/BlockEditModal';

const RULER_HEIGHT = 24;

// Expand every droppable rect to span the full canvas height so vertical
// movement never causes over=null and the resulting snap-back.
function horizontalOnlyCollision(args) {
  const expanded = new Map();
  args.droppableRects.forEach((rect, id) => {
    expanded.set(id, { ...rect, top: 0, bottom: TIMELINE_CANVAS_HEIGHT, height: TIMELINE_CANVAS_HEIGHT });
  });
  return closestCenter({ ...args, droppableRects: expanded });
}

function DragMonitor({ onMove }) {
  useDndMonitor({
    onDragMove(event) {
      onMove(event.delta.x, event.delta.y);
    },
  });
  return null;
}

function buildRulerTicks(totalSec, pxPerSecond) {
  const interval = pxPerSecond < 10 ? 10 : pxPerSecond < 30 ? 5 : 1;
  const ticks = [];
  for (let t = 0; t <= totalSec + interval; t += interval) {
    ticks.push({ t, x: t * pxPerSecond });
  }
  return ticks;
}

export function TimelineEditor() {
  const blocks = useStore((s) => s.blocks);
  const pxPerSecond = useStore((s) => s.pxPerSecond);
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const reorderBlocks = useStore((s) => s.reorderBlocks);
  const setBlocks = useStore((s) => s.setBlocks);

  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const [editingBlock, setEditingBlock] = useState(null);
  const [rubberBand, setRubberBand] = useState(null);
  const rubberStart = useRef(null);
  const [dragActiveId, setDragActiveId] = useState(null);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const [suppressTransition, setSuppressTransition] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Custom strategy: for multi-drag, widen the "active" rect to the combined width
  // of all selected blocks so non-selected items make room for the whole group.
  const sortingStrategy = useCallback((args) => {
    if (!dragActiveId || selectedIds.size <= 1) {
      return horizontalListSortingStrategy(args);
    }
    const { activeIndex, rects } = args;
    const totalSelectedWidth = blocks.reduce((sum, b, i) => (
      selectedIds.has(b.id) ? sum + (rects[i]?.width ?? 0) : sum
    ), 0);
    // Use the visually-scaled width so resting blocks open a gap that matches
    // the shrunk group size; the gap expands to full size on drop.
    const fakeRects = rects.map((r, i) =>
      i === activeIndex ? { ...r, width: totalSelectedWidth * MULTI_DRAG_SCALE } : r
    );
    return horizontalListSortingStrategy({ ...args, rects: fakeRects });
  }, [dragActiveId, selectedIds, blocks]);

  const totalSec = blocksToTotalDuration(blocks);
  const totalWidth = totalSec * pxPerSecond + 120;

  function handleDragStart(event) {
    setDragActiveId(event.active.id);
    setDragDeltaX(0);
    setDragDeltaY(0);
  }

  function handleDragEnd(event) {
    setDragActiveId(null);
    setDragDeltaX(0);
    setDragDeltaY(0);
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    if (selectedIds.has(active.id) && selectedIds.size > 1) {
      // Snap all blocks to final positions this frame; only the inner scale animates.
      setSuppressTransition(true);
      requestAnimationFrame(() => setSuppressTransition(false));
      // Multi-drag: move the whole selection together
      const selected = blocks.filter((b) => selectedIds.has(b.id));
      const rest = blocks.filter((b) => !selectedIds.has(b.id));
      const oldDraggedIdx = blocks.findIndex((b) => b.id === active.id);
      const oldOverIdx = blocks.findIndex((b) => b.id === over.id);
      const overInRest = rest.findIndex((b) => b.id === over.id);

      let insertAt;
      if (overInRest === -1) {
        // 'over' target is itself selected — append at end
        insertAt = rest.length;
      } else {
        insertAt = oldOverIdx > oldDraggedIdx ? overInRest + 1 : overInRest;
      }

      const result = [...rest];
      result.splice(insertAt, 0, ...selected);
      setBlocks(result);
    } else {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) reorderBlocks(oldIndex, newIndex);
    }
  }

  function handleDragCancel() {
    setDragActiveId(null);
    setDragDeltaX(0);
    setDragDeltaY(0);
  }

  const handleContainerPointerDown = useCallback((e) => {
    // Don't steal events from blocks or resize handles
    if (e.target.closest('[data-block]')) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top;
    rubberStart.current = { x, y };
    setRubberBand({ x1: x, y1: y, x2: x, y2: y });
    setSelectedIds(new Set());
  }, [setSelectedIds]);

  const handleContainerPointerMove = useCallback((e) => {
    if (!rubberStart.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top;
    setRubberBand({ x1: rubberStart.current.x, y1: rubberStart.current.y, x2: x, y2: y });

    const minX = Math.min(rubberStart.current.x, x);
    const maxX = Math.max(rubberStart.current.x, x);
    const minY = Math.min(rubberStart.current.y, y);
    const maxY = Math.max(rubberStart.current.y, y);

    const hit = new Set();
    blocks.forEach((b, i) => {
      const bLeft = blockStartTime(blocks, i) * pxPerSecond;
      const bRight = bLeft + b.duration * pxPerSecond;
      const bTop = BLOCK_TOP;
      const bBottom = BLOCK_TOP + BLOCK_HEIGHT;
      if (bRight > minX && bLeft < maxX && bBottom > minY && bTop < maxY) hit.add(b.id);
    });
    setSelectedIds(hit);
  }, [blocks, pxPerSecond, setSelectedIds]);

  const handleContainerPointerUp = useCallback(() => {
    rubberStart.current = null;
    setRubberBand(null);
  }, []);

  const ticks = buildRulerTicks(totalSec, pxPerSecond);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%',
      background: '#14152a', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
      overflow: 'hidden',
    }}>
      {/* Ruler */}
      <div style={{ height: RULER_HEIGHT, overflowX: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#1a1b30' }}>
        <svg width={totalWidth} height={RULER_HEIGHT} style={{ display: 'block' }}>
          {ticks.map(({ t, x }) => (
            <g key={t}>
              <line x1={x} y1={14} x2={x} y2={RULER_HEIGHT} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
              <text x={x + 3} y={12} fontSize={9} fill="rgba(255,255,255,0.5)" fontFamily="monospace">{t}s</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Scrollable canvas */}
      <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%' }}>
        <div
          ref={containerRef}
          style={{ position: 'relative', height: TIMELINE_CANVAS_HEIGHT, width: totalWidth, minWidth: '100%' }}
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={handleContainerPointerUp}
        >
          <WaveformSVG blocks={blocks} pxPerSecond={pxPerSecond} width={totalWidth} height={TIMELINE_CANVAS_HEIGHT} />

          <DndContext
            sensors={sensors}
            collisionDetection={horizontalOnlyCollision}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <DragMonitor
              onMove={(deltaX, deltaY) => { setDragDeltaX(deltaX); setDragDeltaY(deltaY); }}
            />
            <SortableContext items={blocks.map((b) => b.id)} strategy={sortingStrategy}>
              {blocks.map((b, i) => (
                <BlockItem
                  key={b.id}
                  block={b}
                  index={i}
                  blocks={blocks}
                  pxPerSecond={pxPerSecond}
                  onDoubleClick={setEditingBlock}
                  dragActiveId={dragActiveId}
                  dragDeltaX={dragDeltaX}
                  dragDeltaY={dragDeltaY}
                  suppressTransition={suppressTransition}
                />
              ))}
            </SortableContext>
          </DndContext>

          {rubberBand && (
            <div style={{
              position: 'absolute',
              left: Math.min(rubberBand.x1, rubberBand.x2),
              top: Math.min(rubberBand.y1, rubberBand.y2),
              width: Math.abs(rubberBand.x2 - rubberBand.x1),
              height: Math.abs(rubberBand.y2 - rubberBand.y1),
              border: '1px solid rgba(120,180,255,0.7)',
              background: 'rgba(120,180,255,0.1)',
              pointerEvents: 'none',
              zIndex: 30,
            }} />
          )}
        </div>
      </div>

      {editingBlock && (
        <BlockEditModal block={editingBlock} onClose={() => setEditingBlock(null)} />
      )}
    </div>
  );
}
