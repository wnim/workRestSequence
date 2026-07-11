import { useEffect } from 'react';
import useStore from '../store/workoutStore';

function key(e, letter, code) {
  return /^[a-z]$/i.test(e.key) ? e.key.toLowerCase() === letter : e.code === code;
}

export function useKeyboard({ onPlay, onPause, onStop, onRestart, onHelp, onSave, onSeekBy, onOpenPicker, onZoomToSelection, onZoomIn, onZoomOut, onFitToScreen } = {}) {
  const removeBlocks = useStore((s) => s.removeBlocks);
  const addBlock = useStore((s) => s.addBlock);
  const selectedIds = useStore((s) => s.selectedIds);
  const copySelection = useStore((s) => s.copySelection);
  const pasteBlocks = useStore((s) => s.pasteBlocks);
  const selectAll = useStore((s) => s.selectAll);
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
        if (e.code === 'Space' || key(e, 'k', 'KeyK')) { e.preventDefault(); onPause?.(); return; }
        if (e.code === 'Escape') { onStop?.(); return; }
        if (e.code === 'ArrowRight') { e.preventDefault(); onSeekBy?.(e.shiftKey ? 10000 : 5000); return; }
        if (e.code === 'ArrowLeft')  { e.preventDefault(); onSeekBy?.(e.shiftKey ? -10000 : -5000); return; }
        if (key(e, 'l', 'KeyL')) { e.preventDefault(); onSeekBy?.(10000); return; }
        if (key(e, 'j', 'KeyJ')) { e.preventDefault(); onSeekBy?.(-10000); return; }
        if (key(e, 'r', 'KeyR')) { e.preventDefault(); onRestart?.(); return; }
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
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault(); onZoomIn?.();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault(); onZoomOut?.();
      } else if ((e.ctrlKey || e.metaKey) && key(e, 'a', 'KeyA')) {
        e.preventDefault(); selectAll();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault(); onFitToScreen?.();
      } else if (e.code === 'Space' || key(e, 'k', 'KeyK')) {
        e.preventDefault(); onPlay?.();
      } else if (key(e, 'w', 'KeyW') && !e.ctrlKey && !e.metaKey) {
        addBlock('work');
      } else if (key(e, 'r', 'KeyR') && !e.ctrlKey && !e.metaKey) {
        addBlock('rest');
      } else if (e.key === '?') {
        onHelp?.();
      } else if (e.key === '/') {
        e.preventDefault(); onOpenPicker?.();
      } else if (key(e, 'z', 'KeyZ') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); onZoomToSelection?.();
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, playState, addBlock, removeBlocks, copySelection, pasteBlocks, selectAll, undo, redo, onPlay, onPause, onStop, onRestart, onHelp, onSave, onSeekBy, onOpenPicker, onZoomToSelection, onZoomIn, onZoomOut, onFitToScreen]);
}
