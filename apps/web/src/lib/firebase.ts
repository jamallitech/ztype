import { t } from '../i18n';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type User } from 'firebase/auth';
import type { Attempt } from '@ztype/core';

const env = import.meta.env;
const emulator = env.VITE_USE_EMULATORS === 'true';
export const firebaseConfigured =
  emulator ||
  Boolean(
    env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_AUTH_DOMAIN &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID,
  );
export const auth = firebaseConfigured
  ? getAuth(
      initializeApp({
        apiKey: env.VITE_FIREBASE_API_KEY || 'demo-key',
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-ztype.firebaseapp.com',
        projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-ztype',
        appId: env.VITE_FIREBASE_APP_ID || 'demo-app',
      }),
    )
  : null;
if (auth && emulator) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

export async function api<T>(user: User, path: string, options: RequestInit = {}): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch('/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || t('Unable to sync right now.'));
  return body as T;
}
export function attemptInput({
  wpm: _wpm,
  accuracy: _accuracy,
  mistakes: _mistakes,
  ...attempt
}: Attempt) {
  return attempt;
}
export function authMessage(error: unknown): string {
  const code = (error as { code?: string }).code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': t(
      'That email and password combination did not match. Try again or reset your password.',
    ),
    'auth/email-already-in-use': t('There is already an account with that email. Try signing in.'),
    'auth/weak-password': t('Choose a password with at least 8 characters.'),
    'auth/invalid-email': t('Enter a valid email address.'),
    'auth/too-many-requests': t('Please wait a little before trying again.'),
    'auth/network-request-failed': t('You appear to be offline. Please try again when connected.'),
    'auth/expired-action-code': t('This link has expired. Please request a new one.'),
    'auth/invalid-action-code': t('This link is invalid or has already been used.'),
    'auth/user-disabled': t('This account is unavailable. Contact support for help.'),
  };
  return messages[code ?? ''] ?? t('Something went wrong. Please try again.');
}
