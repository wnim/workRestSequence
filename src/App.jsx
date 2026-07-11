import { useState, useRef } from 'react';
import useStore from './store/workoutStore';
import { useGistSync } from './hooks/useGistSync';
import { usePlayback } from './hooks/usePlayback';
import { useKeyboard } from './hooks/useKeyboard';
import { TimelineEditor } from './components/timeline/TimelineEditor';
import { PlaybackOverlay } from './components/playback/PlaybackOverlay';
import { GistSetupModal } from './components/modals/GistSetupModal';
import { WorkoutPicker } from './components/ui/WorkoutPicker';
import { CodeEditorModal } from './components/modals/CodeEditorModal';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { KeyboardShortcutsHelp } from './components/ui/KeyboardShortcutsHelp';
import { blocksToTotalDuration, msToDisplay } from './utils/time';

const SAVE_STATES = {
  dirty:        { label: 'Save',      bg: 'oklch(0.55 0.18 250)',          color: 'white',                    cursor: 'pointer' },
  error:        { label: 'Retry Save',bg: 'oklch(0.50 0.20 25)',           color: 'white',                    cursor: 'pointer' },
  saving:       { label: 'Saving…',   bg: 'rgba(255,255,255,0.06)',        color: 'rgba(255,255,255,0.4)',     cursor: 'default'  },
  saved:        { label: '✓ Saved',   bg: 'oklch(0.45 0.12 150 / 0.4)',   color: 'oklch(0.75 0.15 150)',     cursor: 'default'  },
  idle:         { label: 'Saved',     bg: 'rgba(255,255,255,0.06)',        color: 'rgba(255,255,255,0.3)',     cursor: 'default'  },
  loading:      { label: 'Loading…',  bg: 'rgba(255,255,255,0.06)',        color: 'rgba(255,255,255,0.3)',     cursor: 'default'  },
  disconnected: { label: 'Save',      bg: 'rgba(255,255,255,0.06)',        color: 'rgba(255,255,255,0.3)',     cursor: 'pointer'  },
};

