import { useEffect, useRef } from 'react';
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

  // 1. Mirror workouts to localStorage
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

  // 3. Debounced Gist save (60s) when workouts change
  useEffect(() => {
    if (!gistConfig?.gistId || !gistConfig?.token) return;
    const serialized = JSON.stringify(workouts);
    if (serialized === lastSyncedRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSyncStatus('saving');
      saveGistData(gistConfig.gistId, gistConfig.token, GIST_FILENAME, { workouts })
        .then(() => {
          lastSyncedRef.current = serialized;
          setSyncStatus('saved');
          setTimeout(() => setSyncStatus('idle'), 3000);
        })
        .catch(() => setSyncStatus('error'));
    }, 60_000);
    return () => clearTimeout(saveTimerRef.current);
  }, [workouts, gistConfig, setSyncStatus]);

  // 4. Keepalive flush on page hide
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
}
