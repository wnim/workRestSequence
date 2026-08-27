import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import useStore from '../../store/workoutStore';
import { loopsToSerialized, loopsToRuntime } from '../../utils/loops';

function workoutToCode(blocks, loops) {
  const strippedBlocks = blocks.map(({ type, duration, label }) => ({
    type, duration, ...(label ? { label } : {}),
  }));
  const serializedLoops = loopsToSerialized(blocks, loops);
  const obj = serializedLoops.length > 0
    ? { blocks: strippedBlocks, loops: serializedLoops }
    : strippedBlocks;
  return JSON.stringify(obj, null, 2);
}

function parseWorkout(text) {
  const parsed = JSON.parse(text);
  let rawBlocks, rawLoops;
  if (Array.isArray(parsed)) {
    rawBlocks = parsed;
    rawLoops = [];
  } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.blocks)) {
    rawBlocks = parsed.blocks;
    rawLoops = parsed.loops ?? [];
  } else {
    throw new Error('Expected an array of blocks, or an object with a "blocks" array');
  }

  const blocks = rawBlocks.map((b, i) => {
    if (b.type !== 'work' && b.type !== 'rest') throw new Error(`Block ${i}: invalid type "${b.type}" — must be "work" or "rest"`);
    const duration = Number(b.duration);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Block ${i}: invalid duration "${b.duration}"`);
    return { id: uuid(), type: b.type, duration, label: b.label ?? '' };
  });

  const serializedLoops = (Array.isArray(rawLoops) ? rawLoops : []).map((l, i) => {
    const si = Number(l.startIndex), ei = Number(l.endIndex), count = Number(l.count);
    if (!Number.isInteger(si) || si < 0 || si >= blocks.length) throw new Error(`Loop ${i}: startIndex ${si} out of range`);
    if (!Number.isInteger(ei) || ei < si || ei >= blocks.length) throw new Error(`Loop ${i}: endIndex ${ei} out of range`);
    if (!Number.isInteger(count) || count < 2) throw new Error(`Loop ${i}: count must be an integer >= 2`);
    return { startIndex: si, endIndex: ei, count };
  });

  return { blocks, loops: loopsToRuntime(blocks, serializedLoops) };
}

export function CodeEditorModal({ onClose }) {
  const blocks = useStore((s) => s.blocks);
  const loops = useStore((s) => s.loops);
  const setBlocksAndLoops = useStore((s) => s.setBlocksAndLoops);

  const [code, setCode] = useState(() => workoutToCode(blocks, loops));
  const [error, setError] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');

  const matchCount = searchTerm ? (code.split(searchTerm).length - 1) : 0;

  function handleReplaceAll() {
    if (!searchTerm) return;
    setCode(code.split(searchTerm).join(replaceTerm));
  }

  function handleApply() {
    try {
      const { blocks: newBlocks, loops: newLoops } = parseWorkout(code);
      setBlocksAndLoops(newBlocks, newLoops);
      setError(null);
      onClose();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: 'white', minWidth: 500 }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'white' }}>Edit as JSON</DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Blocks array, or <code style={{ color: 'rgba(255,255,255,0.6)' }}>{'{blocks, loops}'}</code> object.
            Loops use <code style={{ color: 'rgba(255,255,255,0.6)' }}>startIndex</code>, <code style={{ color: 'rgba(255,255,255,0.6)' }}>endIndex</code>, <code style={{ color: 'rgba(255,255,255,0.6)' }}>count</code>.
          </p>
          <button
            onClick={() => setShowSearch((v) => !v)}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', padding: '3px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {showSearch ? 'hide replace' : 'find & replace'}
          </button>
        </div>

        {showSearch && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              placeholder="Find"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1, background: '#0d0e1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#c9d1d9', fontFamily: 'monospace', fontSize: 12, padding: '4px 8px', outline: 'none' }}
            />
            <input
              placeholder="Replace"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              style={{ flex: 1, background: '#0d0e1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#c9d1d9', fontFamily: 'monospace', fontSize: 12, padding: '4px 8px', outline: 'none' }}
            />
            <Button
              onClick={handleReplaceAll}
              disabled={!searchTerm}
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 12, padding: '4px 10px', flexShrink: 0 }}
            >
              Replace all
            </Button>
            {searchTerm && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                {matchCount} match{matchCount !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
        )}

        <textarea
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(null); }}
          spellCheck={false}
          style={{
            width: '100%', height: 320, resize: 'vertical', boxSizing: 'border-box',
            background: '#0d0e1a', border: `1px solid ${error ? 'oklch(0.6 0.2 25)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 6, color: '#c9d1d9', fontFamily: 'monospace', fontSize: 13,
            padding: '12px', outline: 'none', lineHeight: 1.6,
          }}
        />

        {error && (
          <p style={{ fontSize: 12, color: 'oklch(0.7 0.2 25)', margin: 0 }}>⚠ {error}</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={onClose} style={{ background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.15)', fontSize: 13 }}>
            Cancel
          </Button>
          <Button onClick={handleApply} style={{ background: 'oklch(0.55 0.18 250)', color: 'white', fontSize: 13 }}>
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
