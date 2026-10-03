import { t } from '../i18n';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onIdTokenChanged, signOut, type User } from 'firebase/auth';
import {
  addToProgress,
  campaignProgress,
  emptyProgress,
  type Attempt,
  type Preferences,
  type Profile,
  type Progress,
  type MissionResult,
} from '@ztype/core';
import { api, attemptInput, auth } from '../lib/firebase';
import {
  changeLocal,
  clearGuest,
  mergeAttempts,
  readLocal,
  storageFailed,
  storeAttempt,
  type LocalData,
} from '../lib/storage';

type AppState = {
  user: User | null;
  owner: string;
  ready: boolean;
  data: LocalData | null;
  guestCount: number;
  syncing: boolean;
  syncError: string;
  storageError: boolean;
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  saveAttempt: (attempt: Attempt) => Promise<void>;
  saveMission: (result: MissionResult) => Promise<void>;
  setPreferences: (patch: Partial<Preferences>) => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  syncNow: () => Promise<void>;
  importGuest: () => Promise<void>;
  logOut: () => Promise<void>;
  clearLocalHistory: () => Promise<void>;
  loadHistory: (
    cursor?: string,
    config?: string,
  ) => Promise<{ results: Attempt[]; cursor: string | null }>;
};
const Context = createContext<AppState | null>(null);
export const useApp = () => {
  const value = useContext(Context);
  if (!value) throw new Error(t('Missing AppProvider'));
  return value;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [authRevision, setAuthRevision] = useState(0);
  const [data, setData] = useState<LocalData | null>(null);
  const [loadedOwner, setLoadedOwner] = useState('');
  const [guestCount, setGuestCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const owner = user?.emailVerified ? user.uid : 'guest';
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const flights = useRef(new Map<string, Promise<void>>());

  useEffect(
    () =>
      auth
        ? onIdTokenChanged(auth, (next) => {
            setUser(next);
            setAuthReady(true);
            setAuthRevision((revision) => revision + 1);
          })
        : undefined,
    [],
  );
  const publish = useCallback((forOwner: string, value: LocalData) => {
    if (ownerRef.current !== forOwner) return;
    setData(value);
    setLoadedOwner(forOwner);
    setStorageError(storageFailed());
  }, []);
  useEffect(() => {
    let active = true;
    setSyncError('');
    setSyncing(false);
    void readLocal(owner).then((value) => {
      if (active) publish(owner, value);
    });
    void readLocal('guest').then((value) => {
      if (active) setGuestCount(value.attempts.length);
    });
    return () => {
      active = false;
    };
  }, [owner, publish]);

  const syncNow = useCallback(async () => {
    if (!user?.emailVerified || !navigator.onLine) return;
    const uid = user.uid;
    // An attempt or guest import may arrive after an ongoing sync took its snapshot.
    // Wait for that sync, then read and upload the latest queue before resolving.
    while (flights.current.has(uid)) {
      await flights.current.get(uid);
      if (ownerRef.current !== uid || !navigator.onLine) return;
    }
    const work = (async () => {
      if (ownerRef.current === uid) {
        setSyncing(true);
        setSyncError('');
      }
      try {
        const local = await readLocal(uid);
        if (local.preferencesPending) {
          await api(user, '/me', {
            method: 'PATCH',
            body: JSON.stringify({
              preferences: local.preferences,
              displayName: local.displayName,
            }),
          });
          await changeLocal(uid, (current) => ({
            ...current,
            preferencesPending:
              JSON.stringify(current.preferences) !== JSON.stringify(local.preferences) ||
              current.displayName !== local.displayName,
          }));
        }
        const pending = local.attempts.filter((a) => local.pending.includes(a.id));
        for (let i = 0; i < pending.length; i += 20) {
          const batch = pending.slice(i, i + 20);
          const result = await api<{ saved: string[]; progress: Progress }>(
            user,
            '/results/import',
            { method: 'POST', body: JSON.stringify({ attempts: batch.map(attemptInput) }) },
          );
          await changeLocal(uid, (current) => {
            const remaining = current.pending.filter((id) => !result.saved.includes(id));
            return {
              ...current,
              pending: remaining,
              progress: current.attempts
                .filter((a) => remaining.includes(a.id))
                .reduce(addToProgress, result.progress),
            };
          });
        }
        const [profile, progress, history] = await Promise.all([
          api<Profile>(user, '/me'),
          api<Progress>(user, '/progress'),
          api<{ results: Attempt[] }>(user, '/results?limit=50'),
        ]);
        const updated = await changeLocal(uid, (current) => ({
          ...current,
          preferences: current.preferencesPending ? current.preferences : profile.preferences,
          displayName: current.preferencesPending ? current.displayName : profile.displayName,
          attempts: mergeAttempts(current.attempts, history.results, current.pending),
          progress: current.attempts
            .filter((a) => current.pending.includes(a.id))
            .reduce(addToProgress, progress),
        }));
        publish(uid, updated);
      } catch (error) {
        if (ownerRef.current === uid)
          setSyncError(
            error instanceof Error
              ? error.message
              : t('Unable to sync. Your results are saved locally.'),
          );
      } finally {
        if (ownerRef.current === uid) setSyncing(false);
        flights.current.delete(uid);
      }
    })();
    flights.current.set(uid, work);
    return work;
  }, [user, authRevision, publish]);

  useEffect(() => {
    void syncNow();
    const online = () => void syncNow();
    const interval = window.setInterval(online, 60_000);
    window.addEventListener('online', online);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', online);
    };
  }, [syncNow]);

  const saveAttempt = useCallback(
    async (attempt: Attempt) => {
      publish(owner, await storeAttempt(owner, attempt));
      if (owner === 'guest') setGuestCount((await readLocal('guest')).attempts.length);
      void syncNow();
    },
    [owner, publish, syncNow],
  );
  const setPreferences = async (patch: Partial<Preferences>) => {
    publish(
      owner,
      await changeLocal(owner, (current) => ({
        ...current,
        preferences: { ...current.preferences, ...patch },
        preferencesPending: owner !== 'guest',
      })),
    );
    void syncNow();
  };
  const saveMission = async (result: MissionResult) => {
    publish(
      owner,
      await changeLocal(owner, (current) => ({
        ...current,
        campaign: campaignProgress([result, ...(current.missionRuns ?? [])], current.campaign),
        missionRuns: [
          ...new Map([result, ...(current.missionRuns ?? [])].map((run) => [run.id, run])).values(),
        ].slice(0, 100),
      })),
    );
  };
  const setDisplayName = async (displayName: string) => {
    publish(
      owner,
      await changeLocal(owner, (current) => ({
        ...current,
        displayName,
        preferencesPending: owner !== 'guest',
      })),
    );
    void syncNow();
  };
  const importGuest = async () => {
    if (!user?.emailVerified) return;
    const guest = await readLocal('guest');
    const updated = await changeLocal(user.uid, (current) => {
      const incoming = guest.attempts.filter((a) => !current.attempts.some((b) => b.id === a.id));
      const pending = [...new Set([...current.pending, ...incoming.map((a) => a.id)])];
      return {
        ...current,
        pending,
        attempts: mergeAttempts(current.attempts, incoming, pending),
        progress: incoming.reduce(addToProgress, current.progress),
      };
    });
    publish(user.uid, updated);
    await syncNow();
    const confirmed = await readLocal(user.uid);
    if (guest.attempts.some((a) => confirmed.pending.includes(a.id)))
      throw new Error(t('Your progress is queued. Reconnect and import again to finish syncing.'));
    // Only remove the exact records imported; a new guest session in another tab is preserved.
    const importedIds = new Set(guest.attempts.map((a) => a.id));
    const remainingGuest = await changeLocal('guest', (current) => {
      const attempts = current.attempts.filter((a) => !importedIds.has(a.id));
      return { ...current, attempts, progress: attempts.reduce(addToProgress, emptyProgress()) };
    });
    if (ownerRef.current === user.uid) setGuestCount(remainingGuest.attempts.length);
  };
  const logOut = async () => {
    if (auth) await signOut(auth);
    setAuthOpen(false);
  };
  const clearLocalHistory = async () => {
    if (owner === 'guest') {
      publish(owner, await clearGuest());
      setGuestCount(0);
    }
  };
  const loadHistory = async (cursor?: string, config?: string) => {
    if (!user?.emailVerified || !navigator.onLine)
      return {
        results: (data?.attempts ?? []).filter(
          (a) =>
            !config ||
            (a.config.mode === 'lesson'
              ? `${a.config.locale}:lesson:${a.config.lessonId}`
              : `${a.config.locale}:${a.config.mode}:${a.config.limit}`) === config,
        ),
        cursor: null,
      };
    const params = new URLSearchParams({
      limit: '20',
      ...(cursor ? { cursor } : {}),
      ...(config ? { config } : {}),
    });
    return api<{ results: Attempt[]; cursor: string | null }>(user, '/results?' + params);
  };

  return (
    <Context.Provider
      value={{
        user,
        owner,
        ready: authReady && loadedOwner === owner,
        data: loadedOwner === owner ? data : null,
        guestCount,
        syncing,
        syncError,
        storageError,
        authOpen,
        setAuthOpen,
        saveAttempt,
        saveMission,
        setPreferences,
        setDisplayName,
        syncNow,
        importGuest,
        logOut,
        clearLocalHistory,
        loadHistory,
      }}
    >
      {children}
    </Context.Provider>
  );
}
