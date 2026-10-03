import { openDB } from 'idb';
import {
  addToProgress,
  campaignProgress,
  type CampaignProgress,
  defaultPreferences,
  emptyProgress,
  type Attempt,
  type Preferences,
  type Progress,
  type MissionResult,
} from '@ztype/core';

export type LocalData = {
  attempts: Attempt[];
  progress: Progress;
  preferences: Preferences;
  pending: string[];
  preferencesPending: boolean;
  displayName: string;
  missionRuns?: MissionResult[];
  campaign?: CampaignProgress;
};
const memory = new Map<string, LocalData>();
const locks = new Map<string, Promise<unknown>>();
let failed = false;
export const storageFailed = () => failed;
const database = () =>
  openDB('ztype-v1', 1, {
    upgrade(db) {
      db.createObjectStore('profiles');
    },
  });
const fresh = (): LocalData => ({
  attempts: [],
  progress: emptyProgress(),
  preferences: {
    ...defaultPreferences,
    scene: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'focus' : 'space',
  },
  pending: [],
  preferencesPending: false,
  displayName: 'Explorer',
  missionRuns: [],
  campaign: {},
});

export async function readLocal(owner: string): Promise<LocalData> {
  if (failed) return structuredClone(memory.get(owner) ?? fresh());
  try {
    const db = await database();
    const value: LocalData = (await db.get('profiles', owner)) ?? fresh();
    db.close();
    // Old Moon wins migrate on read; the permanent summary outlives the 100-run log.
    value.campaign = campaignProgress(value.missionRuns ?? [], value.campaign);
    memory.set(owner, value);
    return structuredClone(value);
  } catch {
    failed = true;
    return structuredClone(memory.get(owner) ?? fresh());
  }
}

export async function changeLocal(
  owner: string,
  change: (data: LocalData) => LocalData,
): Promise<LocalData> {
  const previous = locks.get(owner) ?? Promise.resolve();
  const apply = async () => {
    const value = change(await readLocal(owner));
    memory.set(owner, structuredClone(value));
    if (!failed) {
      try {
        const db = await database();
        await db.put('profiles', value, owner);
        db.close();
      } catch {
        failed = true;
      }
    }
    return value;
  };
  const next = previous
    .catch(() => {})
    .then(
      async () =>
        await (navigator.locks ? navigator.locks.request(`ztype:${owner}`, apply) : apply()),
    );
  locks.set(owner, next);
  try {
    return await next;
  } finally {
    if (locks.get(owner) === next) locks.delete(owner);
  }
}

export function mergeAttempts(a: Attempt[], b: Attempt[], pending: string[] = []): Attempt[] {
  const sorted = [...new Map([...a, ...b].map((r) => [r.id, r])).values()].sort((x, y) =>
    y.completedAt.localeCompare(x.completedAt),
  );
  return sorted.filter((r, i) => i < 100 || pending.includes(r.id));
}

export function storeAttempt(owner: string, attempt: Attempt): Promise<LocalData> {
  return changeLocal(owner, (current) => {
    if (current.attempts.some((a) => a.id === attempt.id)) return current;
    const pending = owner === 'guest' ? current.pending : [...current.pending, attempt.id];
    return {
      ...current,
      attempts: mergeAttempts(current.attempts, [attempt], pending),
      pending,
      progress: addToProgress(current.progress, attempt),
    };
  });
}

export async function clearGuest(): Promise<LocalData> {
  return changeLocal('guest', (current) => ({ ...fresh(), preferences: current.preferences }));
}
