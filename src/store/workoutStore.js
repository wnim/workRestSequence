import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { arrayMove } from '@dnd-kit/sortable';
import { LS_PX_PER_SECOND, LS_GIST_CONFIG, LS_WORKOUTS, LS_ACTIVE_WORKOUT } from '../utils/constants';
import { loopsToRuntime, loopsToSerialized, revalidateLoops, validateNewLoop } from '../utils/loops';

function loadPxPerSecond() {
  try { return JSON.parse(localStorage.getItem(LS_PX_PER_SECOND)) ?? 20; }
  catch { return 20; }
}

function loadWorkoutsFromLS() {
  try {
    const raw = localStorage.getItem(LS_WORKOUTS);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function loadActiveWorkout() {
  try {
    const name = localStorage.getItem(LS_ACTIVE_WORKOUT);
    if (!name) return { activeWorkoutName: null, blocks: [], loops: [], resizeStep: 1 };
    const workouts = loadWorkoutsFromLS();
    const workout = workouts[name];
    if (!workout) return { activeWorkoutName: null, blocks: [], loops: [], resizeStep: 1 };
    const blocks = workout.blocks.map(b => ({ ...b, id: uuid() }));
    const loops = loopsToRuntime(blocks, workout.loops ?? []);
    return { activeWorkoutName: name, blocks, loops, resizeStep: workout.resizeStep ?? 1 };
  } catch { return { activeWorkoutName: null, blocks: [], loops: [], resizeStep: 1 }; }
}

function loadGistConfigFromLS() {
  try {
    const raw = localStorage.getItem(LS_GIST_CONFIG);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// History lives outside Zustand state so mutations don't trigger re-renders.
let past = [];
let future = [];

function pushSnapshot({ blocks, loops }) {
  past = [...past, { blocks, loops }].slice(-50);
  future = [];
}

const useStore = create((set, get) => ({
  workouts: loadWorkoutsFromLS(),
  selectedIds: new Set(),
  clipboardBlocks: [],
  clipboardLoops: [],
  pxPerSecond: loadPxPerSecond(),
  ...loadActiveWorkout(),
  gistConfig: loadGistConfigFromLS(),
  syncStatus: 'idle',
  conflictData: null,
  playState: 'idle',
  playStartWallTime: null,
  pausedDuration: 0,
  pausedAt: null,

  addBlock: (type) => set((s) => {
    pushSnapshot({ blocks: s.blocks, loops: s.loops });
    const newBlock = { id: uuid(), type, duration: 10, label: '' };
    return { blocks: [...s.blocks, newBlock] };
  }),

  removeBlocks: (ids) => set((s) => {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    pushSnapshot({ blocks: s.blocks, loops: s.loops });
    const blocks = s.blocks.filter((b) => !idSet.has(b.id));
    return {
      blocks,
      loops: revalidateLoops(blocks, s.loops),
      selectedIds: new Set(),
    };
  }),

  reorderBlocks: (fromIndex, toIndex) => set((s) => {
    pushSnapshot({ blocks: s.blocks, loops: s.loops });
    const blocks = arrayMove(s.blocks, fromIndex, toIndex);
    return { blocks, loops: revalidateLoops(blocks, s.loops) };
  }),

  resizeBlock: (id, deltaSeconds) => set((s) => {
    pushSnapshot({ blocks: s.blocks, loops: s.loops });
    return {
      blocks: s.blocks.map((b) =>
        b.id === id ? { ...b, duration: Math.max(0.1, Math.min(3600, b.duration + deltaSeconds)) } : b
      ),
    };
  }),

  updateBlock: (id, patch) => set((s) => {
    pushSnapshot({ blocks: s.blocks, loops: s.loops });
    return { blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) };
  }),

  updateBlocks: (ids, patch) => set((s) => {
    pushSnapshot({ blocks: s.blocks, loops: s.loops });
    return { blocks: s.blocks.map((b) => (ids.has(b.id) ? { ...b, ...patch } : b)) };
  }),

  setSelectedIds: (set_) => set({ selectedIds: set_ }),

  selectAll: () => set((s) => ({ selectedIds: new Set(s.blocks.map((b) => b.id)) })),

  toggleSelected: (id) => set((s) => {
    const next = new Set(s.selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedIds: next };
  }),

  extendSelectionTo: (id, blocks) => set((s) => {
    const ids = s.selectedIds;
    if (ids.size === 0) return { selectedIds: new Set([id]) };
    const indices = blocks.map((b, i) => (ids.has(b.id) ? i : -1)).filter((i) => i >= 0);
    const targetIdx = blocks.findIndex((b) => b.id === id);
    const minIdx = Math.min(...indices, targetIdx);
    const maxIdx = Math.max(...indices, targetIdx);
    return { selectedIds: new Set(blocks.slice(minIdx, maxIdx + 1).map((b) => b.id)) };
  }),

  copySelection: () => set((s) => {
    const origToClip = new Map();
    const clipboardBlocks = s.blocks
      .filter((b) => s.selectedIds.has(b.id))
      .map((b) => { const newId = uuid(); origToClip.set(b.id, newId); return { ...b, id: newId }; });
    const clipboardLoops = s.loops
      .filter(loop => loop.blockIds.every(id => s.selectedIds.has(id)))
      .map(loop => ({ count: loop.count, clipboardBlockIds: loop.blockIds.map(id => origToClip.get(id)) }));
    return { clipboardBlocks, clipboardLoops };
  }),

  pasteBlocks: () => set((s) => {
    if (s.clipboardBlocks.length === 0) return {};
    const newBlocks = s.clipboardBlocks.map((b) => ({ ...b, id: uuid() }));
    const clipIdToNew = new Map(s.clipboardBlocks.map((cb, i) => [cb.id, newBlocks[i].id]));
    const selected = s.blocks.map((b, i) => (s.selectedIds.has(b.id) ? i : -1)).filter((i) => i >= 0);
    const insertAfter = selected.length > 0 ? Math.max(...selected) : s.blocks.length - 1;
    const result = [...s.blocks];
    result.splice(insertAfter + 1, 0, ...newBlocks);
    const pastedLoops = (s.clipboardLoops ?? []).map(cl => {
      const newIds = cl.clipboardBlockIds.map(cid => clipIdToNew.get(cid)).filter(Boolean);
      if (newIds.length !== cl.clipboardBlockIds.length) return null;
      return { id: uuid(), startBlockId: newIds[0], endBlockId: newIds[newIds.length - 1], blockIds: newIds, count: cl.count };
    }).filter(Boolean);
    pushSnapshot({ blocks: s.blocks, loops: s.loops });
    return { blocks: result, loops: revalidateLoops(result, [...s.loops, ...pastedLoops]), selectedIds: new Set(newBlocks.map((b) => b.id)) };
  }),

  undo: () => set((s) => {
    if (past.length === 0) return {};
    const next = [...past];
    const snapshot = next.pop();
    future = [{ blocks: s.blocks, loops: s.loops }, ...future].slice(0, 50);
    past = next;
    return { blocks: snapshot.blocks, loops: snapshot.loops };
  }),

  redo: () => set((s) => {
    if (future.length === 0) return {};
    const [snapshot, ...rest] = future;
    past = [...past, { blocks: s.blocks, loops: s.loops }].slice(-50);
    future = rest;
    return { blocks: snapshot.blocks, loops: snapshot.loops };
  }),

  saveWorkout: (name) => set((s) => {
    const serializedLoops = loopsToSerialized(s.blocks, s.loops);
    const workout = { name, blocks: s.blocks, loops: serializedLoops, resizeStep: s.resizeStep };
    const newWorkouts = { ...s.workouts, [name]: workout };
    localStorage.setItem(LS_ACTIVE_WORKOUT, name);
    localStorage.setItem(LS_WORKOUTS, JSON.stringify(newWorkouts));
    return { workouts: newWorkouts, activeWorkoutName: name };
  }),

  createWorkout: (name) => set((s) => {
    localStorage.setItem(LS_ACTIVE_WORKOUT, name);
    past = [];
    future = [];
    return { workouts: { ...s.workouts, [name]: { name, blocks: [], loops: [], resizeStep: s.resizeStep } }, activeWorkoutName: name, blocks: [], loops: [], selectedIds: new Set() };
  }),

  loadWorkout: (name) => set((s) => {
    const workout = s.workouts[name];
    if (!workout) return {};
    localStorage.setItem(LS_ACTIVE_WORKOUT, name);
    past = [];
    future = [];
    const blocks = workout.blocks.map(b => ({ ...b, id: uuid() }));
    const loops = loopsToRuntime(blocks, workout.loops ?? []);
    return { blocks, loops, resizeStep: workout.resizeStep ?? 1, activeWorkoutName: name, selectedIds: new Set() };
  }),

  deleteWorkout: (name) => set((s) => {
    const { [name]: _, ...rest } = s.workouts;
    const nextActive = s.activeWorkoutName === name ? null : s.activeWorkoutName;
    if (nextActive === null) localStorage.removeItem(LS_ACTIVE_WORKOUT);
    return { workouts: rest, activeWorkoutName: nextActive };
  }),

  renameWorkout: (oldName, newName) => set((s) => {
    const workout = s.workouts[oldName];
    if (!workout) return {};
    const { [oldName]: _, ...rest } = s.workouts;
    const nextActive = s.activeWorkoutName === oldName ? newName : s.activeWorkoutName;
    if (nextActive === newName) localStorage.setItem(LS_ACTIVE_WORKOUT, newName);
    return {
      workouts: { ...rest, [newName]: { ...workout, name: newName } },
      activeWorkoutName: nextActive,
    };
  }),

  setWorkouts: (map) => set((s) => {
    if (s.activeWorkoutName && map[s.activeWorkoutName]) {
      const workout = map[s.activeWorkoutName];
      past = [];
      future = [];
      const blocks = workout.blocks.map(b => ({ ...b, id: uuid() }));
      const loops = loopsToRuntime(blocks, workout.loops ?? []);
      return { workouts: map, blocks, loops };
    }
    return { workouts: map };
  }),

  setGistConfig: (cfg) => set({ gistConfig: cfg }),

  setSyncStatus: (status) => set({ syncStatus: status }),

  setConflictData: (data) => set({ conflictData: data }),

  setBlocks: (blocks) => set((s) => { pushSnapshot({ blocks: s.blocks, loops: s.loops }); return { blocks, loops: [] }; }),

  setBlocksAndLoops: (blocks, loops) => set((s) => { pushSnapshot({ blocks: s.blocks, loops: s.loops }); return { blocks, loops }; }),

  reorderBlocksFull: (blocks) => set((s) => {
    pushSnapshot({ blocks: s.blocks, loops: s.loops });
    return { blocks, loops: revalidateLoops(blocks, s.loops) };
  }),

  setPxPerSecond: (px) => set(() => {
    const clamped = Math.max(2, Math.min(100, px));
    try { localStorage.setItem(LS_PX_PER_SECOND, String(clamped)); } catch {}
    return { pxPerSecond: clamped };
  }),
  setResizeStep: (s) => set({ resizeStep: Math.max(0.1, Math.min(60, s)) }),

  ttsEnabled: false,
  setTtsEnabled: (v) => set({ ttsEnabled: v }),

  setPlayState: (playState) => set({ playState }),
  setPlayStartWallTime: (t) => set({ playStartWallTime: t }),
  setPausedDuration: (d) => set({ pausedDuration: d }),
  setPausedAt: (t) => set({ pausedAt: t }),

  createLoop: (selectedIds) => set((s) => {
    const validation = validateNewLoop(s.blocks, s.loops, selectedIds);
    if (!validation.ok) return {};
    const indices = s.blocks
      .map((b, i) => (selectedIds.has(b.id) ? i : -1))
      .filter(i => i >= 0);
    pushSnapshot({ blocks: s.blocks, loops: s.loops });
    const newLoop = {
      id: uuid(),
      startBlockId: s.blocks[indices[0]].id,
      endBlockId: s.blocks[indices[indices.length - 1]].id,
      blockIds: indices.map(i => s.blocks[i].id),
      count: 2,
    };
    return { loops: [...s.loops, newLoop] };
  }),

  updateLoopCount: (loopId, count) => set((s) => ({
    loops: s.loops.map(l => l.id === loopId ? { ...l, count: Math.max(2, Math.round(count)) } : l),
  })),

  deleteLoop: (loopId) => set((s) => ({
    loops: s.loops.filter(l => l.id !== loopId),
  })),

  // For testing: inspect and reset history without storing it in reactive state.
  getHistory: () => ({ past, future }),
  resetHistory: () => { past = []; future = []; },
}));

export default useStore;
