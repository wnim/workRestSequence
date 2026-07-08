import { AUTH_PROXY, GIST_FILENAME } from './constants';

const API = 'https://api.github.com';

async function apiFetch(path, options, token) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  return res;
}

export async function fetchGistData(gistId, token) {
  const res = await apiFetch(`/gists/${gistId}`, {}, token);
  const data = await res.json();
  const files = data.files || {};
  const fileKeys = Object.keys(files);
  if (fileKeys.length === 0) return null;
  const file = files[fileKeys[0]];
  let content = file.content;
  if (file.truncated) {
    const raw = await fetch(file.raw_url);
    content = await raw.text();
  }
  return JSON.parse(content);
}

export async function saveGistData(gistId, token, filename, content) {
  await apiFetch(`/gists/${gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [filename]: { content: JSON.stringify(content, null, 2) } } }),
  }, token);
}

export function saveGistDataKeepalive(gistId, token, filename, content) {
  const url = `${API}/gists/${gistId}`;
  const body = JSON.stringify({
    files: { [filename]: { content: JSON.stringify(content, null, 2) } },
  });
  navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
}

export async function createGist(token, filename, description = 'pulse-timer workouts') {
  const res = await apiFetch('/gists', {
    method: 'POST',
    body: JSON.stringify({
      description,
      public: false,
      files: { [filename]: { content: JSON.stringify({ workouts: {} }, null, 2) } },
    }),
  }, token);
  const data = await res.json();
  return data.id;
}

export function extractGistId(input) {
  if (!input) return null;
  const match = input.match(/([a-f0-9]{20,})/i);
  return match ? match[1] : null;
}

export async function requestDeviceCode(clientId) {
  const res = await fetch(`${AUTH_PROXY}/device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!res.ok) throw new Error(`Auth proxy error ${res.status}`);
  return res.json();
}

export function pollForToken(clientId, deviceCode, intervalSecs, signal) {
  return new Promise((resolve, reject) => {
    let delay = intervalSecs * 1000;
    const attempt = async () => {
      if (signal?.aborted) { reject(new Error('Cancelled')); return; }
      try {
        const res = await fetch(`${AUTH_PROXY}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, device_code: deviceCode }),
        });
        const data = await res.json();
        if (data.access_token) { resolve(data.access_token); return; }
        switch (data.error) {
          case 'authorization_pending': break;
          case 'slow_down': delay += 5000; break;
          case 'expired_token': reject(new Error('Code expired. Please try again.')); return;
          case 'access_denied': reject(new Error('Access denied.')); return;
          default: reject(new Error(data.error_description ?? data.error ?? 'Unknown error')); return;
        }
      } catch (err) { reject(err); return; }
      if (!signal?.aborted) setTimeout(attempt, delay);
    };
    setTimeout(attempt, delay);
  });
}

export async function findWorkoutGists(token) {
  const res = await apiFetch('/gists?per_page=100', {}, token);
  const gists = await res.json();
  const results = [];
  for (const gist of gists) {
    const file = Object.values(gist.files).find((f) => f.filename === GIST_FILENAME);
    if (!file) continue;
    try {
      const content = file.truncated
        ? await fetch(file.raw_url).then((r) => r.text())
        : file.content;
      const data = JSON.parse(content);
      if (data?.workouts) results.push({ gistId: gist.id, data });
    } catch { /* skip unparseable */ }
  }
  return results;
}
