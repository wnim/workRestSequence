import { describe, it, expect, beforeEach } from 'vitest';
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

beforeEach(() => {
  useStore.setState(INITIAL_STATE);
});

// ---------------------------------------------------------------------------
// addBlock
// ---------------------------------------------------------------------------
describe('addBlock', () => {
  it('appends a work block with default 10s duration', () => {
    useStore.getState().addBlock('work');
    const { blocks } = useStore.getState();
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('work');
    expect(blocks[0].duration).toBe(10);
    expect(blocks[0].label).toBe('');
    expect(typeof blocks[0].id).toBe('string');
  });

  it('appends a rest block', () => {
    useStore.getState().addBlock('rest');
    expect(useStore.getState().blocks[0].type).toBe('rest');
  });

  it('pushes to past history', () => {
    useStore.getState().addBlock('work');
    expect(useStore.getState().past).toHaveLength(1);
    expect(useStore.getState().past[0]).toEqual([]);
  });

  it('clears future on add', () => {
    useStore.setState({ future: [[{ id: 'x', type: 'work', duration: 5, label: '' }]] });
    useStore.getState().addBlock('work');
    expect(useStore.getState().future).toHaveLength(0);
  });

  it('assigns unique IDs to each block', () => {
    useStore.getState().addBlock('work');
    useStore.getState().addBlock('work');
    const { blocks } = useStore.getState();
    expect(blocks[0].id).not.toBe(blocks[1].id);
  });
});

