import { useState, useRef, useEffect } from 'react';
import useStore from '../../store/workoutStore';

export function WorkoutPicker({ onLoad }) {
  const workouts = useStore((s) => s.workouts);
  const activeWorkoutName = useStore((s) => s.activeWorkoutName);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const saveWorkout = useStore((s) => s.saveWorkout);

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const containerRef = useRef(null);
  const pendingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  const names = Object.keys(workouts).sort();

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  function handleCreate() {
    const name = newName.trim() || `Workout ${names.length + 1}`;
    saveWorkout(name);
    setNewName('');
    setOpen(false);
  }

  function handleLoad(name) {
    onLoad(name);
    setOpen(false);
  }

  function armDelete(name) {
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    setPendingDelete(name);
    pendingTimeoutRef.current = setTimeout(() => setPendingDelete(null), 2600);
  }

  function handleDelete(e, name) {
    e.stopPropagation();
    if (pendingDelete === name) {
      clearTimeout(pendingTimeoutRef.current);
      setPendingDelete(null);
      deleteWorkout(name);
    } else {
      armDelete(name);
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: open ? 'rgba(255,255,255,0.08)' : 'none',
          border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: 'monospace',
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 6px', borderRadius: 4,
        }}
      >
        {activeWorkoutName ?? 'Untitled'}
        <span style={{
          display: 'inline-block', width: 5, height: 5, flexShrink: 0,
          borderRight: '1.5px solid rgba(255,255,255,0.35)',
          borderBottom: '1.5px solid rgba(255,255,255,0.35)',
          transform: 'rotate(45deg)', marginBottom: 3,
        }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8, minWidth: 240, padding: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder="New workout name…"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4,
                color: 'white', fontSize: 12, padding: '4px 8px', fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <button
              onClick={handleCreate}
              style={{
                background: 'oklch(0.45 0.12 250 / 0.5)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 4, color: 'rgba(255,255,255,0.85)', fontSize: 13,
                padding: '0 10px', cursor: 'pointer', lineHeight: 1,
              }}
            >+</button>
          </div>

          {names.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginBottom: 4 }} />
          )}

          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {names.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', padding: '8px 0', margin: 0 }}>
                No saved workouts yet.
              </p>
            )}
            {names.map((name) => {
              const active = name === activeWorkoutName;
              const armed = pendingDelete === name;
              return (
                <div
                  key={name}
                  onClick={() => handleLoad(name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 8px', borderRadius: 5, cursor: 'pointer',
                    background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'rgba(255,255,255,0.1)' : 'transparent'; }}
                >
                  <span style={{ flex: 1, fontSize: 13, color: active ? 'oklch(0.75 0.15 200)' : 'white' }}>
                    {name}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, name)}
                    title={armed ? 'Click again to confirm delete' : 'Delete'}
                    style={{
                      background: armed ? 'oklch(0.45 0.2 25 / 0.6)' : 'transparent',
                      color: armed ? 'oklch(0.85 0.15 25)' : 'rgba(255,255,255,0.3)',
                      fontSize: 11, padding: '1px 5px', border: 'none',
                      borderRadius: 3, cursor: 'pointer',
                    }}
                  >
                    {armed ? '⚠' : '✕'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
