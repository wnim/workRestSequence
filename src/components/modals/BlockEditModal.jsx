import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import useStore from '../../store/workoutStore';

export function BlockEditModal({ block, onClose }) {
  const updateBlock = useStore((s) => s.updateBlock);
  const [label, setLabel] = useState(block.label || '');
  const [duration, setDuration] = useState(String(block.duration));
  const [type, setType] = useState(block.type);

  function handleSave() {
    const dur = Math.max(1, Math.min(3600, parseInt(duration, 10) || block.duration));
    updateBlock(block.id, { label, duration: dur, type });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'white' }}>Edit Block</DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          <div>
            <Label style={{ color: 'rgba(255,255,255,0.7)' }}>Type</Label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <Button
                variant={type === 'work' ? 'default' : 'outline'}
                onClick={() => setType('work')}
                style={type === 'work' ? { background: 'oklch(0.55 0.22 35)' } : { background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
              >
                Work
              </Button>
              <Button
                variant={type === 'rest' ? 'default' : 'outline'}
                onClick={() => setType('rest')}
                style={type === 'rest' ? { background: 'oklch(0.35 0.05 250)' } : { background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
              >
                Rest
              </Button>
            </div>
          </div>

          <div>
            <Label style={{ color: 'rgba(255,255,255,0.7)' }}>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional label"
              style={{ marginTop: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
            />
          </div>

          <div>
            <Label style={{ color: 'rgba(255,255,255,0.7)' }}>Duration (seconds)</Label>
            <Input
              type="number"
              min={1}
              max={3600}
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
