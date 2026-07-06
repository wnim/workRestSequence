import { useRef, useState, useCallback, useEffect } from 'react';
import useStore from '../store/workoutStore';
import { blockStartTime } from '../utils/time';
import { useAudio } from './useAudio';

export function usePlayback() {
  const blocks = useStore((s) => s.blocks);
  const playState = useStore((s) => s.playState);
  const playStartWallTime = useStore((s) => s.playStartWallTime);
  const pausedDuration = useStore((s) => s.pausedDuration);
  const pausedAt = useStore((s) => s.pausedAt);
  const setPlayState = useStore((s) => s.setPlayState);
  const setPlayStartWallTime = useStore((s) => s.setPlayStartWallTime);
  const setPausedDuration = useStore((s) => s.setPausedDuration);
  const setPausedAt = useStore((s) => s.setPausedAt);

  const [currentPositionMs, setCurrentPositionMs] = useState(0);
  const rafRef = useRef(null);
  const cueTimeoutsRef = useRef([]);
  const audio = useAudio();

  const clearCues = useCallback(() => {
    cueTimeoutsRef.current.forEach(clearTimeout);
    cueTimeoutsRef.current = [];
  }, []);

  const scheduleCues = useCallback((startWallTime, alreadyElapsedMs, pausedMs) => {
    clearCues();
    let cursor = 0;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const blockStart = cursor * 1000;
      const blockEnd = (cursor + b.duration) * 1000;

      if (blockEnd <= alreadyElapsedMs) { cursor += b.duration; continue; }

      const cueStartOffset = blockStart - alreadyElapsedMs;
      if (cueStartOffset >= 0) {
        const id = setTimeout(() => {
          if (b.type === 'work') audio.playWorkStart(); else audio.playRestStart();
        }, cueStartOffset);
        cueTimeoutsRef.current.push(id);
      }

      for (const tickBefore of [3000, 2000, 1000]) {
        // Only count down the last N seconds of a block if the block is actually N seconds long.
        // This prevents ticks firing before the block even starts, and provably prevents
        // two countdowns from ever overlapping: each countdown starts no earlier than its block's
        // own start, which is always after the previous block ended.
        if (b.duration * 1000 < tickBefore) continue;
        const tickOffset = blockEnd - tickBefore - alreadyElapsedMs;
        if (tickOffset >= 0) {
          const id = setTimeout(() => audio.playTick(), tickOffset);
          cueTimeoutsRef.current.push(id);
        }
      }

      cursor += b.duration;
    }
  }, [blocks, audio, clearCues]);

  const startRaf = useCallback((startWallTime, pausedMs) => {
    const totalMs = blocks.reduce((s, b) => s + b.duration, 0) * 1000;

    function tick() {
      const pos = Date.now() - startWallTime - pausedMs;
      if (pos >= totalMs) {
        setCurrentPositionMs(totalMs);
        setPlayState('idle');
        setPlayStartWallTime(null);
        setPausedDuration(0);
        setPausedAt(null);
        audio.playCompletion();
        return;
      }
      setCurrentPositionMs(pos);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [blocks, audio, setPlayState, setPlayStartWallTime, setPausedDuration, setPausedAt]);

  const play = useCallback(() => {
    if (blocks.length === 0) return;
    const now = Date.now();
    setPlayStartWallTime(now);
    setPausedDuration(0);
    setPausedAt(null);
    setPlayState('playing');
    setCurrentPositionMs(0);
    scheduleCues(now, 0, 0);
    startRaf(now, 0);
  }, [blocks, setPlayStartWallTime, setPausedDuration, setPausedAt, setPlayState, scheduleCues, startRaf]);

  const pause = useCallback(() => {
    if (playState !== 'playing') return;
    clearCues();
    cancelAnimationFrame(rafRef.current);
    const now = Date.now();
    setPausedAt(now);
    setPlayState('paused');
  }, [playState, clearCues, setPausedAt, setPlayState]);

  const resume = useCallback(() => {
    if (playState !== 'paused' || pausedAt == null) return;
    const now = Date.now();
    const newPausedDuration = pausedDuration + (now - pausedAt);
    setPausedDuration(newPausedDuration);
    setPausedAt(null);
    setPlayState('playing');
    const elapsed = now - playStartWallTime - newPausedDuration;
    scheduleCues(playStartWallTime, elapsed, newPausedDuration);
    startRaf(playStartWallTime, newPausedDuration);
  }, [playState, pausedAt, pausedDuration, playStartWallTime, setPausedDuration, setPausedAt, setPlayState, scheduleCues, startRaf]);

  const stop = useCallback(() => {
    clearCues();
    cancelAnimationFrame(rafRef.current);
    setPlayState('idle');
    setPlayStartWallTime(null);
    setPausedDuration(0);
    setPausedAt(null);
    setCurrentPositionMs(0);
  }, [clearCues, setPlayState, setPlayStartWallTime, setPausedDuration, setPausedAt]);

  const togglePause = useCallback(() => {
    if (playState === 'playing') pause();
    else if (playState === 'paused') resume();
  }, [playState, pause, resume]);

  useEffect(() => () => { clearCues(); cancelAnimationFrame(rafRef.current); }, [clearCues]);

  const totalMs = blocks.reduce((s, b) => s + b.duration, 0) * 1000;
  let blockIndex = 0;
  let elapsed = currentPositionMs;
  for (let i = 0; i < blocks.length; i++) {
    const dur = blocks[i].duration * 1000;
    if (elapsed < dur) { blockIndex = i; break; }
    elapsed -= dur;
    if (i === blocks.length - 1) { blockIndex = i; elapsed = 0; }
  }

  return {
    currentPositionMs,
    blockIndex,
    blockElapsedMs: elapsed,
    totalMs,
    play,
    pause,
    resume,
    stop,
    togglePause,
  };
}
