import { useState, useRef } from 'react';
import { getBlockBounds } from '../../utils/time';
import { BLOCK_TOP, LOOP_BRACKET_HEIGHT, BLOCK_HEIGHT } from '../../utils/constants';

const BRACKET_COLOR = 'oklch(0.75 0.14 200)';
const BRACKET_COLOR_FAINT = 'oklch(0.75 0.14 200 / 0.35)';
const BRACKET_COLOR_HOVER = 'oklch(0.75 0.14 200 / 0.55)';
const SELECTION_COLOR = 'oklch(0.75 0.15 200)';
const TOP = BLOCK_TOP - LOOP_BRACKET_HEIGHT - 2;
// Frame extends from bracket top through the gap (2px) and through the blocks
const FRAME_HEIGHT = LOOP_BRACKET_HEIGHT + 2 + BLOCK_HEIGHT;

// Left and right serif gradients: solid for 10px, then transparent
const SERIF_BG = (color) =>
  `linear-gradient(to bottom, ${color} 10px, transparent 10px) 0 0 / 1.5px 100% no-repeat, ` +
  `linear-gradient(to bottom, ${color} 10px, transparent 10px) 100% 0 / 1.5px 100% no-repeat`;

export function LoopBracket({ loop, blocks, pxPerSecond, onUpdateCount, onDelete, onSelect, isSelected }) {
  const [hovered, setHovered] = useState(false);

  const si = blocks.findIndex(b => b.id === loop.startBlockId);
  const ei = blocks.findIndex(b => b.id === loop.endBlockId);
  if (si < 0 || ei < 0 || si > ei) return null;

  const startBounds = getBlockBounds(blocks, si, pxPerSecond, false);
  const endBounds = getBlockBounds(blocks, ei, pxPerSecond, false);
  const left = startBounds.left;
  const width = endBounds.left + endBounds.width - left;

  const fillColor = hovered ? BRACKET_COLOR_HOVER : BRACKET_COLOR_FAINT;

  return (
    <div style={{
      position: 'absolute',
      top: TOP,
      left,
      width,
      height: LOOP_BRACKET_HEIGHT,
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      {/* Bracket fill + serif gradients + top border line, all in one div */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `${SERIF_BG(BRACKET_COLOR)}, ${fillColor}`,
          borderTop: `1.5px solid ${BRACKET_COLOR}`,
          borderRadius: '6px 6px 0 0',
          overflow: 'hidden',
          pointerEvents: 'auto',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          transition: 'background 0.1s',
        }}
        title="Click to select loop blocks"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onPointerDown={e => {
          e.stopPropagation();
          if (e.target === e.currentTarget) onSelect();
        }}
      >
        <CountBadge count={loop.count} onUpdate={onUpdateCount} />
        <DeleteButton onDelete={onDelete} />
      </div>

      {/* Selection frame — child of this container so (0,0) is the bracket top-left.
          Extends below through the gap and block area. Renders after fill so it's on top. */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: FRAME_HEIGHT,
          border: `2px solid ${SELECTION_COLOR}`,
          borderRadius: 6,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

function CountBadge({ count, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  function startEdit(e) {
    e.stopPropagation();
    setDraft(String(count));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && n >= 2) onUpdate(n);
    setEditing(false);
  }

  function handleKey(e) {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={2}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        style={{
          width: 38, height: 16, fontSize: 10, fontFamily: 'monospace',
          background: 'oklch(0.2 0.04 250)', border: '1px solid oklch(0.75 0.14 200)',
          borderRadius: 4, color: 'oklch(0.9 0.1 200)', textAlign: 'center',
          outline: 'none', padding: '0 2px',
        }}
      />
    );
  }

  return (
    <span
      title="Click to change round count"
      onPointerDown={e => e.stopPropagation()}
      onClick={startEdit}
      style={{
        background: 'oklch(0.25 0.05 250)',
        border: '1px solid oklch(0.75 0.14 200 / 0.6)',
        borderRadius: 10,
        color: 'oklch(0.85 0.1 200)',
        fontSize: 10, fontFamily: 'monospace', fontWeight: 600, lineHeight: 1,
        padding: '2px 6px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
      }}
    >
      ×{count}
    </span>
  );
}

function DeleteButton({ onDelete }) {
  return (
    <button
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onDelete(); }}
      title="Remove loop"
      style={{
        background: 'none', border: 'none', padding: '0 1px', cursor: 'pointer',
        color: 'oklch(0.65 0.08 200)', fontSize: 10, lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      ✕
    </button>
  );
}
