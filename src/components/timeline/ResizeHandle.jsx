import { useRef } from 'react';

export function ResizeHandle({ onResizeMove, onResizeEnd, vertical }) {
  const startRef = useRef(null);
  const isResizing = useRef(false);

  function handlePointerDown(e) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = vertical ? e.clientY : e.clientX;
    isResizing.current = true;
  }

  function handlePointerMove(e) {
    if (!isResizing.current) return;
    onResizeMove((vertical ? e.clientY : e.clientX) - startRef.current);
  }

  function handlePointerUp(e) {
    if (!isResizing.current) return;
    isResizing.current = false;
    onResizeEnd((vertical ? e.clientY : e.clientX) - startRef.current);
    startRef.current = null;
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={vertical ? {
        position: 'absolute',
        bottom: 0, left: 0, right: 0, height: 8,
        cursor: 'ns-resize', zIndex: 20,
        background: 'rgba(255,255,255,0.3)',
        borderRadius: '0 0 4px 4px',
      } : {
        position: 'absolute',
        right: 0, top: 0, bottom: 0, width: 8,
        cursor: 'ew-resize', zIndex: 20,
        background: 'rgba(255,255,255,0.3)',
        borderRadius: '0 4px 4px 0',
      }}
    />
  );
}