// ---------------------------------------------------------------------------
// removeBlocks
// ---------------------------------------------------------------------------
describe('removeBlocks', () => {
  beforeEach(() => {
    useStore.setState({
      ...INITIAL_STATE,
      blocks: [
        { id: 'a', type: 'work', duration: 10, label: '' },
        { id: 'b', type: 'rest', duration: 5, label: '' },
        { id: 'c', type: 'work', duration: 20, label: '' },
      ],
    });
  });

  it('removes blocks by Set of IDs', () => {
    useStore.getState().removeBlocks(new Set(['a', 'c']));
    const { blocks } = useStore.getState();
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe('b');
  });

  it('also accepts an array of IDs', () => {
    useStore.getState().removeBlocks(['b']);
    const { blocks } = useStore.getState();
    expect(blocks.map((b) => b.id)).toEqual(['a', 'c']);
  });

  it('clears selectedIds after removal', () => {
    useStore.setState({ selectedIds: new Set(['a']) });
    useStore.getState().removeBlocks(new Set(['a']));
    expect(useStore.getState().selectedIds.size).toBe(0);
  });

  it('pushes current blocks to past', () => {
    useStore.getState().removeBlocks(new Set(['a']));
    expect(useStore.getState().past).toHaveLength(1);
    expect(useStore.getState().past[0]).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// reorderBlocks
// ---------------------------------------------------------------------------
describe('reorderBlocks', () => {
  beforeEach(() => {
    useStore.setState({
      ...INITIAL_STATE,
      blocks: [
        { id: 'a', type: 'work', duration: 10, label: '' },
        { id: 'b', type: 'rest', duration: 5, label: '' },
        { id: 'c', type: 'work', duration: 20, label: '' },
      ],
    });
  });

  it('moves a block from one index to another', () => {
    useStore.getState().reorderBlocks(0, 2);
    const ids = useStore.getState().blocks.map((b) => b.id);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('moving to same index is a no-op for order', () => {
    useStore.getState().reorderBlocks(1, 1);
    const ids = useStore.getState().blocks.map((b) => b.id);
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// resizeBlock
// ---------------------------------------------------------------------------
describe('resizeBlock', () => {
  beforeEach(() => {
    useStore.setState({
      ...INITIAL_STATE,
      blocks: [{ id: 'a', type: 'work', duration: 10, label: '' }],
    });
  });

  it('adds deltaSeconds to block duration', () => {
    useStore.getState().resizeBlock('a', 5);
    expect(useStore.getState().blocks[0].duration).toBe(15);
  });

  it('subtracts negative delta', () => {
    useStore.getState().resizeBlock('a', -3);
    expect(useStore.getState().blocks[0].duration).toBe(7);
  });

  it('clamps minimum to 1s', () => {
    useStore.getState().resizeBlock('a', -100);
    expect(useStore.getState().blocks[0].duration).toBe(1);
  });

  it('clamps maximum to 3600s', () => {
    useStore.getState().resizeBlock('a', 5000);
    expect(useStore.getState().blocks[0].duration).toBe(3600);
  });

  it('does not affect other blocks', () => {
    useStore.setState({
      ...INITIAL_STATE,
      blocks: [
        { id: 'a', type: 'work', duration: 10, label: '' },
        { id: 'b', type: 'rest', duration: 5, label: '' },
      ],
    });
    useStore.getState().resizeBlock('a', 3);
    expect(useStore.getState().blocks[1].duration).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// updateBlock
// ---------------------------------------------------------------------------
describe('updateBlock', () => {
  beforeEach(() => {
    useStore.setState({
      ...INITIAL_STATE,
      blocks: [{ id: 'a', type: 'work', duration: 10, label: '' }],
    });
  });

  it('updates label', () => {
    useStore.getState().updateBlock('a', { label: 'Kegels' });
    expect(useStore.getState().blocks[0].label).toBe('Kegels');
  });

  it('updates type', () => {
    useStore.getState().updateBlock('a', { type: 'rest' });
    expect(useStore.getState().blocks[0].type).toBe('rest');
  });

  it('updates duration', () => {
    useStore.getState().updateBlock('a', { duration: 30 });
    expect(useStore.getState().blocks[0].duration).toBe(30);
  });

  it('patches only specified fields', () => {
    useStore.getState().updateBlock('a', { label: 'Test' });
    const b = useStore.getState().blocks[0];
    expect(b.type).toBe('work');
    expect(b.duration).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------
describe('selection', () => {
  const blocks = [
    { id: 'a', type: 'work', duration: 10, label: '' },
    { id: 'b', type: 'rest', duration: 5, label: '' },
    { id: 'c', type: 'work', duration: 20, label: '' },
    { id: 'd', type: 'rest', duration: 8, label: '' },
  ];

  beforeEach(() => useStore.setState({ ...INITIAL_STATE, blocks }));

  it('setSelectedIds replaces selection', () => {
    useStore.getState().setSelectedIds(new Set(['a', 'c']));
    expect(useStore.getState().selectedIds).toEqual(new Set(['a', 'c']));
  });

  it('toggleSelected adds unselected id', () => {
    useStore.getState().toggleSelected('b');
    expect(useStore.getState().selectedIds.has('b')).toBe(true);
  });

  it('toggleSelected removes already-selected id', () => {
    useStore.setState({ ...INITIAL_STATE, blocks, selectedIds: new Set(['b']) });
    useStore.getState().toggleSelected('b');
    expect(useStore.getState().selectedIds.has('b')).toBe(false);
  });

  it('extendSelectionTo selects range from existing selection to target', () => {
    useStore.setState({ ...INITIAL_STATE, blocks, selectedIds: new Set(['a']) });
    useStore.getState().extendSelectionTo('c', blocks);
    expect(useStore.getState().selectedIds).toEqual(new Set(['a', 'b', 'c']));
  });

  it('extendSelectionTo works in reverse order', () => {
    useStore.setState({ ...INITIAL_STATE, blocks, selectedIds: new Set(['d']) });
    useStore.getState().extendSelectionTo('b', blocks);
    expect(useStore.getState().selectedIds).toEqual(new Set(['b', 'c', 'd']));
  });

  it('extendSelectionTo with empty selection selects only target', () => {
    useStore.getState().extendSelectionTo('c', blocks);
    expect(useStore.getState().selectedIds).toEqual(new Set(['c']));
  });
});

// ---------------------------------------------------------------------------
// Copy / Paste
// ---------------------------------------------------------------------------
describe('copySelection / pasteBlocks', () => {
  const blocks = [
    { id: 'a', type: 'work', duration: 10, label: 'First' },
    { id: 'b', type: 'rest', duration: 5, label: '' },
    { id: 'c', type: 'work', duration: 20, label: '' },
  ];

  beforeEach(() => useStore.setState({ ...INITIAL_STATE, blocks }));

  it('copySelection stores selected blocks with new IDs', () => {
    useStore.setState({ ...INITIAL_STATE, blocks, selectedIds: new Set(['a', 'c']) });
    useStore.getState().copySelection();
    const { clipboardBlocks } = useStore.getState();
    expect(clipboardBlocks).toHaveLength(2);
    expect(clipboardBlocks[0].label).toBe('First');
    expect(clipboardBlocks[0].id).not.toBe('a');
    expect(clipboardBlocks[1].id).not.toBe('c');
  });

  it('pasteBlocks inserts after last selected block with fresh IDs', () => {
    useStore.setState({
      ...INITIAL_STATE,
      blocks,
      selectedIds: new Set(['a']),
      clipboardBlocks: [{ id: 'x1', type: 'work', duration: 7, label: 'Pasted' }],
    });
    useStore.getState().pasteBlocks();
    const { blocks: result } = useStore.getState();
    expect(result).toHaveLength(4);
    expect(result[1].label).toBe('Pasted');
    expect(result[1].id).not.toBe('x1');
  });

  it('pasteBlocks appends at end when nothing selected', () => {
    useStore.setState({
      ...INITIAL_STATE,
      blocks,
      clipboardBlocks: [{ id: 'x1', type: 'rest', duration: 3, label: '' }],
    });
    useStore.getState().pasteBlocks();
    const { blocks: result } = useStore.getState();
    expect(result).toHaveLength(4);
    expect(result[3].type).toBe('rest');
  });

  it('pasteBlocks selects the newly pasted blocks', () => {
    useStore.setState({
      ...INITIAL_STATE,
      blocks,
      clipboardBlocks: [{ id: 'x1', type: 'work', duration: 10, label: '' }],
    });
    useStore.getState().pasteBlocks();
    const { selectedIds, blocks: result } = useStore.getState();
    expect(selectedIds.size).toBe(1);
    expect(selectedIds.has(result[result.length - 1].id)).toBe(true);
  });

  it('pasteBlocks is a no-op when clipboard is empty', () => {
    useStore.getState().pasteBlocks();
    expect(useStore.getState().blocks).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Undo / Redo
// ---------------------------------------------------------------------------
describe('undo / redo', () => {
  it('undo restores previous block state', () => {
    useStore.getState().addBlock('work');
    useStore.getState().addBlock('rest');
    expect(useStore.getState().blocks).toHaveLength(2);
    useStore.getState().undo();
    expect(useStore.getState().blocks).toHaveLength(1);
    useStore.getState().undo();
    expect(useStore.getState().blocks).toHaveLength(0);
  });

  it('redo re-applies undone change', () => {
    useStore.getState().addBlock('work');
    useStore.getState().undo();
    expect(useStore.getState().blocks).toHaveLength(0);
    useStore.getState().redo();
    expect(useStore.getState().blocks).toHaveLength(1);
  });

  it('undo is a no-op when history is empty', () => {
    useStore.getState().undo();
    expect(useStore.getState().blocks).toHaveLength(0);
  });

  it('redo is a no-op when future is empty', () => {
    useStore.getState().addBlock('work');
    useStore.getState().redo();
    expect(useStore.getState().blocks).toHaveLength(1);
  });

  it('performing an action clears redo future', () => {
    useStore.getState().addBlock('work');
    useStore.getState().undo();
    useStore.getState().addBlock('rest');
    expect(useStore.getState().future).toHaveLength(0);
  });

  it('caps past history at 30 entries', () => {
    for (let i = 0; i < 35; i++) useStore.getState().addBlock('work');
    expect(useStore.getState().past.length).toBeLessThanOrEqual(30);
  });
});

// ---------------------------------------------------------------------------
// Workout CRUD
// ---------------------------------------------------------------------------
describe('workout CRUD', () => {
  const blocks = [
    { id: 'a', type: 'work', duration: 10, label: '' },
    { id: 'b', type: 'rest', duration: 5, label: '' },
  ];

  beforeEach(() => useStore.setState({ ...INITIAL_STATE, blocks }));

  it('saveWorkout stores current blocks under name', () => {
    useStore.getState().saveWorkout('Morning');
    expect(useStore.getState().workouts['Morning'].blocks).toEqual(blocks);
    expect(useStore.getState().activeWorkoutName).toBe('Morning');
  });

  it('loadWorkout restores blocks and clears history', () => {
    useStore.getState().saveWorkout('Morning');
    useStore.getState().addBlock('work');
    useStore.getState().loadWorkout('Morning');
    expect(useStore.getState().blocks).toEqual(blocks);
    expect(useStore.getState().past).toHaveLength(0);
    expect(useStore.getState().activeWorkoutName).toBe('Morning');
  });

  it('deleteWorkout removes the workout', () => {
    useStore.getState().saveWorkout('Morning');
    useStore.getState().deleteWorkout('Morning');
    expect(useStore.getState().workouts['Morning']).toBeUndefined();
  });

  it('deleteWorkout clears activeWorkoutName if it matches', () => {
    useStore.getState().saveWorkout('Morning');
    useStore.getState().deleteWorkout('Morning');
    expect(useStore.getState().activeWorkoutName).toBeNull();
  });

  it('deleteWorkout preserves activeWorkoutName if different', () => {
    useStore.getState().saveWorkout('Morning');
    useStore.getState().saveWorkout('Evening');
    useStore.getState().loadWorkout('Morning');
    useStore.getState().deleteWorkout('Evening');
    expect(useStore.getState().activeWorkoutName).toBe('Morning');
  });

  it('renameWorkout renames key and updates activeWorkoutName', () => {
    useStore.getState().saveWorkout('Morning');
    useStore.getState().renameWorkout('Morning', 'Kegels');
    expect(useStore.getState().workouts['Kegels']).toBeDefined();
    expect(useStore.getState().workouts['Morning']).toBeUndefined();
    expect(useStore.getState().activeWorkoutName).toBe('Kegels');
  });

  it('renameWorkout does not change activeWorkoutName if not active', () => {
    useStore.getState().saveWorkout('Morning');
    useStore.getState().saveWorkout('Evening');
    useStore.getState().loadWorkout('Evening');
    useStore.getState().renameWorkout('Morning', 'AM');
    expect(useStore.getState().activeWorkoutName).toBe('Evening');
  });

  it('renameWorkout is a no-op for unknown name', () => {
    useStore.getState().renameWorkout('DoesNotExist', 'NewName');
    expect(useStore.getState().workouts['NewName']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// pxPerSecond clamping
// ---------------------------------------------------------------------------
describe('setPxPerSecond', () => {
  it('sets valid value', () => {
    useStore.getState().setPxPerSecond(40);
    expect(useStore.getState().pxPerSecond).toBe(40);
  });

  it('clamps minimum to 2', () => {
    useStore.getState().setPxPerSecond(1);
    expect(useStore.getState().pxPerSecond).toBe(2);
  });

  it('clamps maximum to 100', () => {
    useStore.getState().setPxPerSecond(999);
    expect(useStore.getState().pxPerSecond).toBe(100);
  });
});
