import { BLOCK_TOP, BLOCK_HEIGHT } from '../../utils/constants';

const CENTER_Y = BLOCK_TOP + BLOCK_HEIGHT / 2;

function buildPath(blocks, pxPerSecond) {
  if (blocks.length === 0) return '';
  let x = 0;
  let d = `M 0 ${CENTER_Y}`;
  for (const b of blocks) {
    x += b.duration * pxPerSecond;
    d += ` H ${x}`;
  }
  return d;
}

export function WaveformSVG({ blocks, pxPerSecond, width, height, vertical }) {
  if (vertical) return null;
  const path = buildPath(blocks, pxPerSecond);
  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}
    >
      {path && (
        <path
          d={path}
          fill="none"
          stroke="var(--color-waveform)"
          strokeWidth={1}
          opacity={0.2}
        />
      )}
    </svg>
  );
}
