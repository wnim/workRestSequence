import { v4 as uuid } from 'uuid';

export function flattenBlocks(blocks, loops) {
  if (!loops || loops.length === 0) return blocks;
  const blockById = new Map(blocks.map(b => [b.id, b]));
  const sorted = [...loops]
    .map(loop => ({ loop, si: blocks.findIndex(b => b.id === loop.startBlockId) }))
    .filter(({ si }) => si >= 0)
    .sort((a, b) => a.si - b.si);
  const result = [];
  let i = 0;
  for (const { loop, si } of sorted) {
    const ei = blocks.findIndex(b => b.id === loop.endBlockId);
    if (ei < si) continue;
    while (i < si) { result.push(blocks[i]); i++; }
    const slice = loop.blockIds.map(id => blockById.get(id)).filter(Boolean);
    for (let r = 0; r < loop.count; r++) result.push(...slice);
    i = ei + 1;
  }
  while (i < blocks.length) { result.push(blocks[i]); i++; }
  return result;
}

export function revalidateLoops(blocks, loops) {
  return loops
    .map(loop => {
      const si = blocks.findIndex(b => b.id === loop.startBlockId);
      const ei = blocks.findIndex(b => b.id === loop.endBlockId);
      if (si < 0 || ei < 0 || si > ei) return null;
      return { ...loop, blockIds: blocks.slice(si, ei + 1).map(b => b.id) };
    })
    .filter(Boolean);
}

export function loopsToRuntime(blocks, serializedLoops) {
  if (!serializedLoops || serializedLoops.length === 0) return [];
  return serializedLoops
    .filter(l => l.startIndex >= 0 && l.endIndex < blocks.length && l.startIndex <= l.endIndex)
    .map(l => ({
      id: uuid(),
      startBlockId: blocks[l.startIndex].id,
      endBlockId: blocks[l.endIndex].id,
      blockIds: blocks.slice(l.startIndex, l.endIndex + 1).map(b => b.id),
      count: l.count,
    }));
}

export function loopsToSerialized(blocks, runtimeLoops) {
  return runtimeLoops
    .map(l => ({
      startIndex: blocks.findIndex(b => b.id === l.startBlockId),
      endIndex: blocks.findIndex(b => b.id === l.endBlockId),
      count: l.count,
    }))
    .filter(l => l.startIndex >= 0 && l.endIndex >= 0 && l.startIndex <= l.endIndex);
}

export function isContiguous(blocks, selectedIds) {
  if (selectedIds.size === 0) return false;
  const indices = blocks
    .map((b, i) => (selectedIds.has(b.id) ? i : -1))
    .filter(i => i >= 0);
  if (indices.length === 0) return false;
  return indices[indices.length - 1] - indices[0] + 1 === indices.length;
}

export function loopContainingBlock(runtimeLoops, blocks, blockId) {
  const idx = blocks.findIndex(b => b.id === blockId);
  if (idx < 0) return null;
  return runtimeLoops.find(loop => {
    const si = blocks.findIndex(b => b.id === loop.startBlockId);
    const ei = blocks.findIndex(b => b.id === loop.endBlockId);
    return idx >= si && idx <= ei;
  }) ?? null;
}

export function validateNewLoop(blocks, runtimeLoops, selectedIds) {
  if (selectedIds.size < 1) return { ok: false, reason: 'No blocks selected' };
  if (!isContiguous(blocks, selectedIds)) return { ok: false, reason: 'Selection must be contiguous' };
  const indices = blocks
    .map((b, i) => (selectedIds.has(b.id) ? i : -1))
    .filter(i => i >= 0);
  const si = indices[0];
  const ei = indices[indices.length - 1];
  for (const loop of runtimeLoops) {
    const lsi = blocks.findIndex(b => b.id === loop.startBlockId);
    const lei = blocks.findIndex(b => b.id === loop.endBlockId);
    if (lsi < 0 || lei < 0) continue;
    const overlaps = si <= lei && ei >= lsi;
    if (overlaps) return { ok: false, reason: 'Selection overlaps an existing loop' };
  }
  return { ok: true, reason: null };
}
