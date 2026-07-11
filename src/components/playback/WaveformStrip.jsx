import { useRef, useEffect, useCallback } from 'react';
import { blocksToTotalDuration } from '../../utils/time';

function buildSegments(blocks) {
  const segs = [];
  let t = 0;
  for (const b of blocks) {
    segs.push({ x: t, width: b.duration, type: b.type });
    t += b.duration;
  }
  return segs;
}

export function WaveformStrip({ blocks, currentPositionMs, onScrubStart, onScrubMove, onScrubEnd }) {
  const totalSec = blocksToTotalDuration(blocks);
  const height = 44;
  const wrapperRef = useRef(null);
  const isDragging = useRef(false);
  const lastMs = useRef(0);
  const currentSec = (currentPositionMs || 0) / 1000;
  const playFraction = totalSec > 0 ? currentSec / totalSec : 0;

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

  const segments = buildSegments(blocks);
  const BAR_TOP = 12;
  const BAR_BOT = 12;
  const barH = height - BAR_TOP - BAR_BOT;

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: 'rgba(0,0,0,0.25)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        cursor: onScrubStart ? 'pointer' : undefined,
      }}
      onMouseDown={handleMouseDown}
    >
      <svg
        width="100%"
        height={height}
        preserveAspectRatio="none"
        viewBox={`0 0 ${totalSec || 1} ${height}`}
        style={{ display: 'block' }}
      >
        {segments.map((seg, i) => {
          const isWork = seg.type === 'work';
          const fullyPlayed = currentSec >= seg.x + seg.width;
          const partialFrac = currentSec > seg.x && currentSec < seg.x + seg.width
            ? (currentSec - seg.x) / seg.width : 0;

          return (
            <g key={i}>
              {/* Unplayed portion */}
              <rect
                x={seg.x} y={BAR_TOP}
                width={seg.width} height={barH}
                fill={isWork ? 'rgba(220,95,40,0.28)' : 'rgba(90,130,210,0.18)'}
                rx={0}
              />
              {/* Played portion */}
              {(fullyPlayed || partialFrac > 0) && (
                <rect
                  x={seg.x} y={BAR_TOP}
                  width={fullyPlayed ? seg.width : seg.width * partialFrac}
                  height={barH}
                  fill={isWork ? 'rgba(235,105,45,0.88)' : 'rgba(110,155,235,0.6)'}
                />
              )}
            </g>
          );
        })}

        {/* Block dividers */}
        {segments.slice(1).map((seg, i) => (
          <line
            key={i}
            x1={seg.x} y1={BAR_TOP - 2}
            x2={seg.x} y2={height - BAR_BOT + 2}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Playhead line */}
        <line
          x1={currentSec} y1={0}
          x2={currentSec} y2={height}
          stroke="white"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          opacity={0.9}
        />
      </svg>

      {/* Playhead handle — CSS circle avoids SVG distortion */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `${playFraction * 100}%`,
          transform: 'translate(-50%, -50%)',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
