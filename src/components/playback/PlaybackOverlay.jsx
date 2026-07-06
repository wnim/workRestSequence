import { msToStopwatch } from '../../utils/time';
import useStore from '../../store/workoutStore';
import { WaveformStrip } from './WaveformStrip';
import { Button } from '../ui/button';

export function PlaybackOverlay({ playback }) {
  const blocks = useStore((s) => s.blocks);
  const playState = useStore((s) => s.playState);
  const { currentPositionMs, blockIndex, blockElapsedMs, totalMs, togglePause, stop } = playback;

  if (playState === 'idle') return null;

  const currentBlock = blocks[blockIndex];
  const isWork = currentBlock?.type === 'work';
  const blockDurationMs = (currentBlock?.duration ?? 0) * 1000;
  const blockRemainingMs = blockDurationMs - blockElapsedMs;
  const countdown = Math.ceil(blockRemainingMs / 1000);

  const bgColor = isWork ? 'oklch(0.45 0.22 35)' : 'oklch(0.12 0.01 250)';

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
        backgroundColor: bgColor,
        transition: 'background-color 300ms ease',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ fontSize: '10rem', fontWeight: 700, lineHeight: 1, color: 'rgba(255,255,255,0.95)', letterSpacing: '-4px' }}>
        {countdown}
      </div>

      <div style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
        {currentBlock?.label || (isWork ? 'Work' : 'Rest')}
      </div>

      <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
        {blockIndex + 1} / {blocks.length}
      </div>

      <div style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)', marginTop: 16, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
        {msToStopwatch(currentPositionMs)} / {msToStopwatch(totalMs)}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        <Button
          variant="outline"
          onClick={togglePause}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}
        >
          {playState === 'paused' ? 'Resume' : 'Pause'}
        </Button>
        <Button
          variant="outline"
          onClick={stop}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}
        >
          Stop
        </Button>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <WaveformStrip blocks={blocks} currentPositionMs={currentPositionMs} />
      </div>
    </div>
  );
}
