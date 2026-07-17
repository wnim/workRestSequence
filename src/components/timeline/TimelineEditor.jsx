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
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import useStore from '../../store/workoutStore';
import { blockStartTime, blocksToTotalDuration, getBlockBounds } from '../../utils/time';
import { TIMELINE_CANVAS_HEIGHT, BLOCK_TOP, BLOCK_HEIGHT, MULTI_DRAG_SCALE, VERTICAL_RULER_WIDTH } from '../../utils/constants';
import { BlockItem } from './BlockItem';
import { WaveformSVG } from './WaveformSVG';
import { BlockEditModal } from '../modals/BlockEditModal';

const RULER_HEIGHT = 24;

// Expand every droppable rect along the non-sort axis so off-axis mouse movement
// never causes over=null. axis: 'x' = horizontal DnD, 'y' = vertical DnD.
function makeAxisOnlyCollision(canvasExtent, axis) {
  return (args) => {
    const expanded = new Map();
    args.droppableRects.forEach((rect, id) => {
      expanded.set(id, axis === 'x'
        ? { ...rect, top: 0, bottom: canvasExtent, height: canvasExtent }
        : { ...rect, left: 0, right: canvasExtent, width: canvasExtent }
      );
    });
    return closestCenter({ ...args, droppableRects: expanded });
  };
}
const horizontalCollision = makeAxisOnlyCollision(TIMELINE_CANVAS_HEIGHT, 'x');
// Vertical collision extent is generous — real width is computed dynamically but
// we just need it large enough to span the canvas.
const verticalCollision = makeAxisOnlyCollision(2000, 'y');

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
    ticks.push({ t, pos: t * pxPerSecond });
  }
  return ticks;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export const TimelineEditor = forwardRef(function TimelineEditor(props, ref) {
  const blocks = useStore((s) => s.blocks);
  const pxPerSecond = useStore((s) => s.pxPerSecond);
  const setPxPerSecond = useStore((s) => s.setPxPerSecond);
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const reorderBlocks = useStore((s) => s.reorderBlocks);
  const setBlocks = useStore((s) => s.setBlocks);

  const isMobile = useIsMobile();
  const [verticalToggle, setVerticalToggle] = useState(false);
  const vertical = isMobile || verticalToggle;
  const verticalRef = useRef(vertical);
  useEffect(() => { verticalRef.current = vertical; }, [vertical]);

  const prevVertical = useRef(vertical);
  const fitToScreenRef = useRef(null);

  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const pxPerSecondRef = useRef(pxPerSecond);
  const pendingScrollRef = useRef(null);
  const [scrollContainerWidth, setScrollContainerWidth] = useState(0);
  const [editingBlocks, setEditingBlocks] = useState(null);
  const [rubberBand, setRubberBand] = useState(null);
  const rubberStart = useRef(null);
  const [selectionMode, setSelectionMode] = useState('all');
  const [dragActiveId, setDragActiveId] = useState(null);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const [suppressTransition, setSuppressTransition] = useState(false);

  useEffect(() => { pxPerSecondRef.current = pxPerSecond; }, [pxPerSecond]);

  // In vertical mode, width is just enough to fit the longest label + duration text.
  // ~7.2px per char at 12px monospace, plus padding (6) + resize handle (8) + gap (20).
  const vertBlockWidth = Math.max(80, blocks.reduce((max, b) => {
    const label = b.label || (b.type === 'work' ? 'Work' : 'Rest');
    return Math.max(max, `${label} ${b.duration}s`.length);
  }, 0) * 7.2 + 34);

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
    const available = verticalRef.current ? scrollRef.current.clientHeight : scrollRef.current.clientWidth;
    const newPx = Math.max(2, Math.min(100, available / spanSec));
    pendingScrollRef.current = startSec * newPx;
    setPxPerSecond(newPx);
  }, [blocks, selectedIds, setPxPerSecond]);

  const fitToScreen = useCallback((sec) => {
    const totalS = sec != null ? sec : blocksToTotalDuration(blocks);
    if (!totalS || !scrollRef.current) return;
    const available = verticalRef.current ? scrollRef.current.clientHeight : scrollRef.current.clientWidth;
    const newPx = Math.max(2, Math.min(100, available / (totalS * 1.1)));
    pendingScrollRef.current = 0;
    setPxPerSecond(newPx);
  }, [blocks, setPxPerSecond]);

  const zoomBy = useCallback((factor) => {
    const el = scrollRef.current;
    if (!el) return;
    const cur = pxPerSecondRef.current;
    const isVert = verticalRef.current;
    const pos = isVert
      ? (el.scrollTop + el.clientHeight / 2) / cur
      : (el.scrollLeft + el.clientWidth / 2) / cur;
    const newPx = Math.max(2, Math.min(100, cur * factor));
    const newPos = Math.max(0, pos * newPx - (isVert ? el.clientHeight : el.clientWidth) / 2);
    pendingScrollRef.current = newPos;
    setPxPerSecond(newPx);
  }, [setPxPerSecond]);

  useImperativeHandle(ref, () => ({ fitToScreen, zoomToSelection, zoomBy }), [fitToScreen, zoomToSelection, zoomBy]);

  fitToScreenRef.current = fitToScreen;
  useEffect(() => {
    if (prevVertical.current === vertical) return;
    prevVertical.current = vertical;
    requestAnimationFrame(() => fitToScreenRef.current());
  }, [vertical]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScrollContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ctrl+scroll zooms anchored to cursor; plain scroll pans.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const isVert = verticalRef.current;
      if (e.ctrlKey) {
        const rect = el.getBoundingClientRect();
        const cur = pxPerSecondRef.current;
        const mousePos = isVert ? e.clientY - rect.top : e.clientX - rect.left;
        const scrollPos = isVert ? el.scrollTop : el.scrollLeft;
        const timeAtCursor = (scrollPos + mousePos) / cur;
        const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
        const newPx = Math.max(2, Math.min(100, cur * Math.exp(-delta * 0.001)));
        pendingScrollRef.current = Math.max(0, timeAtCursor * newPx - mousePos);
        setPxPerSecond(newPx);
      } else {
        if (isVert) el.scrollTop += e.deltaY;
        else el.scrollLeft += e.deltaX + e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setPxPerSecond, vertical]);

  // After a zoom, restore scroll position so the point under the cursor stays fixed.
  useEffect(() => {
    if (pendingScrollRef.current === null || !scrollRef.current) return;
    if (verticalRef.current) scrollRef.current.scrollTop = pendingScrollRef.current;
    else scrollRef.current.scrollLeft = pendingScrollRef.current;
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

  // Unified strategy: single-drag uses the appropriate base strategy; multi-drag
  // expands the active rect along the sort axis to the combined selected size.
  const sortingStrategy = useCallback((args) => {
    const baseStrategy = verticalRef.current ? verticalListSortingStrategy : horizontalListSortingStrategy;
    if (!dragActiveId || selectedIds.size <= 1) return baseStrategy(args);
    const { activeIndex, rects } = args;
    const dimKey = verticalRef.current ? 'height' : 'width';
    const totalSelectedDim = blocks.reduce((sum, b, i) => (
      selectedIds.has(b.id) ? sum + (rects[i]?.[dimKey] ?? 0) : sum
    ), 0);
    const fakeRects = rects.map((r, i) =>
      i === activeIndex ? { ...r, [dimKey]: totalSelectedDim * MULTI_DRAG_SCALE } : r
    );
    return baseStrategy({ ...args, rects: fakeRects });
  }, [dragActiveId, selectedIds, blocks]);

  const totalSec = blocksToTotalDuration(blocks);
  const contentWidth = totalSec * pxPerSecond;
  const contentHeight = totalSec * pxPerSecond;

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
      setSuppressTransition(true);
      requestAnimationFrame(() => setSuppressTransition(false));
      const selected = blocks.filter((b) => selectedIds.has(b.id));
      const rest = blocks.filter((b) => !selectedIds.has(b.id));
      const oldDraggedIdx = blocks.findIndex((b) => b.id === active.id);
      const oldOverIdx = blocks.findIndex((b) => b.id === over.id);
      const overInRest = rest.findIndex((b) => b.id === over.id);

      let insertAt;
      if (overInRest === -1) {
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
    if (e.target.closest('[data-block]')) return;
    if (e.target.closest('[data-ruler]')) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    rubberStart.current = { x, y };
    setRubberBand({ x1: x, y1: y, x2: x, y2: y });
    setSelectedIds(new Set());
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [setSelectedIds]);

  const handleContainerPointerMove = useCallback((e) => {
    if (!rubberStart.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRubberBand({ x1: rubberStart.current.x, y1: rubberStart.current.y, x2: x, y2: y });

    const minX = Math.min(rubberStart.current.x, x);
    const maxX = Math.max(rubberStart.current.x, x);
    const minY = Math.min(rubberStart.current.y, y);
    const maxY = Math.max(rubberStart.current.y, y);

    const hit = new Set();
    blocks.forEach((b, i) => {
      if (selectionMode !== 'all' && b.type !== selectionMode) return;
      const { left: bLeft, right: bRight, top: bTop, bottom: bBottom } =
        getBlockBounds(blocks, i, pxPerSecond, vertical, undefined, vertBlockWidth);
      if (bRight > minX && bLeft < maxX && bBottom > minY && bTop < maxY) hit.add(b.id);
    });
    setSelectedIds(hit);
  }, [blocks, pxPerSecond, vertical, vertBlockWidth, setSelectedIds, selectionMode]);

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

  const toolbarButtons = <>
    <button style={selModeBtnStyle('all')} title="Select any block" onClick={() => setSelectionMode('all')}>
      <TbMarquee size={16} color={selectionMode === 'all' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.28)'} />
    </button>
    <button style={selModeBtnStyle('work')} title="Select only work blocks" onClick={() => setSelectionMode('work')}>
      <TbMarquee2 size={16} color={selectionMode === 'work' ? 'rgba(255,145,100,0.9)' : 'rgba(255,145,100,0.3)'} />
    </button>
    <button style={selModeBtnStyle('rest')} title="Select only rest blocks" onClick={() => setSelectionMode('rest')}>
      <TbMarquee2 size={16} color={selectionMode === 'rest' ? 'rgba(130,165,220,0.9)' : 'rgba(130,165,220,0.3)'} />
    </button>
    <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.1)', margin: '2px 0' }} />
    <button style={zoomBtnStyle(false)} title="Zoom in (Ctrl++)" onClick={() => zoomBy(1.4)}>+</button>
    <button style={zoomBtnStyle(false)} title="Zoom out (Ctrl+−)" onClick={() => zoomBy(1 / 1.4)}>−</button>
    <button style={zoomBtnStyle(false)} title="Fit all to screen (Ctrl+0)" onClick={() => fitToScreen()}>⟷</button>
    <button style={zoomBtnStyle(selectedIds.size === 0)} title="Zoom to selection (Z)" onClick={zoomToSelection} disabled={selectedIds.size === 0}>⊡</button>
    {!isMobile && (
      <button
        style={zoomBtnStyle(false)}
        title={vertical ? 'Switch to horizontal layout' : 'Switch to vertical layout'}
        onClick={() => setVerticalToggle((v) => !v)}
      >
        {vertical ? '⇆' : '⇅'}
      </button>
    )}
  </>;

  return (
    <div style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column', width: '100%',
      ...(vertical ? { flex: 1, minHeight: 0 } : {}),
      background: '#14152a', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
      overflow: 'hidden',
    }}>
      {/* In horizontal mode, toolbar floats over the canvas (no scrollbar conflict) */}
      {!vertical && (
        <div style={{
          position: 'absolute', top: RULER_HEIGHT + 6, right: 8, zIndex: 20,
          display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center',
          background: 'rgba(14,15,32,0.82)', borderRadius: 5, padding: 3,
          border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)',
        }}>
          {toolbarButtons}
        </div>
      )}

      {/* In vertical mode, toolbar is a flex sibling — sits outside the scrollbar */}
      <div style={{ flex: vertical ? 1 : undefined, display: 'flex', minHeight: 0 }}>
        {/* Scrollable container */}
        <div
          ref={scrollRef}
          style={vertical
            ? { flex: 1, overflowX: 'hidden', overflowY: 'auto' }
            : { overflowX: 'auto', overflowY: 'hidden', width: '100%' }
          }
        >
        {/* Horizontal ruler — only in horizontal mode */}
        {!vertical && (
          <div style={{ width: contentWidth, minWidth: '100%', height: RULER_HEIGHT, borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#1a1b30' }}>
            <svg width="100%" height={RULER_HEIGHT} style={{ display: 'block' }}>
              {ticks.map(({ t, pos }) => (
                <g key={t}>
                  <line x1={pos} y1={14} x2={pos} y2={RULER_HEIGHT} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                  <text x={pos + 3} y={12} fontSize={9} fill="rgba(255,255,255,0.5)" fontFamily="monospace">{t}s</text>
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* Canvas — minWidth/minHeight:'100%' ensures no scrollbar when content fits */}
        <div
          ref={containerRef}
          style={vertical
            ? { position: 'relative', width: '100%', height: contentHeight, minHeight: '100%' }
            : { position: 'relative', height: TIMELINE_CANVAS_HEIGHT, width: contentWidth, minWidth: '100%' }
          }
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={handleContainerPointerUp}
        >
          {/* Vertical ruler — inside canvas so it scrolls with the blocks */}
          {vertical && (
            <div
              data-ruler="true"
              style={{ position: 'absolute', left: 0, top: 0, width: VERTICAL_RULER_WIDTH, height: '100%', borderRight: '1px solid rgba(255,255,255,0.07)', background: '#1a1b30', zIndex: 5, pointerEvents: 'none' }}
            >
              <svg width={VERTICAL_RULER_WIDTH} height="100%" style={{ display: 'block' }}>
                {ticks.map(({ t, pos }) => (
                  <g key={t}>
                    <line x1={VERTICAL_RULER_WIDTH - 6} y1={pos} x2={VERTICAL_RULER_WIDTH} y2={pos} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                    <text x={2} y={pos > 8 ? pos - 2 : pos + 9} fontSize={9} fill="rgba(255,255,255,0.5)" fontFamily="monospace">{t}s</text>
                  </g>
                ))}
              </svg>
            </div>
          )}

          <WaveformSVG vertical={vertical} blocks={blocks} pxPerSecond={pxPerSecond} width={contentWidth} height={TIMELINE_CANVAS_HEIGHT} />

          <DndContext
            sensors={sensors}
            collisionDetection={vertical ? verticalCollision : horizontalCollision}
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
                  vertical={vertical}
                  vertBlockWidth={vertBlockWidth}
                  onDoubleClick={(clicked) => {
                    if (selectedIds.has(clicked.id) && selectedIds.size > 1) {
                      setEditingBlocks(blocks.filter((b) => selectedIds.has(b.id)));
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
        </div>{/* end scrollRef */}

        {/* Vertical mode toolbar — sits to the right of the scrollbar */}
        {vertical && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center',
            padding: 3, borderLeft: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(14,15,26,0.7)',
          }}>
            {toolbarButtons}
          </div>
        )}
      </div>{/* end flex row wrapper */}

      {editingBlocks && (
        <BlockEditModal blocks={editingBlocks} onClose={() => setEditingBlocks(null)} />
      )}
    </div>
  );
});