export default function App() {
  const { saveNow } = useGistSync();
  const blocks = useStore((s) => s.blocks);
  const addBlock = useStore((s) => s.addBlock);
  const setBlocks = useStore((s) => s.setBlocks);
  const setPxPerSecond = useStore((s) => s.setPxPerSecond);
  const resizeStep = useStore((s) => s.resizeStep);
  const setResizeStep = useStore((s) => s.setResizeStep);
  const syncStatus = useStore((s) => s.syncStatus);
  const gistConfig = useStore((s) => s.gistConfig);
  const activeWorkoutName = useStore((s) => s.activeWorkoutName);

  const workouts = useStore((s) => s.workouts);
  const renameWorkout = useStore((s) => s.renameWorkout);
  const saveWorkout = useStore((s) => s.saveWorkout);
  const loadWorkout = useStore((s) => s.loadWorkout);

  const contentRef = useRef(null);
  const pickerRef = useRef(null);

  const [showGist, setShowGist] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef(null);

  const playback = usePlayback();
  const playState = useStore((s) => s.playState);

  useKeyboard({
    onPlay: playback.play,
    onPause: playback.togglePause,
    onStop: playback.stop,
    onHelp: () => setShowHelp((v) => !v),
    onSave: handleSave,
    onSeekBy: (delta) => playback.seek(playback.currentPositionMs + delta),
    onOpenPicker: () => pickerRef.current?.open(),
  });

  const totalSec = blocksToTotalDuration(blocks);

  const savedBlocks = activeWorkoutName ? (workouts[activeWorkoutName]?.blocks ?? []) : [];
  const hasLocalChanges = JSON.stringify(blocks) !== JSON.stringify(savedBlocks);

  // For Gist status, only show it when Gist is configured and there's no local dirty state
  const gistStatus = !gistConfig?.gistId ? 'disconnected' : syncStatus;
  // Local dirty takes priority over Gist status
  const effectiveStatus = hasLocalChanges ? 'dirty' : gistStatus;
  const saveState = SAVE_STATES[effectiveStatus] ?? SAVE_STATES.idle;
  const canSave = hasLocalChanges || effectiveStatus === 'error';

  function handleSave() {
    if (!activeWorkoutName) {
      // No workout name yet — trigger the rename flow so user names it first
      setIsRenaming(true);
      setRenameValue('');
      setTimeout(() => renameInputRef.current?.focus(), 50);
      return;
    }
    saveWorkout(activeWorkoutName);
    if (gistConfig?.gistId && gistConfig?.token) saveNow();
  }

  function fitToScreen(sec) {
    if (!sec || !contentRef.current) return;
    const availableWidth = contentRef.current.clientWidth - 32;
    setPxPerSecond(availableWidth / (sec * 1.1));
  }

  function handleLoadWorkout(name) {
    loadWorkout(name);
    const workout = workouts[name];
    if (workout?.blocks?.length) {
      const sec = workout.blocks.reduce((s, b) => s + b.duration, 0);
      // Use rAF so the DOM has settled after the state update before measuring
      requestAnimationFrame(() => fitToScreen(sec));
    }
  }

  const sliderLabel = { fontSize: 11, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 6 };

  const SNAP_MIN = 0.1, SNAP_MAX = 30;
  function snapToSlider(v) { return Math.log(v / SNAP_MIN) / Math.log(SNAP_MAX / SNAP_MIN); }
  function sliderToSnap(t) {
    const raw = SNAP_MIN * Math.pow(SNAP_MAX / SNAP_MIN, t);
    if (raw < 1) return Math.round(raw * 10) / 10;
    if (raw < 5) return Math.round(raw * 2) / 2;
    return Math.round(raw);
  }
  const btnBase = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.85)', fontSize: 12, height: 30, padding: '0 12px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#1a1b2e', color: 'white', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
        background: '#22243c', borderBottom: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap',
      }}>
        {isRenaming ? (
          <Input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const name = renameValue.trim();
                if (name) {
                  if (activeWorkoutName) renameWorkout(activeWorkoutName, name);
                  else saveWorkout(name);
                }
                setIsRenaming(false);
              }
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            onBlur={() => setIsRenaming(false)}
            autoFocus
            style={{ width: 160, height: 28, fontSize: 13, fontFamily: 'monospace', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <WorkoutPicker ref={pickerRef} onLoad={handleLoadWorkout} />
            <button
              onClick={() => { setRenameValue(activeWorkoutName ?? ''); setIsRenaming(true); }}
              title="Rename"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '2px 4px', lineHeight: 1 }}
            >
              ✎
            </button>
          </div>
        )}

        <Button variant="outline" className="toolbar-desktop-only" style={btnBase} onClick={() => setShowCode(true)}>{ '{…}' }</Button>

        <div style={{ flex: 1 }} />

        <span className="toolbar-desktop-only" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
          {totalSec > 0 ? msToDisplay(totalSec * 1000) : '—'}
        </span>

        <label className="toolbar-desktop-only" style={sliderLabel}>
          Snap
          <input type="range" min={0} max={1} step={0.001} value={snapToSlider(resizeStep)}
            onChange={(e) => setResizeStep(sliderToSnap(Number(e.target.value)))} style={{ width: 70 }} />
          <span style={{ fontFamily: 'monospace', minWidth: 32 }}>{resizeStep % 1 === 0 ? resizeStep : resizeStep.toFixed(1)}s</span>
        </label>

        <button
          className="toolbar-desktop-only"
          onClick={() => fitToScreen(totalSec)}
          title="Fit to screen (Ctrl+Scroll to zoom)"
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 4, cursor: 'pointer', color: 'rgba(255,255,255,0.55)', fontSize: 12, padding: '1px 8px', lineHeight: 1.4 }}
        >⟷</button>

        <Button
          className="toolbar-desktop-only"
          onClick={handleSave}
          disabled={!canSave && (syncStatus === 'saving' || syncStatus === 'loading')}
          style={{
            fontSize: 12, height: 30, padding: '0 16px',
            background: saveState.bg,
            color: saveState.color,
            border: canSave ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.1)',
            cursor: saveState.cursor,
            transition: 'background 0.3s, color 0.3s',
            fontWeight: canSave ? 600 : 400,
          }}
        >
          {saveState.label}
        </Button>

        <Button variant="outline" className="toolbar-desktop-only" style={btnBase} onClick={() => setShowGist(true)}>
          {gistConfig?.gistId ? 'Gist ✓' : 'Gist Setup'}
        </Button>
      </div>

      {/* Content — timeline centered vertically */}
      <div ref={contentRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px' }}>
        {blocks.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 13, margin: 0 }}>
              No blocks yet. Add one to start.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button onClick={() => addBlock('work')} style={{ background: 'oklch(0.58 0.20 35)', color: 'white' }}>+ Work Block</Button>
              <Button onClick={() => addBlock('rest')} style={{ background: 'oklch(0.32 0.06 250)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)' }}>+ Rest Block</Button>
            </div>
          </div>
        ) : (
          <TimelineEditor />
        )}
      </div>

      {/* Bottom bar */}
      {blocks.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
          background: '#22243c', borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          <Button className="toolbar-desktop-only" onClick={() => addBlock('work')} style={{ background: 'oklch(0.58 0.20 35)', color: 'white', fontSize: 12, height: 30, padding: '0 12px' }}>+ Work</Button>
          <Button className="toolbar-desktop-only" onClick={() => addBlock('rest')} style={{ background: 'oklch(0.32 0.06 250)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)', fontSize: 12, height: 30, padding: '0 12px' }}>+ Rest</Button>
          <Button className="toolbar-desktop-only" onClick={() => setBlocks([])} style={{ fontSize: 12, height: 30, padding: '0 12px', background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.18)' }}>Clear</Button>
          <div style={{ flex: 1 }} />
          <Button
            onClick={playback.play}
            disabled={playState !== 'idle' || blocks.length === 0}
            style={{ background: 'oklch(0.58 0.18 150)', color: 'white', fontSize: 13, height: 34, padding: '0 20px' }}
          >
            ▶ Play
          </Button>
        </div>
      )}

      {playState !== 'idle' && <PlaybackOverlay playback={playback} />}
      {showGist && <GistSetupModal onClose={() => setShowGist(false)} />}
      {showCode && <CodeEditorModal onClose={() => setShowCode(false)} />}
      <KeyboardShortcutsHelp open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
