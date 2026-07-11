import { useEffect } from 'react';
import useStore from '../store/workoutStore';

function key(e, letter, code) {
  return /^[a-z]$/i.test(e.key) ? e.key.toLowerCase() === letter : e.code === code;
}

export function useKeyboard({ onPlay, onPause, onStop, onHelp, onSave, onSeekBy } = {}) {
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

      if ((e.ctrlKey || e.metaKey) && key(e, 's', 'KeyS')) {
        e.preventDefault(); onSave?.(); return;
      }

      if (playState !== 'idle') {
        if (e.code === 'Space') { e.preventDefault(); onPause?.(); return; }
        if (e.code === 'Escape') { onStop?.(); return; }
        if (e.code === 'ArrowRight') { e.preventDefault(); onSeekBy?.(e.shiftKey ? 10000 : 5000); return; }
        if (e.code === 'ArrowLeft')  { e.preventDefault(); onSeekBy?.(e.shiftKey ? -10000 : -5000); return; }
        return;
      }

      if (isEditing) return;

      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedIds.size > 0) removeBlocks(selectedIds);
      } else if ((e.ctrlKey || e.metaKey) && key(e, 'c', 'KeyC')) {
        copySelection();
      } else if ((e.ctrlKey || e.metaKey) && key(e, 'v', 'KeyV')) {
        pasteBlocks();
      } else if ((e.ctrlKey || e.metaKey) && key(e, 'z', 'KeyZ') && !e.shiftKey) {
        e.preventDefault(); undo();
      } else if ((e.ctrlKey || e.metaKey) && (key(e, 'y', 'KeyY') || (key(e, 'z', 'KeyZ') && e.shiftKey))) {
        e.preventDefault(); redo();
      } else if (e.code === 'Space') {
        e.preventDefault(); onPlay?.();
      } else if (e.key === '?') {
        onHelp?.();
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, playState, removeBlocks, copySelection, pasteBlocks, undo, redo, onPlay, onPause, onStop, onHelp, onSave, onSeekBy]);
}
