import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { arrayMove } from '@dnd-kit/sortable';
import { LS_GIST_CONFIG, LS_WORKOUTS } from '../utils/constants';

function loadWorkoutsFromLS() {
  try {
    const raw = localStorage.getItem(LS_WORKOUTS);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function loadGistConfigFromLS() {
  try {
    const raw = localStorage.getItem(LS_GIST_CONFIG);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function pushPast(state, blocks) {
  const past = [...state.past, blocks].slice(-30);
  return { past, future: [] };
}

const useStore = create((set, get) => ({
  workouts: loadWorkoutsFromLS(),
  activeWorkoutName: null,
  blocks: [],
  selectedIds: new Set(),
  clipboardBlocks: [],
  past: [],
  future: [],
  pxPerSecond: 20,
  resizeStep: 1,
  gistConfig: loadGistConfigFromLS(),
  syncStatus: 'idle',
  playState: 'idle',
  playStartWallTime: null,
  pausedDuration: 0,
  pausedAt: null,

  addBlock: (type) => set((s) => {
    const newBlock = { id: uuid(), type, duration: 10, label: '' };
    return { ...pushPast(s, s.blocks), blocks: [...s.blocks, newBlock] };
  }),

  removeBlocks: (ids) => set((s) => {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    return {
      ...pushPast(s, s.blocks),
      blocks: s.blocks.filter((b) => !idSet.has(b.id)),
      selectedIds: new Set(),
    };
  }),

  reorderBlocks: (fromIndex, toIndex) => set((s) => ({
    ...pushPast(s, s.blocks),
    blocks: arrayMove(s.blocks, fromIndex, toIndex),
  })),

  resizeBlock: (id, deltaSeconds) => set((s) => ({
    ...pushPast(s, s.blocks),
    blocks: s.blocks.map((b) =>
      b.id === id ? { ...b, duration: Math.max(1, Math.min(3600, b.duration + deltaSeconds)) } : b
    ),
  })),

  updateBlock: (id, patch) => set((s) => ({
    ...pushPast(s, s.blocks),
    blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
  })),

  setSelectedIds: (set_) => set({ selectedIds: set_ }),

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

  copySelection: () => set((s) => ({
    clipboardBlocks: s.blocks
      .filter((b) => s.selectedIds.has(b.id))
      .map((b) => ({ ...b, id: uuid() })),
  })),

  pasteBlocks: () => set((s) => {
    if (s.clipboardBlocks.length === 0) return {};
    const newBlocks = s.clipboardBlocks.map((b) => ({ ...b, id: uuid() }));
    const selected = s.blocks.map((b, i) => (s.selectedIds.has(b.id) ? i : -1)).filter((i) => i >= 0);
    const insertAfter = selected.length > 0 ? Math.max(...selected) : s.blocks.length - 1;
    const result = [...s.blocks];
    result.splice(insertAfter + 1, 0, ...newBlocks);
    return { ...pushPast(s, s.blocks), blocks: result, selectedIds: new Set(newBlocks.map((b) => b.id)) };
  }),

  undo: () => set((s) => {
    if (s.past.length === 0) return {};
    const past = [...s.past];
    const blocks = past.pop();
    return { blocks, past, future: [s.blocks, ...s.future].slice(0, 30) };
  }),

  redo: () => set((s) => {
    if (s.future.length === 0) return {};
    const [blocks, ...future] = s.future;
    return { blocks, future, past: [...s.past, s.blocks].slice(-30) };
  }),

  saveWorkout: (name) => set((s) => ({
    workouts: { ...s.workouts, [name]: { name, blocks: s.blocks } },
    activeWorkoutName: name,
  })),

  loadWorkout: (name) => set((s) => {
    const workout = s.workouts[name];
    if (!workout) return {};
    return { blocks: workout.blocks, activeWorkoutName: name, selectedIds: new Set(), past: [], future: [] };
  }),

  deleteWorkout: (name) => set((s) => {
    const { [name]: _, ...rest } = s.workouts;
    return { workouts: rest, activeWorkoutName: s.activeWorkoutName === name ? null : s.activeWorkoutName };
  }),

  renameWorkout: (oldName, newName) => set((s) => {
    const workout = s.workouts[oldName];
    if (!workout) return {};
    const { [oldName]: _, ...rest } = s.workouts;
    return {
      workouts: { ...rest, [newName]: { ...workout, name: newName } },
      activeWorkoutName: s.activeWorkoutName === oldName ? newName : s.activeWorkoutName,
    };
  }),

  setWorkouts: (map) => set({ workouts: map }),

  setGistConfig: (cfg) => set({ gistConfig: cfg }),

  setSyncStatus: (status) => set({ syncStatus: status }),

  setBlocks: (blocks) => set((s) => ({ ...pushPast(s, s.blocks), blocks })),

  setPxPerSecond: (px) => set({ pxPerSecond: Math.max(5, Math.min(100, px)) }),
  setResizeStep: (s) => set({ resizeStep: Math.max(1, Math.min(60, s)) }),

  setPlayState: (playState) => set({ playState }),
  setPlayStartWallTime: (t) => set({ playStartWallTime: t }),
  setPausedDuration: (d) => set({ pausedDuration: d }),
  setPausedAt: (t) => set({ pausedAt: t }),
}));

export default useStore;
