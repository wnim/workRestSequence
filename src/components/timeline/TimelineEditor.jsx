import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { TbMarquee, TbMarquee2 } from 'react-icons/tb';
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
  const interval =
    pxPerSecond < 3  ? 60 :
    pxPerSecond < 6  ? 30 :
    pxPerSecond < 10 ? 10 :
    pxPerSecond < 30 ? 5  : 1;
  const ticks = [];
  for (let t = 0; t <= totalSec + interval; t += interval) {
    ticks.push({ t, x: t * pxPerSecond });
  }
  return ticks;
}

export const TimelineEditor = forwardRef(function TimelineEditor(props, ref) {
  const blocks = useStore((s) => s.blocks);
  const pxPerSecond = useStore((s) => s.pxPerSecond);
  const setPxPerSecond = useStore((s) => s.setPxPerSecond);
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const reorderBlocks = useStore((s) => s.reorderBlocks);
  const setBlocks = useStore((s) => s.setBlocks);

  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const pxPerSecondRef = useRef(pxPerSecond);
  const pendingScrollRef = useRef(null);
  const [scrollContainerWidth, setScrollContainerWidth] = useState(0);
  const [editingBlocks, setEditingBlocks] = useState(null);
  const [rubberBand, setRubberBand] = useState(null);
  const rubberStart = useRef(null);
  const [selectionMode, setSelectionMode] = useState('all'); // 'all' | 'work' | 'rest'
  const [dragActiveId, setDragActiveId] = useState(null);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const [suppressTransition, setSuppressTransition] = useState(false);

  useEffect(() => { pxPerSecondRef.current = pxPerSecond; }, [pxPerSecond]);

  const zoomToSelection = useCallback(() => {
    const selected = blocks.filter((b) => selectedIds.has(b.id));
    if (selected.length === 0 || !scrollRef.current) return;
    const indices = selected.map((b) => blocks.findIndex((bl) => bl.id === b.id));
    const minIdx = Math.min(...indices);
    const maxIdx = Math.max(...indices);
    const startSec = blockStartTime(blocks, minIdx);
    const endSec = blockStartTime(blocks, maxIdx) + blocks[maxIdx].duration;
    const spanSec = endSec - startSec;
    if (spanSec <= 0) return;
    const availableWidth = scrollRef.current.clientWidth;
    const newPx = Math.max(2, Math.min(100, availableWidth / spanSec));
    pendingScrollRef.current = startSec * newPx;
    setPxPerSecond(newPx);
  }, [blocks, selectedIds, setPxPerSecond]);

  const fitToScreen = useCallback((sec) => {
    const totalS = sec != null ? sec : blocksToTotalDuration(blocks);
    if (!totalS || !scrollRef.current) return;
    const availableWidth = scrollRef.current.clientWidth;
    const newPx = Math.max(2, Math.min(100, availableWidth / (totalS * 1.1)));
    pendingScrollRef.current = 0;
    setPxPerSecond(newPx);
  }, [blocks, setPxPerSecond]);

  const zoomBy = useCallback((factor) => {
    const el = scrollRef.current;
    if (!el) return;
    const cur = pxPerSecondRef.current;
    const timeAtCenter = (el.scrollLeft + el.clientWidth / 2) / cur;
    const newPx = Math.max(2, Math.min(100, cur * factor));
    pendingScrollRef.current = Math.max(0, timeAtCenter * newPx - el.clientWidth / 2);
    setPxPerSecond(newPx);
  }, [setPxPerSecond]);

  useImperativeHandle(ref, () => ({ fitToScreen, zoomToSelection, zoomBy }), [fitToScreen, zoomToSelection, zoomBy]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScrollContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ctrl+scroll zooms in/out anchored to the cursor; plain scroll pans the timeline.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const cur = pxPerSecondRef.current;
        const timeAtCursor = (el.scrollLeft + mouseX) / cur;
        const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
        const newPx = Math.max(2, Math.min(100, cur * Math.exp(-delta * 0.001)));
        pendingScrollRef.current = Math.max(0, timeAtCursor * newPx - mouseX);
        setPxPerSecond(newPx);
      } else {
        el.scrollLeft += e.deltaX + e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setPxPerSecond]);

  // After a zoom, restore scroll position so the point under the cursor stays fixed.
  useEffect(() => {
    if (pendingScrollRef.current === null || !scrollRef.current) return;
    scrollRef.current.scrollLeft = pendingScrollRef.current;
    pendingScrollRef.current = null;
  }, [pxPerSecond]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Enter') return;
      if (e.target.closest('input, textarea, [contenteditable]')) return;
      if (selectedIds.size === 0) return;
      setEditingBlocks(blocks.filter((b) => selectedIds.has(b.id)));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [blocks, selectedIds]);

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
  const contentWidth = totalSec * pxPerSecond;
  const totalWidth = scrollContainerWidth > 0 && contentWidth <= scrollContainerWidth
    ? scrollContainerWidth
    : contentWidth + 120;

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
      if (selectionMode !== 'all' && b.type !== selectionMode) return;
      const bLeft = blockStartTime(blocks, i) * pxPerSecond;
      const bRight = bLeft + b.duration * pxPerSecond;
      const bTop = BLOCK_TOP;
      const bBottom = BLOCK_TOP + BLOCK_HEIGHT;
      if (bRight > minX && bLeft < maxX && bBottom > minY && bTop < maxY) hit.add(b.id);
    });
    setSelectedIds(hit);
  }, [blocks, pxPerSecond, setSelectedIds, selectionMode]);

  const handleContainerPointerUp = useCallback(() => {
    rubberStart.current = null;
    setRubberBand(null);
  }, []);

  const ticks = buildRulerTicks(totalSec, pxPerSecond);

  const selModeBtnStyle = (mode) => ({
    background: selectionMode === mode ? 'rgba(255,255,255,0.1)' : 'none',
    border: 'none', borderRadius: 3,
    cursor: 'pointer', height: 22, padding: '0 3px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  const zoomBtnStyle = (disabled) => ({
    background: 'none', border: 'none', borderRadius: 3,
    color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.65)',
    cursor: disabled ? 'default' : 'pointer',
    width: 24, height: 22, padding: 0, fontSize: 14, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace',
  });

  return (
    <div style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column', width: '100%',
      background: '#14152a', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
      overflow: 'hidden',
    }}>
      {/* Floating zoom toolbar */}
      <div style={{
        position: 'absolute', top: RULER_HEIGHT + 6, left: 8, zIndex: 20,
        display: 'flex', gap: 2, alignItems: 'center',
        background: 'rgba(14,15,32,0.82)', borderRadius: 5, padding: 3,
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(6px)',
      }}>
        <button style={zoomBtnStyle(false)} title="Zoom out (Ctrl+−)" onClick={() => zoomBy(1 / 1.4)}>−</button>
        <button style={zoomBtnStyle(false)} title="Zoom in (Ctrl++)" onClick={() => zoomBy(1.4)}>+</button>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.12)', margin: '1px 2px' }} />
        <button style={zoomBtnStyle(false)} title="Fit all to screen (Ctrl+0)" onClick={() => fitToScreen()}>⟷</button>
        <button style={zoomBtnStyle(selectedIds.size === 0)} title="Zoom to selection (Z)" onClick={zoomToSelection} disabled={selectedIds.size === 0}>⊡</button>
      </div>

      {/* Selection mode toolbar */}
      <div style={{
        position: 'absolute', top: RULER_HEIGHT + 6, right: 8, zIndex: 20,
        display: 'flex', gap: 2, alignItems: 'center',
        background: 'rgba(14,15,32,0.82)', borderRadius: 5, padding: 3,
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(6px)',
      }}>
        <button style={selModeBtnStyle('all')} title="Select any block" onClick={() => setSelectionMode('all')}>
          <TbMarquee size={16} color={selectionMode === 'all' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.28)'} />
        </button>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.12)', margin: '1px 2px' }} />
        <button style={selModeBtnStyle('work')} title="Select only work blocks" onClick={() => setSelectionMode('work')}>
          <TbMarquee2 size={16} color={selectionMode === 'work' ? 'rgba(255,145,100,0.9)' : 'rgba(255,145,100,0.3)'} />
        </button>
        <button style={selModeBtnStyle('rest')} title="Select only rest blocks" onClick={() => setSelectionMode('rest')}>
          <TbMarquee2 size={16} color={selectionMode === 'rest' ? 'rgba(130,165,220,0.9)' : 'rgba(130,165,220,0.3)'} />
        </button>
      </div>

      {/* Scrollable container: ruler + canvas scroll together */}
      <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%' }}>
        {/* Ruler */}
        <div style={{ width: totalWidth, minWidth: '100%', height: RULER_HEIGHT, borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#1a1b30' }}>
          <svg width={totalWidth} height={RULER_HEIGHT} style={{ display: 'block' }}>
            {ticks.map(({ t, x }) => (
              <g key={t}>
                <line x1={x} y1={14} x2={x} y2={RULER_HEIGHT} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                <text x={x + 3} y={12} fontSize={9} fill="rgba(255,255,255,0.5)" fontFamily="monospace">{t}s</text>
              </g>
            ))}
          </svg>
        </div>

        {/* Canvas */}
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
                  onDoubleClick={(clicked) => {
                    if (selectedIds.has(clicked.id) && selectedIds.size > 1) {
                      const sorted = blocks.filter((b) => selectedIds.has(b.id));
                      setEditingBlocks(sorted);
                    } else {
                      setEditingBlocks([clicked]);
                    }
                  }}
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

      {editingBlocks && (
        <BlockEditModal blocks={editingBlocks} onClose={() => setEditingBlocks(null)} />
      )}
    </div>
  );
});
