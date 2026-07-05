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
