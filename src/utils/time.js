export function msToStopwatch(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function msToDisplay(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

import { BLOCK_TOP, BLOCK_HEIGHT, VERTICAL_RULER_WIDTH } from './constants';

// Returns the CSS rect for a block in horizontal or vertical mode.
// durationOverride: pass snappedDuration during resize.
// vertBlockWidth: dynamic block width for vertical mode (computed from container width).
export function getBlockBounds(blocks, index, pxPerSecond, vertical, durationOverride, vertBlockWidth = 260) {
  const start = blockStartTime(blocks, index);
  const duration = durationOverride ?? blocks[index].duration;
  if (vertical) {
    return {
      left: VERTICAL_RULER_WIDTH,
      top: start * pxPerSecond,
      right: VERTICAL_RULER_WIDTH + vertBlockWidth,
      bottom: (start + duration) * pxPerSecond,
      width: vertBlockWidth,
      height: Math.max(4, duration * pxPerSecond),
    };
  }
  return {
    left: start * pxPerSecond,
    top: BLOCK_TOP,
    right: (start + duration) * pxPerSecond,
    bottom: BLOCK_TOP + BLOCK_HEIGHT,
    width: Math.max(4, duration * pxPerSecond),
    height: BLOCK_HEIGHT,
  };
}

export function blockStartTime(blocks, index) {
  let t = 0;
  for (let i = 0; i < index; i++) t += blocks[i].duration;
  return t;
}

export function blocksToTotalDuration(blocks) {
  return blocks.reduce((sum, b) => sum + b.duration, 0);
}
