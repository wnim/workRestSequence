import { useRef, useEffect, useCallback } from 'react';
import { blocksToTotalDuration } from '../../utils/time';

function buildPath(blocks, scale, height) {
  if (blocks.length === 0) return '';
  const HIGH_Y = height * 0.2;
  const LOW_Y = height * 0.85;
  let x = 0;
  let y = blocks[0].type === 'work' ? HIGH_Y : LOW_Y;
  let d = `M 0 ${y}`;
  for (const b of blocks) {
    const targetY = b.type === 'work' ? HIGH_Y : LOW_Y;
    if (targetY !== y) { d += ` V ${targetY}`; y = targetY; }
    x += b.duration * scale;
    d += ` H ${x}`;
  }
  return d;
}

export function WaveformStrip({ blocks, currentPositionMs, onScrubStart, onScrubMove, onScrubEnd }) {
  const totalSec = blocksToTotalDuration(blocks);
  const height = 40;
  const wrapperRef = useRef(null);
  const isDragging = useRef(false);
  const lastMs = useRef(0);

  const getMs = useCallback((e) => {
    const rect = wrapperRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return fraction * totalSec * 1000;
  }, [totalSec]);

  useEffect(() => {
    if (!onScrubMove) return;
    const onMove = (e) => {
      if (!isDragging.current) return;
      const ms = getMs(e);
      lastMs.current = ms;
      onScrubMove(ms);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      onScrubEnd?.(lastMs.current);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [getMs, onScrubMove, onScrubEnd]);

  const handleMouseDown = onScrubStart ? (e) => {
    const ms = getMs(e);
    lastMs.current = ms;
    isDragging.current = true;
    onScrubStart();
    onScrubMove?.(ms);
  } : undefined;

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', width: '100%', height, background: 'rgba(0,0,0,0.3)', cursor: onScrubStart ? 'pointer' : undefined }}
      onMouseDown={handleMouseDown}
    >
      <svg
        width="100%"
        height={height}
        preserveAspectRatio="none"
        viewBox={`0 0 ${totalSec || 1} ${height}`}
        style={{ display: 'block' }}
      >
        <path
          d={buildPath(blocks, 1, height)}
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <rect
          x={(currentPositionMs / 1000) || 0}
          y={0}
          width={totalSec / 200}
          height={height}
          fill="white"
          opacity={0.2}
        />
        <line
          x1={(currentPositionMs / 1000) || 0}
          y1={0}
          x2={(currentPositionMs / 1000) || 0}
          y2={height}
          stroke="white"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
