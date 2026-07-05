import { useRef } from 'react';

export function useAudio() {
  const ctxRef = useRef(null);

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }

  function playTone(freq, durSec, whenSec = 0) {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime + whenSec);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + whenSec + durSec);
    osc.start(ctx.currentTime + whenSec);
    osc.stop(ctx.currentTime + whenSec + durSec + 0.05);
  }

  function playWorkStart(whenSec = 0) { playTone(880, 0.15, whenSec); }
  function playRestStart(whenSec = 0) { playTone(440, 0.15, whenSec); }
  function playTick(whenSec = 0) { playTone(660, 0.05, whenSec); }
  function playCompletion() {
    playTone(523, 0.2, 0);
    playTone(659, 0.2, 0.25);
    playTone(784, 0.3, 0.5);
  }

  return { playWorkStart, playRestStart, playTick, playCompletion };
}
