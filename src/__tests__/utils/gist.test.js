import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractGistId, fetchGistData, saveGistData, createGist } from '../../utils/gist';

describe('extractGistId', () => {
  it('extracts a bare gist ID', () => {
    expect(extractGistId('abc123def456abc123def456abc12345')).toBe('abc123def456abc123def456abc12345');
  });

  it('extracts ID from a full gist URL', () => {
    expect(extractGistId('https://gist.github.com/user/abc123def456abc123def4')).toBe('abc123def456abc123def4');
  });

  it('returns null for empty string', () => {
    expect(extractGistId('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(extractGistId(null)).toBeNull();
  });

  it('returns null for strings shorter than 20 hex chars', () => {
    expect(extractGistId('abc123')).toBeNull();
  });
});

describe('fetchGistData', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('fetches and parses file content', async () => {
    const payload = { workouts: { myWorkout: { name: 'myWorkout', blocks: [] } } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        files: {
          'pulse_timer.json': {
            content: JSON.stringify(payload),
            truncated: false,
          },
        },
      }),
    });

    const result = await fetchGistData('somegistid12345678901', 'token123');
    expect(result).toEqual(payload);
  });

  it('fetches raw URL when file is truncated', async () => {
    const payload = { workouts: {} };
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: {
            'pulse_timer.json': {
              content: '',
              truncated: true,
              raw_url: 'https://raw.example.com/gist',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        text: async () => JSON.stringify(payload),
      });

    const result = await fetchGistData('somegistid12345678901', 'token123');
    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][0]).toBe('https://raw.example.com/gist');
  });

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });

    await expect(fetchGistData('somegistid12345678901', 'token123')).rejects.toThrow('404');
  });

  it('returns null when gist has no files', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: {} }),
    });

    const result = await fetchGistData('somegistid12345678901', 'token123');
    expect(result).toBeNull();
  });
});

describe('saveGistData', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('PATCHes the gist with serialized content', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    await saveGistData('gistid12345678901234', 'token', 'pulse_timer.json', { workouts: {} });

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/gists/gistid12345678901234');
    expect(opts.method).toBe('PATCH');
    const body = JSON.parse(opts.body);
    expect(body.files['pulse_timer.json'].content).toContain('"workouts"');
  });
});

describe('createGist', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('POSTs and returns the new gist ID', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'newgistid12345678901234' }),
    });

    const id = await createGist('token', 'pulse_timer.json');
    expect(id).toBe('newgistid12345678901234');
    expect(global.fetch.mock.calls[0][1].method).toBe('POST');
  });
});
