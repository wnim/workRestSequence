import { useRef } from 'react';

export function ResizeHandle({ onResizeMove, onResizeEnd }) {
  const startXRef = useRef(null);
  const isResizing = useRef(false);

  function handlePointerDown(e) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    isResizing.current = true;
  }

  function handlePointerMove(e) {
    if (!isResizing.current) return;
    onResizeMove(e.clientX - startXRef.current);
  }

  function handlePointerUp(e) {
    if (!isResizing.current) return;
    isResizing.current = false;
    onResizeEnd(e.clientX - startXRef.current);
    startXRef.current = null;
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 8,
        cursor: 'ew-resize',
        zIndex: 20,
        background: 'rgba(255,255,255,0.3)',
        borderRadius: '0 4px 4px 0',
      }}
    />
  );
}
