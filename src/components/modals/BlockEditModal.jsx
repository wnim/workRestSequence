import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import useStore from '../../store/workoutStore';

export function BlockEditModal({ blocks, onClose }) {
  const updateBlock = useStore((s) => s.updateBlock);
  const updateBlocks = useStore((s) => s.updateBlocks);

  const first = blocks[0];
  const isMixed = blocks.some((b) => b.type !== first.type);
  const isMulti = blocks.length > 1;

  const [label, setLabel] = useState(first.label || '');
  const [duration, setDuration] = useState(String(first.duration));
  const [type, setType] = useState(first.type);

  function handleSave() {
    const dur = Math.max(0.1, Math.min(3600, parseFloat(duration) || first.duration));
    const patch = { label, duration: dur, ...(!isMixed ? { type } : {}) };
    if (isMulti) {
      updateBlocks(new Set(blocks.map((b) => b.id)), patch);
    } else {
      updateBlock(first.id, patch);
    }
    onClose();
  }

  const typeButtonWork = {
    work: { background: 'oklch(0.55 0.22 35)' },
    rest: { background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: 'white' },
  };
  const typeButtonRest = {
    rest: { background: 'oklch(0.35 0.05 250)' },
    work: { background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: 'white' },
  };
  const disabledTypeStyle = { opacity: 0.35, pointerEvents: 'none' };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); } }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'white' }}>
            {isMulti ? `Edit ${blocks.length} Blocks` : 'Edit Block'}
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          <div>
            <Label style={{ color: isMixed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)' }}>
              Type{isMixed ? ' (mixed — disabled)' : ''}
            </Label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, ...(isMixed ? disabledTypeStyle : {}) }}>
              <Button
                variant={type === 'work' ? 'default' : 'outline'}
                onClick={() => setType('work')}
                style={typeButtonWork[type === 'work' ? 'work' : 'rest']}
              >
                Work
              </Button>
              <Button
                variant={type === 'rest' ? 'default' : 'outline'}
                onClick={() => setType('rest')}
                style={typeButtonRest[type === 'rest' ? 'rest' : 'work']}
              >
                Rest
              </Button>
            </div>
          </div>

          <div>
            <Label style={{ color: 'rgba(255,255,255,0.7)' }}>Label</Label>
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={isMulti ? 'Apply label to all selected' : 'Optional label'}
              style={{ marginTop: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
            />
          </div>

          <div>
            <Label style={{ color: 'rgba(255,255,255,0.7)' }}>Duration (seconds)</Label>
            <Input
              type="number"
              min={0.1}
              max={3600}
              step={0.1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={{ marginTop: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}>
            Cancel
          </Button>
          <Button onClick={handleSave} style={{ background: 'oklch(0.55 0.22 35)' }}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
