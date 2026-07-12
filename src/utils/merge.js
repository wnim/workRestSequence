/**
 * Three-way merge of workout maps.
 *
 * base     — last state synced with the gist (lastSyncedRef)
 * local    — current local workouts
 * remote   — workouts just fetched from the gist
 *
 * Returns:
 *   merged       — auto-merged result (excludes keys with real conflicts)
 *   conflictKeys — workout names that both sides changed differently
 */
export function mergeWorkouts(base, local, remote) {
  const allKeys = new Set([
    ...Object.keys(base ?? {}),
    ...Object.keys(local),
    ...Object.keys(remote),
  ]);

  const merged = {};
  const conflictKeys = [];

  for (const key of allKeys) {
    const baseStr = key in (base ?? {}) ? JSON.stringify(base[key]) : null;
    const localStr = key in local      ? JSON.stringify(local[key]) : null;
    const remoteStr = key in remote    ? JSON.stringify(remote[key]) : null;

    const localChanged  = localStr  !== baseStr;
    const remoteChanged = remoteStr !== baseStr;

    if (!localChanged && !remoteChanged) {
      if (localStr !== null) merged[key] = local[key];
    } else if (localChanged && !remoteChanged) {
      if (localStr !== null) merged[key] = local[key];
    } else if (!localChanged && remoteChanged) {
      if (remoteStr !== null) merged[key] = remote[key];
    } else if (localStr === remoteStr) {
      // Same change on both sides — not a real conflict
      if (localStr !== null) merged[key] = local[key];
    } else {
      conflictKeys.push(key);
    }
  }

  return { merged, conflictKeys };
}
