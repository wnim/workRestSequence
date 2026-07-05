import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaybackOverlay } from '../../components/playback/PlaybackOverlay';
import useStore from '../../store/workoutStore';

const BLOCKS = [
  { id: 'a', type: 'work', duration: 10, label: 'Kegels' },
  { id: 'b', type: 'rest', duration: 5, label: '' },
];

const INITIAL_STATE = {
  workouts: {},
  activeWorkoutName: null,
  blocks: BLOCKS,
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

function makePlayback(overrides = {}) {
  return {
    currentPositionMs: 0,
    blockIndex: 0,
    blockElapsedMs: 0,
    totalMs: 15000,
    togglePause: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => useStore.setState(INITIAL_STATE));

describe('PlaybackOverlay', () => {
  it('returns null when playState is idle', () => {
    const { container } = render(<PlaybackOverlay playback={makePlayback()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when playState is playing', () => {
    useStore.setState({ ...INITIAL_STATE, playState: 'playing' });
    render(<PlaybackOverlay playback={makePlayback()} />);
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('renders when playState is paused', () => {
    useStore.setState({ ...INITIAL_STATE, playState: 'paused' });
    render(<PlaybackOverlay playback={makePlayback()} />);
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
  });

  it('shows block label when present', () => {
    useStore.setState({ ...INITIAL_STATE, playState: 'playing' });
    render(<PlaybackOverlay playback={makePlayback({ blockIndex: 0 })} />);
    expect(screen.getByText('Kegels')).toBeInTheDocument();
  });

  it('shows "Rest" when block has no label and type is rest', () => {
    useStore.setState({ ...INITIAL_STATE, playState: 'playing' });
    render(<PlaybackOverlay playback={makePlayback({ blockIndex: 1, blockElapsedMs: 0 })} />);
    expect(screen.getByText('Rest')).toBeInTheDocument();
  });

  it('displays block counter X / N', () => {
    useStore.setState({ ...INITIAL_STATE, playState: 'playing' });
    render(<PlaybackOverlay playback={makePlayback({ blockIndex: 0 })} />);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('countdown shows ceil of remaining seconds', () => {
    useStore.setState({ ...INITIAL_STATE, playState: 'playing' });
    // blockIndex 0 = 10s block, elapsed 3500ms → remaining 6500ms → ceil = 7
    render(<PlaybackOverlay playback={makePlayback({ blockIndex: 0, blockElapsedMs: 3500 })} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('calls togglePause when Pause button clicked', async () => {
    const togglePause = vi.fn();
    useStore.setState({ ...INITIAL_STATE, playState: 'playing' });
    render(<PlaybackOverlay playback={makePlayback({ togglePause })} />);
    await userEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(togglePause).toHaveBeenCalledOnce();
  });

  it('calls stop when Stop button clicked', async () => {
    const stop = vi.fn();
    useStore.setState({ ...INITIAL_STATE, playState: 'playing' });
    render(<PlaybackOverlay playback={makePlayback({ stop })} />);
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(stop).toHaveBeenCalledOnce();
  });
});
