import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { BlockItem } from '../../components/timeline/BlockItem';
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

function Wrapper({ block, index, blocks = BLOCKS, onDoubleClick }) {
  return (
    <DndContext>
      <SortableContext items={blocks.map((b) => b.id)}>
        <div style={{ position: 'relative', height: 140, width: 600 }}>
          <BlockItem
            block={block}
            index={index}
            blocks={blocks}
            pxPerSecond={20}
            onDoubleClick={onDoubleClick}
          />
        </div>
      </SortableContext>
    </DndContext>
  );
}

beforeEach(() => useStore.setState(INITIAL_STATE));

describe('BlockItem', () => {
  it('renders block label', () => {
    render(<Wrapper block={BLOCKS[0]} index={0} />);
    expect(screen.getByText('Kegels')).toBeInTheDocument();
  });

  it('renders "Rest" as fallback label for unlabeled rest block', () => {
    render(<Wrapper block={BLOCKS[1]} index={1} />);
    expect(screen.getByText('Rest')).toBeInTheDocument();
  });

  it('renders "Work" as fallback for unlabeled work block', () => {
    const block = { id: 'x', type: 'work', duration: 10, label: '' };
    render(<Wrapper block={block} index={0} blocks={[block]} />);
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('plain click selects only this block', () => {
    render(<Wrapper block={BLOCKS[0]} index={0} />);
    fireEvent.click(screen.getByText('Kegels'));
    expect(useStore.getState().selectedIds).toEqual(new Set(['a']));
  });

  it('ctrl+click toggles selection', () => {
    render(<Wrapper block={BLOCKS[0]} index={0} />);
    fireEvent.click(screen.getByText('Kegels'), { ctrlKey: true });
    expect(useStore.getState().selectedIds.has('a')).toBe(true);
    fireEvent.click(screen.getByText('Kegels'), { ctrlKey: true });
    expect(useStore.getState().selectedIds.has('a')).toBe(false);
  });

  it('shift+click extends selection', () => {
    useStore.setState({ ...INITIAL_STATE, selectedIds: new Set(['a']) });
    render(<Wrapper block={BLOCKS[1]} index={1} />);
    fireEvent.click(screen.getByText('Rest'), { shiftKey: true });
    expect(useStore.getState().selectedIds).toEqual(new Set(['a', 'b']));
  });

  it('double-click calls onDoubleClick with the block', () => {
    const onDoubleClick = vi.fn();
    render(<Wrapper block={BLOCKS[0]} index={0} onDoubleClick={onDoubleClick} />);
    fireEvent.dblClick(screen.getByText('Kegels'));
    expect(onDoubleClick).toHaveBeenCalledWith(BLOCKS[0]);
  });
});
