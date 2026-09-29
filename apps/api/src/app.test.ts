import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from './app';
import type { Repository } from './repository';
import {
  addToProgress,
  defaultConfig,
  defaultPreferences,
  deriveAttempt,
  emptyProgress,
  TypingEngine,
  type Attempt,
  type AttemptInput,
  type Progress,
} from '@ztype/core';

const rows = new Map<string, Map<string, Attempt>>();
const summaries = new Map<string, Progress>();
const repository: Repository = {
  async profile() {
    return { displayName: 'Explorer', preferences: defaultPreferences };
  },
  async updateProfile(_uid, patch) {
    return { displayName: 'Explorer', preferences: defaultPreferences, ...patch };
  },
  async progress(uid) {
    return summaries.get(uid) ?? emptyProgress();
  },
  async results(uid) {
    return { results: [...(rows.get(uid)?.values() ?? [])], cursor: null };
  },
  async save(uid, inputs) {
    const own = rows.get(uid) ?? new Map<string, Attempt>();
    let progress = summaries.get(uid) ?? emptyProgress();
    for (const input of inputs)
      if (!own.has(input.id)) {
        const result = deriveAttempt(input);
        own.set(input.id, result);
        progress = addToProgress(progress, result);
      }
    rows.set(uid, own);
    summaries.set(uid, progress);
    return { saved: inputs.map((a) => a.id), progress };
  },
};
let server: Server;
let url: string;
beforeAll(async () => {
  const app = createApp({
    repository,
    verifyToken: async (token) => {
      if (token === 'invalid') throw new Error('invalid');
      return { uid: token, email_verified: token !== 'unverified' };
    },
  });
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => (error ? reject(error) : resolve()));
    server.on('error', reject);
  });
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => server.close());
function request(path: string, token?: string, body?: unknown, method?: string) {
  return fetch(url + '/api' + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function sample(): AttemptInput {
  const e = new TypingEngine(defaultConfig, 7);
  e.applyInput(e.prompt.slice(0, 10), 0);
  e.tick(30_000);
  const {
    wpm: _w,
    accuracy: _a,
    mistakes: _m,
    ...input
  } = e.result('5481d5da-7c50-4c4d-9366-9df1d0b5c20c', new Date().toISOString())!;
  return input;
}
describe('private API', () => {
  it('requires a verified identity and never caches private responses', async () => {
    expect((await request('/me')).status).toBe(401);
    expect((await request('/me', 'invalid')).status).toBe(401);
    expect((await request('/me', 'unverified')).status).toBe(403);
    const response = await request('/me', 'alice');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('deduplicates imports and isolates histories between accounts', async () => {
    const attempt = sample();
    expect((await request('/results', 'alice', attempt)).status).toBe(200);
    expect(
      (await request('/results/import', 'alice', { attempts: [attempt, attempt] })).status,
    ).toBe(200);
    expect((await (await request('/progress', 'alice')).json()).totalSessions).toBe(1);
    expect((await (await request('/results', 'bob')).json()).results).toHaveLength(0);
  });
  it('rejects forged metrics, incomplete runs, ownership fields and invalid cursors', async () => {
    expect((await request('/results', 'alice', { ...sample(), wpm: 1000 })).status).toBe(400);
    expect((await request('/results', 'alice', { ...sample(), elapsedMs: 100 })).status).toBe(400);
    expect(
      (await request('/results', 'alice', { ...sample(), correctCharacters: 9999 })).status,
    ).toBe(400);
    expect((await request('/me', 'alice', { uid: 'bob' }, 'PATCH')).status).toBe(400);
    expect((await request('/results?cursor=bad', 'alice')).status).toBe(400);
  });
});
