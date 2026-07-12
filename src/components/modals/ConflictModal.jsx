import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import useStore from '../../store/workoutStore';

export function ConflictModal({ onKeepLocal, onUseRemote, onMerge }) {
  const conflictData = useStore((s) => s.conflictData);
  if (!conflictData) return null;

  const { remote, merged, conflictKeys } = conflictData;
  const canMerge = conflictKeys.length === 0;
  const remoteNames = Object.keys(remote);
  const mergedNames = Object.keys(merged);

  const dim = { color: 'rgba(255,255,255,0.55)', margin: 0, fontSize: 13 };
  const tag = { fontSize: 11, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4 };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: 'white', maxWidth: 460 }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'oklch(0.75 0.18 45)' }}>Remote Changes Detected</DialogTitle>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
          <p style={dim}>
            The gist was updated on another device since your last sync.
          </p>

          {conflictKeys.length > 0 && (
            <div style={{ background: 'oklch(0.22 0.06 25 / 0.5)', border: '1px solid oklch(0.45 0.18 25 / 0.5)', borderRadius: 6, padding: '8px 12px' }}>
              <p style={{ ...dim, marginBottom: 6, color: 'oklch(0.7 0.18 45)' }}>
                Both devices edited the same workout{conflictKeys.length > 1 ? 's' : ''} — auto-merge not possible:
              </p>
              {conflictKeys.map((name) => (
                <p key={name} style={{ ...dim, fontSize: 12, fontFamily: 'monospace', margin: '2px 0', color: 'oklch(0.72 0.16 45)' }}>
                  {name}
                </p>
              ))}
            </div>
          )}

          {canMerge && (
            <div style={{ background: 'oklch(0.22 0.06 150 / 0.4)', border: '1px solid oklch(0.45 0.18 150 / 0.4)', borderRadius: 6, padding: '8px 12px' }}>
              <p style={{ ...dim, marginBottom: 6, color: 'oklch(0.72 0.18 150)' }}>
                No overlapping edits — merge preview ({mergedNames.length} workout{mergedNames.length !== 1 ? 's' : ''}):
              </p>
              {mergedNames.map((name) => (
                <p key={name} style={{ ...dim, fontSize: 12, fontFamily: 'monospace', margin: '2px 0' }}>
                  {name}
                  {!remoteNames.includes(name) && (
                    <span style={{ ...tag, background: 'oklch(0.35 0.12 250 / 0.4)', color: 'oklch(0.7 0.15 250)', marginLeft: 8 }}>local only</span>
                  )}
                  {!Object.keys(useStore.getState().workouts).includes(name) && remoteNames.includes(name) && (
                    <span style={{ ...tag, background: 'oklch(0.35 0.12 150 / 0.4)', color: 'oklch(0.7 0.15 150)', marginLeft: 8 }}>from remote</span>
                  )}
                </p>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              onClick={onUseRemote}
              style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.8)', fontSize: 13 }}
            >
              Load remote
            </Button>
            <Button
              variant="outline"
              onClick={onMerge}
              disabled={!canMerge}
              title={!canMerge ? 'Cannot auto-merge: same workout edited on both devices' : undefined}
              style={{
                background: 'transparent',
                borderColor: canMerge ? 'oklch(0.55 0.18 150 / 0.6)' : 'rgba(255,255,255,0.1)',
                color: canMerge ? 'oklch(0.72 0.18 150)' : 'rgba(255,255,255,0.25)',
                fontSize: 13,
                cursor: canMerge ? 'pointer' : 'not-allowed',
              }}
            >
              Attempt merge
            </Button>
            <Button
              onClick={onKeepLocal}
              style={{ background: 'oklch(0.50 0.20 25)', color: 'white', fontSize: 13, border: 'none' }}
            >
              Keep local
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
