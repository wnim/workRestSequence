import { useEffect } from 'react';
import useStore from '../store/workoutStore';

export function useKeyboard({ onPlay, onPause, onStop } = {}) {
  const removeBlocks = useStore((s) => s.removeBlocks);
  const selectedIds = useStore((s) => s.selectedIds);
  const copySelection = useStore((s) => s.copySelection);
  const pasteBlocks = useStore((s) => s.pasteBlocks);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const playState = useStore((s) => s.playState);

  useEffect(() => {
    function handler(e) {
      const tag = e.target?.tagName?.toLowerCase();
      const isEditing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;

      if (playState !== 'idle') {
        if (e.code === 'Space') { e.preventDefault(); onPause?.(); return; }
        if (e.code === 'Escape') { onStop?.(); return; }
        return;
      }

      if (isEditing) return;

      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedIds.size > 0) removeBlocks(selectedIds);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        copySelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        pasteBlocks();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redo();
      } else if (e.code === 'Space') {
        e.preventDefault(); onPlay?.();
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, playState, removeBlocks, copySelection, pasteBlocks, undo, redo, onPlay, onPause, onStop]);
}
