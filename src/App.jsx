import { useState } from 'react';
import useStore from './store/workoutStore';
import { useGistSync } from './hooks/useGistSync';
import { usePlayback } from './hooks/usePlayback';
import { useKeyboard } from './hooks/useKeyboard';
import { TimelineEditor } from './components/timeline/TimelineEditor';
import { PlaybackOverlay } from './components/playback/PlaybackOverlay';
import { GistSetupModal } from './components/modals/GistSetupModal';
import { WorkoutManagerModal } from './components/modals/WorkoutManagerModal';
import { Button } from './components/ui/button';
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
  const pxPerSecond = useStore((s) => s.pxPerSecond);
  const setPxPerSecond = useStore((s) => s.setPxPerSecond);
  const resizeStep = useStore((s) => s.resizeStep);
  const setResizeStep = useStore((s) => s.setResizeStep);
  const syncStatus = useStore((s) => s.syncStatus);
  const gistConfig = useStore((s) => s.gistConfig);
  const activeWorkoutName = useStore((s) => s.activeWorkoutName);

  const [showGist, setShowGist] = useState(false);
  const [showManager, setShowManager] = useState(false);

  const playback = usePlayback();
  const playState = useStore((s) => s.playState);

  useKeyboard({
    onPlay: playback.play,
    onPause: playback.togglePause,
    onStop: playback.stop,
  });

  const totalSec = blocksToTotalDuration(blocks);
  const effectiveStatus = !gistConfig?.gistId ? 'disconnected' : syncStatus;
  const saveState = SAVE_STATES[effectiveStatus] ?? SAVE_STATES.idle;
  const canSave = effectiveStatus === 'dirty' || effectiveStatus === 'error';

  function handleSave() {
    if (effectiveStatus === 'disconnected') { setShowGist(true); return; }
    if (canSave) saveNow();
  }

  const sliderLabel = { fontSize: 11, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 6 };
  const btnBase = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.85)', fontSize: 12, height: 30, padding: '0 12px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1b2e', color: 'white', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
        background: '#22243c', borderBottom: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'rgba(255,255,255,0.75)', minWidth: 120 }}>
          {activeWorkoutName ?? 'Untitled'}
        </span>

        <Button variant="outline" style={btnBase} onClick={() => setShowManager(true)}>Workouts</Button>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
          {totalSec > 0 ? msToDisplay(totalSec * 1000) : '—'}
        </span>

        <label style={sliderLabel}>
          Snap
          <input type="range" min={1} max={30} value={resizeStep}
            onChange={(e) => setResizeStep(Number(e.target.value))} style={{ width: 70 }} />
          <span style={{ fontFamily: 'monospace', minWidth: 24 }}>{resizeStep}s</span>
        </label>

        <label style={sliderLabel}>
          Zoom
          <input type="range" min={2} max={80} value={pxPerSecond}
            onChange={(e) => setPxPerSecond(Number(e.target.value))} style={{ width: 80 }} />
        </label>

        <Button
          onClick={handleSave}
          disabled={syncStatus === 'saving' || syncStatus === 'loading'}
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

        <Button variant="outline" style={btnBase} onClick={() => setShowGist(true)}>
          {gistConfig?.gistId ? 'Gist ✓' : 'Gist Setup'}
        </Button>
      </div>

      {/* Content — timeline centered vertically */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px' }}>
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
          <Button onClick={() => addBlock('work')} style={{ background: 'oklch(0.58 0.20 35)', color: 'white', fontSize: 12, height: 30, padding: '0 12px' }}>+ Work</Button>
          <Button onClick={() => addBlock('rest')} style={{ background: 'oklch(0.32 0.06 250)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)', fontSize: 12, height: 30, padding: '0 12px' }}>+ Rest</Button>
          <Button onClick={() => setBlocks([])} style={{ fontSize: 12, height: 30, padding: '0 12px', background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.18)' }}>Clear</Button>
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
      {showManager && <WorkoutManagerModal onClose={() => setShowManager(false)} />}
    </div>
  );
}
