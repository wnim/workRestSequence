import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayback } from '../../hooks/usePlayback';
import useStore from '../../store/workoutStore';

const INITIAL_STATE = {
  workouts: {},
  activeWorkoutName: null,
  blocks: [],
  selectedIds: new Set(),
  clipboardBlocks: [],
  past: [],
  future: [],
  pxPerSecond: 20,
  gistConfig: null,
  syncStatus: 'idle',
  playState: 'idle',
  playStartWallTime: null,
  pausedDuration: 0,
  pausedAt: null,
};

const TWO_BLOCKS = [
  { id: 'a', type: 'work', duration: 10, label: '' },
  { id: 'b', type: 'rest', duration: 5, label: '' },
];

beforeEach(() => {
  useStore.setState({ ...INITIAL_STATE, blocks: TWO_BLOCKS });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePlayback — state machine', () => {
  it('starts in idle', () => {
    const { result } = renderHook(() => usePlayback());
    expect(useStore.getState().playState).toBe('idle');
  });

  it('play() transitions to playing', () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play());
    expect(useStore.getState().playState).toBe('playing');
  });

  it('play() sets playStartWallTime', () => {
    const now = 1_000_000;
    vi.setSystemTime(now);
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play());
    expect(useStore.getState().playStartWallTime).toBe(now);
  });

  it('play() resets pausedDuration to 0', () => {
    useStore.setState({ ...INITIAL_STATE, blocks: TWO_BLOCKS, pausedDuration: 999 });
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play());
    expect(useStore.getState().pausedDuration).toBe(0);
  });

  it('pause() transitions to paused', () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play());
    act(() => result.current.pause());
    expect(useStore.getState().playState).toBe('paused');
  });

  it('pause() records pausedAt timestamp', () => {
    vi.setSystemTime(1_000_000);
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play());
    vi.setSystemTime(1_005_000);
    act(() => result.current.pause());
    expect(useStore.getState().pausedAt).toBe(1_005_000);
  });

  it('pause() is ignored when not playing', () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.pause());
    expect(useStore.getState().playState).toBe('idle');
  });

  it('resume() transitions back to playing', () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play());
    act(() => result.current.pause());
    act(() => result.current.resume());
    expect(useStore.getState().playState).toBe('playing');
  });

  it('resume() accumulates pausedDuration correctly', () => {
    vi.setSystemTime(0);
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play());
    vi.setSystemTime(3000);
    act(() => result.current.pause());
    vi.setSystemTime(8000);
    act(() => result.current.resume());
    expect(useStore.getState().pausedDuration).toBe(5000);
  });

  it('resume() does NOT reset playStartWallTime', () => {
    vi.setSystemTime(0);
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play());
    const startTime = useStore.getState().playStartWallTime;
    act(() => result.current.pause());
    vi.setSystemTime(2000);
    act(() => result.current.resume());
    expect(useStore.getState().playStartWallTime).toBe(startTime);
  });

  it('stop() resets all play state to idle', () => {
    vi.setSystemTime(0);
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play());
    act(() => result.current.pause());
    act(() => result.current.stop());
    const s = useStore.getState();
    expect(s.playState).toBe('idle');
    expect(s.playStartWallTime).toBeNull();
    expect(s.pausedDuration).toBe(0);
    expect(s.pausedAt).toBeNull();
  });

  it('togglePause pauses when playing', () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play());
    act(() => result.current.togglePause());
    expect(useStore.getState().playState).toBe('paused');
  });

  it('togglePause resumes when paused', () => {
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play());
    act(() => result.current.togglePause());
    act(() => result.current.togglePause());
    expect(useStore.getState().playState).toBe('playing');
  });

  it('play() is a no-op when blocks array is empty', () => {
    useStore.setState({ ...INITIAL_STATE, blocks: [] });
    const { result } = renderHook(() => usePlayback());
    act(() => result.current.play());
    expect(useStore.getState().playState).toBe('idle');
  });
});

describe('usePlayback — blockIndex / blockElapsedMs derivation', () => {
  it('starts at block 0 with 0 elapsed', () => {
    const { result } = renderHook(() => usePlayback());
    expect(result.current.blockIndex).toBe(0);
    expect(result.current.blockElapsedMs).toBe(0);
  });

  it('totalMs equals sum of block durations in ms', () => {
    const { result } = renderHook(() => usePlayback());
    expect(result.current.totalMs).toBe(15000);
  });
});
