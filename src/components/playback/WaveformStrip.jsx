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

export function WaveformStrip({ blocks, currentPositionMs }) {
  const totalSec = blocksToTotalDuration(blocks);
  const height = 40;

  return (
    <div style={{ position: 'relative', width: '100%', height, background: 'rgba(0,0,0,0.3)' }}>
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
          opacity={0.8}
        />
      </svg>
    </div>
  );
}
