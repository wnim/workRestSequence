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

export function blockStartTime(blocks, index) {
  let t = 0;
  for (let i = 0; i < index; i++) t += blocks[i].duration;
  return t;
}

export function blocksToTotalDuration(blocks) {
  return blocks.reduce((sum, b) => sum + b.duration, 0);
}
