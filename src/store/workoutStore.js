import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { arrayMove } from '@dnd-kit/sortable';
import { LS_GIST_CONFIG, LS_WORKOUTS, LS_ACTIVE_WORKOUT } from '../utils/constants';

function loadWorkoutsFromLS() {
  try {
    const raw = localStorage.getItem(LS_WORKOUTS);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function loadActiveWorkout() {
  try {
    const name = localStorage.getItem(LS_ACTIVE_WORKOUT);
    if (!name) return { activeWorkoutName: null, blocks: [], resizeStep: 1 };
    const workouts = loadWorkoutsFromLS();
    const workout = workouts[name];
    if (!workout) return { activeWorkoutName: null, blocks: [], resizeStep: 1 };
    return { activeWorkoutName: name, blocks: workout.blocks, resizeStep: workout.resizeStep ?? 1 };
  } catch { return { activeWorkoutName: null, blocks: [], resizeStep: 1 }; }
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

function pushPast(blocks) {
  past = [...past, blocks].slice(-50);
  future = [];
}

const useStore = create((set, get) => ({
  workouts: loadWorkoutsFromLS(),
  ...loadActiveWorkout(),
  selectedIds: new Set(),
  clipboardBlocks: [],
  pxPerSecond: 20,
  gistConfig: loadGistConfigFromLS(),
  syncStatus: 'idle',
  playState: 'idle',
  playStartWallTime: null,
  pausedDuration: 0,
  pausedAt: null,

  addBlock: (type) => set((s) => {
    pushPast(s.blocks);
    const newBlock = { id: uuid(), type, duration: 10, label: '' };
    return { blocks: [...s.blocks, newBlock] };
  }),

  removeBlocks: (ids) => set((s) => {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    pushPast(s.blocks);
    return {
      blocks: s.blocks.filter((b) => !idSet.has(b.id)),
      selectedIds: new Set(),
    };
  }),

  reorderBlocks: (fromIndex, toIndex) => set((s) => {
    pushPast(s.blocks);
    return { blocks: arrayMove(s.blocks, fromIndex, toIndex) };
  }),

  resizeBlock: (id, deltaSeconds) => set((s) => {
    pushPast(s.blocks);
    return {
      blocks: s.blocks.map((b) =>
        b.id === id ? { ...b, duration: Math.max(0.1, Math.min(3600, b.duration + deltaSeconds)) } : b
      ),
    };
  }),

  updateBlock: (id, patch) => set((s) => {
    pushPast(s.blocks);
    return { blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) };
  }),

  updateBlocks: (ids, patch) => set((s) => {
    pushPast(s.blocks);
    return { blocks: s.blocks.map((b) => (ids.has(b.id) ? { ...b, ...patch } : b)) };
  }),

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
    pushPast(s.blocks);
    return { blocks: result, selectedIds: new Set(newBlocks.map((b) => b.id)) };
  }),

  undo: () => set((s) => {
    if (past.length === 0) return {};
    const next = [...past];
    const blocks = next.pop();
    future = [s.blocks, ...future].slice(0, 50);
    past = next;
    return { blocks };
  }),

  redo: () => set((s) => {
    if (future.length === 0) return {};
    const [blocks, ...rest] = future;
    past = [...past, s.blocks].slice(-50);
    future = rest;
    return { blocks };
  }),

  saveWorkout: (name) => set((s) => {
    localStorage.setItem(LS_ACTIVE_WORKOUT, name);
    return { workouts: { ...s.workouts, [name]: { name, blocks: s.blocks, resizeStep: s.resizeStep } }, activeWorkoutName: name };
  }),

  loadWorkout: (name) => set((s) => {
    const workout = s.workouts[name];
    if (!workout) return {};
    localStorage.setItem(LS_ACTIVE_WORKOUT, name);
    past = [];
    future = [];
    return { blocks: workout.blocks, resizeStep: workout.resizeStep ?? 1, activeWorkoutName: name, selectedIds: new Set() };
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

  setWorkouts: (map) => set({ workouts: map }),

  setGistConfig: (cfg) => set({ gistConfig: cfg }),

  setSyncStatus: (status) => set({ syncStatus: status }),

  setBlocks: (blocks) => set((s) => { pushPast(s.blocks); return { blocks }; }),

  setPxPerSecond: (px) => set({ pxPerSecond: Math.max(2, Math.min(100, px)) }),
  setResizeStep: (s) => set({ resizeStep: Math.max(0.1, Math.min(60, s)) }),

  setPlayState: (playState) => set({ playState }),
  setPlayStartWallTime: (t) => set({ playStartWallTime: t }),
  setPausedDuration: (d) => set({ pausedDuration: d }),
  setPausedAt: (t) => set({ pausedAt: t }),

  // For testing: inspect and reset history without storing it in reactive state.
  getHistory: () => ({ past, future }),
  resetHistory: () => { past = []; future = []; },
}));

export default useStore;
