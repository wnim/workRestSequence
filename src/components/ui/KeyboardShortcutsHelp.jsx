import { useEffect, useRef } from 'react';

const SHORTCUTS = [
  {
    topic: 'Playback',
    items: [
      { keys: ['Space'], description: 'Play / Pause' },
      { keys: ['Esc'], description: 'Stop' },
    ],
  },
  {
    topic: 'Navigation',
    items: [
      { keys: ['Ctrl', 'Scroll'], description: 'Zoom in / out' },
      { keys: ['Scroll'], description: 'Pan timeline' },
    ],
  },
  {
    topic: 'Editing',
    items: [
      { keys: ['Del'], description: 'Delete selected' },
      { keys: ['Ctrl', 'C'], description: 'Copy' },
      { keys: ['Ctrl', 'V'], description: 'Paste' },
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Y'], description: 'Redo' },
      { keys: ['?'], description: 'Show / hide help' },
    ],
  },
];

function Kbd({ children }) {
  return (
    <kbd style={{
      display: 'inline-block',
      padding: '1px 6px',
      background: 'rgba(255,255,255,0.10)',
      border: '1px solid rgba(255,255,255,0.22)',
      borderRadius: 4,
      fontSize: 11,
      fontFamily: 'monospace',
      color: 'rgba(255,255,255,0.85)',
      lineHeight: '18px',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </kbd>
  );
}

function ShortcutRow({ keys, description }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{description}</span>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
      </div>
    </div>
  );
}

export function KeyboardShortcutsHelp({ open, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key !== '?') onClose();
    };
    const handleMouseDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      onClose();
    };
    window.addEventListener('keydown', handleKey, { capture: true });
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKey, { capture: true });
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [open, onClose]);

  return (
    <div style={{ position: 'fixed', top: 52, right: 16, zIndex: 100, pointerEvents: 'none' }}>
      <div
        ref={panelRef}
        style={{
          background: '#2a2c42',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 8,
          padding: '14px 16px',
          minWidth: 280,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          transformOrigin: 'top right',
          transform: open ? 'scale(1)' : 'scale(0)',
          opacity: open ? 1 : 0,
          transition: 'transform 0.18s ease, opacity 0.13s ease',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {SHORTCUTS.map((section) => (
            <div key={section.topic} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                {section.topic}
              </span>
              {section.items.map((s) => (
                <ShortcutRow key={s.description} {...s} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
