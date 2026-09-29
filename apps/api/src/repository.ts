import { FieldPath, FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  addToProgress,
  configKey,
  defaultPreferences,
  deriveAttempt,
  emptyProgress,
  type Attempt,
  type AttemptInput,
  type Profile,
  type Progress,
} from '@ztype/core';

export type ResultPage = { results: Attempt[]; cursor: string | null };
export type QueryOptions = { limit: number; cursor?: string; config?: string };
export interface Repository {
  profile(uid: string): Promise<Profile>;
  updateProfile(uid: string, patch: Partial<Profile>): Promise<Profile>;
  progress(uid: string): Promise<Progress>;
  save(uid: string, inputs: AttemptInput[]): Promise<{ saved: string[]; progress: Progress }>;
  results(uid: string, options: QueryOptions): Promise<ResultPage>;
}

export function decodeCursor(cursor: string): [string, string] {
  const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[0] !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(parsed[0]) ||
    typeof parsed[1] !== 'string' ||
    !/^[a-f\d-]{36}$/i.test(parsed[1])
  )
    throw new Error('Invalid cursor');
  return parsed as [string, string];
}
export function encodeCursor(attempt: Attempt): string {
  return Buffer.from(JSON.stringify([attempt.completedAt, attempt.id])).toString('base64url');
}

export class FirestoreRepository implements Repository {
  constructor(private db: Firestore) {}
  private user(uid: string) {
    return this.db.collection('users').doc(uid);
  }
  async profile(uid: string): Promise<Profile> {
    const data = (await this.user(uid).get()).data();
    return {
      displayName: data?.displayName ?? 'Explorer',
      preferences: data?.preferences ?? defaultPreferences,
    };
  }
  async updateProfile(uid: string, patch: Partial<Profile>): Promise<Profile> {
    await this.user(uid).set(patch, { merge: true });
    return this.profile(uid);
  }
  async progress(uid: string): Promise<Progress> {
    return (await this.user(uid).get()).data()?.progress ?? emptyProgress();
  }
  async save(uid: string, inputs: AttemptInput[]) {
    const unique = [...new Map(inputs.map((input) => [input.id, input])).values()];
    return this.db.runTransaction(async (transaction) => {
      const user = this.user(uid);
      const userDoc = await transaction.get(user);
      const refs = unique.map((a) => user.collection('results').doc(a.id));
      const existing = await transaction.getAll(...refs);
      let progress: Progress = userDoc.data()?.progress ?? emptyProgress();
      unique.forEach((input, index) => {
        if (existing[index].exists) return;
        const attempt = deriveAttempt(input);
        progress = addToProgress(progress, attempt);
        transaction.set(refs[index], {
          ...attempt,
          configKey: configKey(attempt.config),
          receivedAt: FieldValue.serverTimestamp(),
        });
      });
      transaction.set(user, { progress }, { merge: true });
      return { saved: unique.map((a) => a.id), progress };
    });
  }
  async results(uid: string, options: QueryOptions): Promise<ResultPage> {
    let query = this.user(uid)
      .collection('results')
      .orderBy('completedAt', 'desc')
      .orderBy(FieldPath.documentId(), 'desc');
    if (options.config) query = query.where('configKey', '==', options.config);
    if (options.cursor) query = query.startAfter(...decodeCursor(options.cursor));
    const snapshot = await query.limit(options.limit + 1).get();
    const results = snapshot.docs.slice(0, options.limit).map((doc) => {
      const { configKey: _k, receivedAt: _r, ...result } = doc.data();
      return result as Attempt;
    });
    return {
      results,
      cursor: snapshot.size > options.limit ? encodeCursor(results.at(-1)!) : null,
    };
  }
}
