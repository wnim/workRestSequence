import { useRef } from 'react';

export function useAudio() {
  const ctxRef = useRef(null);
  const lastPlayRef = useRef({ key: null, when: 0 });

  function getCtx() {
    if (!ctxRef.current) {
      try {
        ctxRef.current = new AudioContext();
      } catch (e) {
        return null;
      }
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }

  function playTone(freq, durSec, whenSec = 0) {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime + whenSec);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + whenSec + durSec);
    osc.start(ctx.currentTime + whenSec);
    osc.stop(ctx.currentTime + whenSec + durSec + 0.05);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch (_) {}
    };
  }

  function deduped(key, fn) {
    const now = Date.now();
    if (lastPlayRef.current.key === key && now - lastPlayRef.current.when < 100) return;
    lastPlayRef.current = { key, when: now };
    fn();
  }

  function playWorkStart(whenSec = 0) { deduped('workStart', () => playTone(880, 0.15, whenSec)); }
  function playRestStart(whenSec = 0) { deduped('restStart', () => playTone(440, 0.15, whenSec)); }
  function playTick(whenSec = 0) { deduped('tick', () => playTone(660, 0.05, whenSec)); }
  function playCompletion() {
    deduped('completion', () => {
      playTone(523, 0.2, 0);
      playTone(659, 0.2, 0.25);
      playTone(784, 0.3, 0.5);
    });
  }

  return { playWorkStart, playRestStart, playTick, playCompletion };
}
