// Hex equivalent of oklch(0.65 0.22 35), the color work blocks render with
// when no custom color is set (see BlockItem.jsx). Kept as the one ground
// truth for the "default" work color so it isn't re-guessed elsewhere.
export const DEFAULT_WORK_COLOR = '#f84713';

function hexToRgb(hex) {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const bigint = parseInt(full, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

export function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// A block's color counts as "customized" only if it differs from the
// default — a block explicitly stamped with DEFAULT_WORK_COLOR must render
// identically to one with no color field at all, everywhere it's drawn.
export function customWorkColor(block) {
  return block.type === 'work' && block.color && block.color !== DEFAULT_WORK_COLOR ? block.color : null;
}
