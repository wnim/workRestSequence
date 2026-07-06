import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import useStore from '../../store/workoutStore';
import { fetchGistData, createGist, extractGistId } from '../../utils/gist';
import { GIST_FILENAME, LS_GIST_CONFIG } from '../../utils/constants';

export function GistSetupModal({ onClose }) {
  const setGistConfig = useStore((s) => s.setGistConfig);
  const setWorkouts = useStore((s) => s.setWorkouts);
  const gistConfig = useStore((s) => s.gistConfig);

  const [token, setToken] = useState(gistConfig?.token || '');
  const [gistInput, setGistInput] = useState(gistConfig?.gistId || '');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreateGist() {
    if (!token) { setStatus('Enter a PAT first.'); return; }
    setLoading(true);
    try {
      const id = await createGist(token, GIST_FILENAME);
      setGistInput(id);
      setStatus('Gist created: ' + id);
    } catch (e) {
      setStatus('Error: ' + e.message);
    } finally { setLoading(false); }
  }

  async function handleSave() {
    const gistId = extractGistId(gistInput);
    if (!token || !gistId) { setStatus('Token and Gist ID are required.'); return; }
    setLoading(true);
    try {
      const data = await fetchGistData(gistId, token);
      const cfg = { gistId, token, filename: GIST_FILENAME };
      localStorage.setItem(LS_GIST_CONFIG, JSON.stringify(cfg));
      setGistConfig(cfg);
      if (data?.workouts) setWorkouts(data.workouts);
      setStatus('Connected!');
      setTimeout(onClose, 800);
    } catch (e) {
      setStatus('Error: ' + e.message);
    } finally { setLoading(false); }
  }

  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', marginTop: 6 };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'white' }}>Gist Sync Setup</DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0', fontSize: 13 }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            Create a GitHub PAT with <code>gist</code> scope, then paste it below.
          </p>

          <div>
            <Label style={{ color: 'rgba(255,255,255,0.7)' }}>GitHub PAT</Label>
            <Input type="text" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_..." style={inputStyle} />
          </div>

          <div>
            <Label style={{ color: 'rgba(255,255,255,0.7)' }}>Gist ID or URL</Label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <Input value={gistInput} onChange={(e) => setGistInput(e.target.value)} placeholder="Gist ID or URL" style={{ ...inputStyle, flex: 1 }} />
              <Button variant="outline" onClick={handleCreateGist} disabled={loading}
                style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: 'white', marginTop: 6 }}>
                Create new
              </Button>
            </div>
          </div>

          {status && <p style={{ color: status.startsWith('Error') ? 'oklch(0.65 0.22 35)' : 'oklch(0.7 0.15 150)', margin: 0 }}>{status}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading} style={{ background: 'oklch(0.55 0.22 35)' }}>
            {loading ? 'Connecting…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
