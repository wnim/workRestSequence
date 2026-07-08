import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import useStore from '../../store/workoutStore';
import { requestDeviceCode, pollForToken, findWorkoutGists, createGist } from '../../utils/gist';
import { GITHUB_CLIENT_ID, GIST_FILENAME, LS_GIST_CONFIG } from '../../utils/constants';

// phases: 'connected' | 'auth' | 'resolving' | 'error'
export function GistSetupModal({ onClose }) {
  const setGistConfig = useStore((s) => s.setGistConfig);
  const setWorkouts = useStore((s) => s.setWorkouts);
  const gistConfig = useStore((s) => s.gistConfig);

  const [phase, setPhase] = useState(gistConfig?.gistId ? 'connected' : 'auth');
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  function handleDisconnect() {
    localStorage.removeItem(LS_GIST_CONFIG);
    setGistConfig(null);
    onClose();
  }

  // Kick off device code request on mount
  useEffect(() => {
    if (phase === 'connected' || polling) return;
    setPolling(true);
    const abort = new AbortController();

    requestDeviceCode(GITHUB_CLIENT_ID)
      .then((info) => {
        setDeviceInfo(info);
        return pollForToken(GITHUB_CLIENT_ID, info.device_code, info.interval, abort.signal);
      })
      .then((token) => {
        setPolling(false);
        resolveWithToken(token);
      })
      .catch((err) => {
        if (err.message === 'Cancelled') return;
        setError(err.message);
        setPhase('error');
        setPolling(false);
      });

    return () => abort.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open GitHub tab AFTER the code is rendered
  useEffect(() => {
    if (deviceInfo?.verification_uri_complete) {
      window.open(deviceInfo.verification_uri_complete, '_blank');
    }
  }, [deviceInfo]);

  async function resolveWithToken(token) {
    setPhase('resolving');
    try {
      const found = await findWorkoutGists(token);
      let gistId, remoteWorkouts = null;
      if (found.length > 0) {
        gistId = found[0].gistId;
        remoteWorkouts = found[0].data.workouts;
      } else {
        gistId = await createGist(token, GIST_FILENAME);
      }
      const cfg = { gistId, token, filename: GIST_FILENAME };
      localStorage.setItem(LS_GIST_CONFIG, JSON.stringify(cfg));
      setGistConfig(cfg);
      if (remoteWorkouts) setWorkouts({ ...remoteWorkouts, ...useStore.getState().workouts });
      onClose();
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  }

  function handleCopy() {
    if (!deviceInfo?.user_code) return;
    navigator.clipboard.writeText(deviceInfo.user_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const dim = { color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: 13 };
  const codeStyle = {
    fontFamily: 'monospace', fontSize: 28, fontWeight: 700, letterSpacing: 4,
    padding: '12px 24px', borderRadius: 8, cursor: 'pointer', display: 'inline-block',
    background: copied ? 'oklch(0.25 0.08 150)' : 'rgba(255,255,255,0.08)',
    border: `2px solid ${copied ? 'oklch(0.55 0.18 150)' : 'rgba(255,255,255,0.15)'}`,
    color: copied ? 'oklch(0.75 0.18 150)' : 'white',
    transition: 'all 0.15s',
    userSelect: 'none',
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'white' }}>Connect to GitHub</DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>

          {phase === 'connected' && (
            <>
              <p style={dim}>Connected to GitHub. Your workouts sync automatically.</p>
              <p style={{ ...dim, fontSize: 11, wordBreak: 'break-all' }}>Gist: {gistConfig?.gistId}</p>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                style={{ background: 'transparent', borderColor: 'oklch(0.45 0.2 35)', color: 'oklch(0.65 0.22 35)', alignSelf: 'flex-start' }}
              >
                Disconnect from GitHub
              </Button>
            </>
          )}

          {phase === 'auth' && !deviceInfo && (
            <p style={dim}>Requesting a code from GitHub…</p>
          )}

          {phase === 'auth' && deviceInfo && (
            <>
              <div>
                <p style={{ ...dim, marginBottom: 8 }}>1. Copy this code:</p>
                <div style={{ textAlign: 'center' }}>
                  <span style={codeStyle} onClick={handleCopy} title="Click to copy">
                    {deviceInfo.user_code}
                  </span>
                  <p style={{ ...dim, marginTop: 6, fontSize: 11 }}>
                    {copied ? 'Copied!' : 'Click the code to copy it'}
                  </p>
                </div>
              </div>

              <div>
                <p style={{ ...dim, marginBottom: 6 }}>2. Paste it on this page (opened automatically):</p>
                <a
                  href={deviceInfo.verification_uri_complete ?? deviceInfo.verification_uri}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: 'oklch(0.65 0.18 250)', fontSize: 13, wordBreak: 'break-all' }}
                >
                  {deviceInfo.verification_uri_complete ?? deviceInfo.verification_uri}
                </a>
              </div>

              <p style={dim}>Waiting for you to authorize on GitHub…</p>
            </>
          )}

          {phase === 'resolving' && (
            <p style={dim}>Authorized! Finding your workout gist…</p>
          )}

          {phase === 'error' && (
            <>
              <p style={{ color: 'oklch(0.65 0.22 35)', margin: 0, fontSize: 13 }}>{error}</p>
              <Button variant="outline" onClick={onClose}
                style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', color: 'white', alignSelf: 'flex-start' }}>
                Close
              </Button>
            </>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
