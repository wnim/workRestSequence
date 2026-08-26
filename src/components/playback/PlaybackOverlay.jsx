import { msToStopwatch, msToDisplay } from '../../utils/time';
import useStore from '../../store/workoutStore';
import { BlocksBar } from './BlocksBar';
import { Button } from '../ui/button';

export function PlaybackOverlay({ playback }) {
  const blocks = useStore((s) => s.blocks);
  const activeWorkoutName = useStore((s) => s.activeWorkoutName);
  const playState = useStore((s) => s.playState);
  const ttsEnabled = useStore((s) => s.ttsEnabled);
  const setTtsEnabled = useStore((s) => s.setTtsEnabled);
  const { currentPositionMs, blockIndex, blockElapsedMs, totalMs, togglePause, stop, seek, beginScrub, scrubTo, endScrub } = playback;

  if (playState === 'idle') return null;

  const currentBlock = blocks[blockIndex];
  const nextBlock = blocks[blockIndex + 1] ?? null;
  const nextNextBlock = blocks[blockIndex + 2] ?? null;
  const isWork = currentBlock?.type === 'work';
  const blockDurationMs = (currentBlock?.duration ?? 0) * 1000;
  const blockRemainingMs = blockDurationMs - blockElapsedMs;
  const countdown = Math.ceil(blockRemainingMs / 1000);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace',
        background: '#0a0a0f',
      }}
    >
      {/* Cross-fade between work/rest backgrounds via opacity to avoid CSS hue interpolation
          traversing the wrong arc of the color wheel (hue 35° → 0° → 250° looks red mid-transition) */}
      <div style={{ position: 'absolute', inset: 0, background: 'oklch(0.45 0.22 35)', opacity: isWork ? 1 : 0, transition: 'opacity 300ms ease' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'oklch(0.12 0.01 250)', opacity: isWork ? 0 : 1, transition: 'opacity 300ms ease' }} />

      {/* Content sits above the absolute backgrounds via z-index */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {activeWorkoutName && (
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
            {activeWorkoutName}
          </div>
        )}

        <div style={{ fontSize: '10rem', fontWeight: 700, lineHeight: 1, color: 'rgba(255,255,255,0.95)', letterSpacing: '-4px' }}>
          {countdown >= 60 ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}` : countdown}
        </div>

        <div style={{ fontSize: '2.2rem', color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
          {currentBlock?.label || (isWork ? 'Work' : 'Rest')}
        </div>

        <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          {blockIndex + 1} / {blocks.length}
        </div>

        {nextBlock && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>next</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                {nextBlock.label || (nextBlock.type === 'work' ? 'Work' : 'Rest')}
              </span>
              <span>{msToDisplay(nextBlock.duration * 1000)}</span>
            </div>
            {nextNextBlock && (
              <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>then</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                  {nextNextBlock.label || (nextNextBlock.type === 'work' ? 'Work' : 'Rest')}
                </span>
                <span>{msToDisplay(nextNextBlock.duration * 1000)}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)', marginTop: 16, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
          {msToStopwatch(currentPositionMs)} / {msToStopwatch(totalMs)}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <Button
            variant="outline"
            title="Pause / Resume (Space / K)"
            onClick={togglePause}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}
          >
            {playState === 'paused' ? 'Resume' : 'Pause'}
          </Button>
          <Button
            variant="outline"
            title="Restart from beginning (R)"
            onClick={() => seek(0)}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}
          >
            Restart
          </Button>
          <Button
            variant="outline"
            title="Stop playback (Esc)"
            onClick={stop}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}
          >
            Stop
          </Button>
          <Button
            variant="outline"
            title="Toggle voice readout of block labels"
            onClick={() => setTtsEnabled(!ttsEnabled)}
            style={{ background: ttsEnabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: ttsEnabled ? 'white' : 'rgba(255,255,255,0.5)' }}
          >
            Voice {ttsEnabled ? 'On' : 'Off'}
          </Button>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1 }}>
        <BlocksBar blocks={blocks} currentPositionMs={currentPositionMs} onScrubStart={beginScrub} onScrubMove={scrubTo} onScrubEnd={endScrub} />
      </div>
    </div>
  );
}
