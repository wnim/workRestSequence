import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store/workoutStore';
import { fetchGistData, saveGistData, saveGistDataKeepalive } from '../utils/gist';
import { LS_WORKOUTS, LS_SAVE_PENDING, GIST_FILENAME } from '../utils/constants';

export function useGistSync() {
  const workouts = useStore((s) => s.workouts);
  const gistConfig = useStore((s) => s.gistConfig);
  const setWorkouts = useStore((s) => s.setWorkouts);
  const setSyncStatus = useStore((s) => s.setSyncStatus);

  const lastSyncedRef = useRef(null);
  const saveTimerRef = useRef(null);
  const workoutsRef = useRef(workouts);
  workoutsRef.current = workouts;

  // 1. Mirror workouts to localStorage always
  useEffect(() => {
    localStorage.setItem(LS_WORKOUTS, JSON.stringify(workouts));
  }, [workouts]);

  // 2. Load from Gist on mount
  useEffect(() => {
    if (!gistConfig?.gistId || !gistConfig?.token) return;
    const pending = localStorage.getItem(LS_SAVE_PENDING);
    if (pending) {
      localStorage.removeItem(LS_SAVE_PENDING);
      return;
    }
    setSyncStatus('loading');
    fetchGistData(gistConfig.gistId, gistConfig.token)
      .then((data) => {
        if (data?.workouts) {
          setWorkouts(data.workouts);
          lastSyncedRef.current = JSON.stringify(data.workouts);
        }
        setSyncStatus('idle');
      })
      .catch(() => setSyncStatus('error'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSave = useCallback((serialized) => {
    setSyncStatus('saving');
    return saveGistData(gistConfig.gistId, gistConfig.token, GIST_FILENAME, { workouts: JSON.parse(serialized) })
      .then(() => {
        lastSyncedRef.current = serialized;
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
      })
      .catch(() => setSyncStatus('error'));
  }, [gistConfig, setSyncStatus]);

  // 3. Mark dirty immediately on change; debounce the actual Gist save
  useEffect(() => {
    if (!gistConfig?.gistId || !gistConfig?.token) return;
    const serialized = JSON.stringify(workouts);
    if (serialized === lastSyncedRef.current) return;
    setSyncStatus('dirty');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(serialized), 60_000);
    return () => clearTimeout(saveTimerRef.current);
  }, [workouts, gistConfig, setSyncStatus, doSave]);

  // 4. Manual immediate save
  const saveNow = useCallback(() => {
    if (!gistConfig?.gistId || !gistConfig?.token) return;
    clearTimeout(saveTimerRef.current);
    doSave(JSON.stringify(workoutsRef.current));
  }, [gistConfig, doSave]);

  // 5. Keepalive flush on page hide
  useEffect(() => {
    function flush() {
      if (!gistConfig?.gistId || !gistConfig?.token) return;
      localStorage.setItem(LS_SAVE_PENDING, '1');
      saveGistDataKeepalive(gistConfig.gistId, gistConfig.token, GIST_FILENAME, { workouts });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [workouts, gistConfig]);

  return { saveNow };
}
