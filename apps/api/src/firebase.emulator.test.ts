import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { defaultConfig, TypingEngine } from '@ztype/core';
import { createApp } from './app';
import { FirestoreRepository } from './repository';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error('Run with npm run test:emulators. These tests must never access production.');
const projectId = 'demo-ztype';
const admin = initializeApp({ projectId }, 'integration');
const adminAuth = getAuth(admin);
const db = getFirestore(admin);
let server: Server;
let base: string;
const authUrl = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:`;
async function authRequest(method: string, body: object) {
  const response = await fetch(`${authUrl}${method}?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}
async function account(email: string, verified: boolean) {
  const credentials = { email, password: 'Orbit.12345', returnSecureToken: true };
  const signup = await authRequest('signUp', credentials);
  if (!verified) return { uid: signup.localId, token: signup.idToken };
  await adminAuth.updateUser(signup.localId, { emailVerified: true });
  const signed = await authRequest('signInWithPassword', credentials);
  return { uid: signup.localId, token: signed.idToken };
}
beforeAll(async () => {
  const app = createApp({
    repository: new FirestoreRepository(db),
    verifyToken: (token) => adminAuth.verifyIdToken(token, true),
  });
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => (error ? reject(error) : resolve()));
    server.on('error', reject);
  });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
});
afterAll(async () => {
  server?.close();
  await deleteApp(admin);
});
const call = (path: string, token: string, body?: unknown) =>
  fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
describe('Firebase integration', () => {
  it('requires verification, saves atomically, deduplicates concurrent retries, and isolates accounts', async () => {
    const suffix = crypto.randomUUID();
    const alice = await account(`alice-${suffix}@example.com`, true);
    const bob = await account(`bob-${suffix}@example.com`, true);
    const pending = await account(`pending-${suffix}@example.com`, false);
    expect((await call('/me', pending.token)).status).toBe(403);
    const engine = new TypingEngine(defaultConfig, 91);
    engine.applyInput(engine.prompt.slice(0, 12), 0);
    engine.tick(30_000);
    const {
      wpm: _w,
      accuracy: _a,
      mistakes: _m,
      ...attempt
    } = engine.result(crypto.randomUUID(), new Date().toISOString())!;
    const submissions = await Promise.all([
      call('/results', alice.token, attempt),
      call('/results/import', alice.token, { attempts: [attempt] }),
    ]);
    expect(submissions.map((r) => r.status)).toEqual([200, 200]);
    const progress = await (await call('/progress', alice.token)).json();
    expect(progress.totalSessions).toBe(1);
    expect((await (await call('/results', bob.token)).json()).results).toHaveLength(0);
    expect(
      (await (await call('/results?config=en:time:30', alice.token)).json()).results,
    ).toHaveLength(1);
    expect(
      (await (await call('/results?config=en:time:60', alice.token)).json()).results,
    ).toHaveLength(0);
    // A real signed-in browser token still cannot bypass Express and write to Firestore.
    const direct = await fetch(
      `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/users/${alice.uid}`,
      { headers: { Authorization: `Bearer ${alice.token}` } },
    );
    expect(direct.status).toBe(403);
  });
  it('returns stable non-overlapping cursor pages', async () => {
    const user = await account(`pages-${crypto.randomUUID()}@example.com`, true);
    const engine = new TypingEngine(defaultConfig, 90);
    engine.applyInput(engine.prompt.slice(0, 8), 0);
    engine.tick(30_000);
    const attempts = Array.from({ length: 3 }, (_, i) => {
      const {
        wpm: _w,
        accuracy: _a,
        mistakes: _m,
        ...attempt
      } = engine.result(crypto.randomUUID(), new Date(Date.now() - i * 1000).toISOString())!;
      return attempt;
    });
    expect((await call('/results/import', user.token, { attempts })).status).toBe(200);
    const page1 = await (await call('/results?limit=2', user.token)).json();
    const page2 = await (await call(`/results?limit=2&cursor=${page1.cursor}`, user.token)).json();
    expect(page1.results).toHaveLength(2);
    expect(page2.results).toHaveLength(1);
    expect(page2.cursor).toBeNull();
    expect(
      new Set([...page1.results, ...page2.results].map((r: { id: string }) => r.id)).size,
    ).toBe(3);
  });
});
