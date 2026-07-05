import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import useStore from '../../store/workoutStore';

export function WorkoutManagerModal({ onClose }) {
  const workouts = useStore((s) => s.workouts);
  const blocks = useStore((s) => s.blocks);
  const activeWorkoutName = useStore((s) => s.activeWorkoutName);
  const loadWorkout = useStore((s) => s.loadWorkout);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const renameWorkout = useStore((s) => s.renameWorkout);
  const saveWorkout = useStore((s) => s.saveWorkout);
  const [renamingName, setRenamingName] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [newName, setNewName] = useState('');

  const names = Object.keys(workouts).sort();

  const hasUnsaved = activeWorkoutName
    ? JSON.stringify(blocks) !== JSON.stringify(workouts[activeWorkoutName]?.blocks ?? [])
    : blocks.length > 0;

  function handleLoad(name) { loadWorkout(name); onClose(); }

  function handleSaveCurrent() {
    if (activeWorkoutName) { saveWorkout(activeWorkoutName); return; }
    const name = newName.trim();
    if (!name) return;
    saveWorkout(name);
    setNewName('');
  }

  const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' };
  const btnStyle = { background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 12, height: 28, padding: '0 10px' };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: 'white', minWidth: 420 }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'white' }}>Workouts</DialogTitle>
        </DialogHeader>

        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {names.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No saved workouts yet.</p>
          )}
          {names.map((name) => (
            <div key={name} style={rowStyle}>
              {renamingName === name ? (
                <>
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { renameWorkout(name, renameValue.trim()); setRenamingName(null); }
                      if (e.key === 'Escape') setRenamingName(null);
                    }}
                    autoFocus
                    style={{ flex: 1, height: 28, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: 13 }}
                  />
                  <Button variant="outline" style={btnStyle} onClick={() => { renameWorkout(name, renameValue.trim()); setRenamingName(null); }}>OK</Button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 13, color: name === activeWorkoutName ? 'oklch(0.75 0.15 200)' : 'white' }}>{name}</span>
                  <Button variant="outline" style={btnStyle} onClick={() => handleLoad(name)}>Load</Button>
                  <Button variant="outline" style={btnStyle} onClick={() => { setRenamingName(name); setRenameValue(name); }}>Rename</Button>
                  <Button variant="outline" style={{ ...btnStyle, color: 'oklch(0.7 0.2 30)' }} onClick={() => deleteWorkout(name)}>Delete</Button>
                </>
              )}
            </div>
          ))}
        </div>

        {hasUnsaved && (
          <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
              {activeWorkoutName ? `Unsaved changes to "${activeWorkoutName}"` : 'Unsaved workout'}
            </div>
            {!activeWorkoutName && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name this workout"
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: 13 }}
                />
              </div>
            )}
            <Button onClick={handleSaveCurrent} style={{ background: 'oklch(0.55 0.22 35)', width: '100%' }}>
              {activeWorkoutName ? `Save "${activeWorkoutName}"` : 'Save as new'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
