import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import useStore from '../../store/workoutStore';

export function WorkoutManagerModal({ onClose, onLoad }) {
  const workouts = useStore((s) => s.workouts);
  const activeWorkoutName = useStore((s) => s.activeWorkoutName);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const saveWorkout = useStore((s) => s.saveWorkout);

  const names = Object.keys(workouts).sort();

  function handleNew() {
    const name = `Workout ${names.length + 1}`;
    saveWorkout(name);
    onClose();
  }

  function handleLoad(name) {
    onLoad(name);
    onClose();
  }

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: 'white', minWidth: 360 }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'white' }}>Workouts</DialogTitle>
        </DialogHeader>

        <div>
          <Button
            onClick={handleNew}
            style={{ width: '100%', marginBottom: 12, background: 'oklch(0.45 0.12 250 / 0.5)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.15)', fontSize: 13 }}
          >
            + New workout
          </Button>

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {names.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No saved workouts yet.</p>
            )}
            {names.map((name) => (
              <div
                key={name}
                style={{
                  ...rowStyle,
                  background: name === activeWorkoutName ? 'rgba(255,255,255,0.08)' : 'transparent',
                }}
                onMouseEnter={(e) => { if (name !== activeWorkoutName) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (name !== activeWorkoutName) e.currentTarget.style.background = 'transparent'; }}
              >
                <span
                  onClick={() => handleLoad(name)}
                  style={{ flex: 1, fontSize: 13, color: name === activeWorkoutName ? 'oklch(0.75 0.15 200)' : 'white', cursor: 'pointer' }}
                >
                  {name}
                </span>
                <Button
                  onClick={(e) => { e.stopPropagation(); deleteWorkout(name); }}
                  style={{ background: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: 11, height: 24, padding: '0 8px', border: 'none' }}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
