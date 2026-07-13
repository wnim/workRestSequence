import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store/workoutStore';
import { fetchGistData, saveGistData, saveGistDataKeepalive } from '../utils/gist';
import { LS_WORKOUTS, LS_SAVE_PENDING, GIST_FILENAME } from '../utils/constants';
import { mergeWorkouts } from '../utils/merge';

export function useGistSync() {
  const workouts = useStore((s) => s.workouts);
  const gistConfig = useStore((s) => s.gistConfig);
  const setWorkouts = useStore((s) => s.setWorkouts);
  const setSyncStatus = useStore((s) => s.setSyncStatus);
  const syncStatus = useStore((s) => s.syncStatus);
  const setConflictData = useStore((s) => s.setConflictData);

  const lastSyncedRef = useRef(null);
  const saveTimerRef = useRef(null);
  const workoutsRef = useRef(workouts);
  workoutsRef.current = workouts;
  const syncStatusRef = useRef(syncStatus);
  syncStatusRef.current = syncStatus;

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

  // Raw save — no conflict check, used after conflict resolution
  const doSaveInner = useCallback((serialized) => {
    setSyncStatus('saving');
    return saveGistData(gistConfig.gistId, gistConfig.token, GIST_FILENAME, { workouts: JSON.parse(serialized) })
      .then(() => {
        lastSyncedRef.current = serialized;
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
      })
      .catch(() => setSyncStatus('error'));
  }, [gistConfig, setSyncStatus]);

  const doSaveInnerRef = useRef(doSaveInner);
  doSaveInnerRef.current = doSaveInner;

  // Save with pre-flight conflict check
  const doSave = useCallback((serialized) => {
    if (lastSyncedRef.current === null) {
      return doSaveInnerRef.current(serialized);
    }
    return fetchGistData(gistConfig.gistId, gistConfig.token)
      .then((remoteData) => {
        const remoteWorkouts = remoteData?.workouts ?? {};
        const remoteStr = JSON.stringify(remoteWorkouts);
        if (remoteStr !== lastSyncedRef.current) {
          const base = lastSyncedRef.current ? JSON.parse(lastSyncedRef.current) : {};
          const { merged, conflictKeys } = mergeWorkouts(base, JSON.parse(serialized), remoteWorkouts);
          setConflictData({ remote: remoteWorkouts, merged, conflictKeys });
          return;
        }
        return doSaveInnerRef.current(serialized);
      })
      .catch(() => setSyncStatus('error'));
  }, [gistConfig, setSyncStatus, setConflictData]);

  // 3. Mark dirty immediately on change; debounce the actual Gist save
  useEffect(() => {
    if (!gistConfig?.gistId || !gistConfig?.token) return;
    if (lastSyncedRef.current === null) return;
    const serialized = JSON.stringify(workouts);
    if (serialized === lastSyncedRef.current) return;
    setSyncStatus('dirty');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(serialized), 60_000);
    return () => clearTimeout(saveTimerRef.current);
  }, [workouts, gistConfig, setSyncStatus, doSave]);

  // 4. Force pull from Gist, overwriting local state
  const pullNow = useCallback(() => {
    if (!gistConfig?.gistId || !gistConfig?.token) return Promise.resolve();
    setSyncStatus('loading');
    return fetchGistData(gistConfig.gistId, gistConfig.token)
      .then((data) => {
        if (data?.workouts) {
          setWorkouts(data.workouts);
          lastSyncedRef.current = JSON.stringify(data.workouts);
        }
        setSyncStatus('idle');
      })
      .catch(() => setSyncStatus('error'));
  }, [gistConfig, setSyncStatus, setWorkouts]);

  // 5. Manual immediate save
  const saveNow = useCallback(() => {
    if (!gistConfig?.gistId || !gistConfig?.token) return;
    clearTimeout(saveTimerRef.current);
    doSave(JSON.stringify(workoutsRef.current));
  }, [gistConfig, doSave]);

  // 5. Resolve a detected conflict
  const resolveConflict = useCallback((choice) => {
    const conflict = useStore.getState().conflictData;
    setConflictData(null);
    if (choice === 'remote') {
      setWorkouts(conflict.remote);
      lastSyncedRef.current = JSON.stringify(conflict.remote);
      setSyncStatus('idle');
    } else if (choice === 'merge') {
      setWorkouts(conflict.merged);
      doSaveInnerRef.current(JSON.stringify(conflict.merged));
    } else {
      doSaveInnerRef.current(JSON.stringify(workoutsRef.current));
    }
  }, [setConflictData, setWorkouts, setSyncStatus]);

  // 6. Keepalive flush on page hide — only when local state is ahead of gist
  useEffect(() => {
    function flush() {
      if (!gistConfig?.gistId || !gistConfig?.token) return;
      const unsaved = syncStatusRef.current === 'dirty' || syncStatusRef.current === 'saving' || syncStatusRef.current === 'error';
      if (!unsaved) return;
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

  return { saveNow, pullNow, resolveConflict };
}
