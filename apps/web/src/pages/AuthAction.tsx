import { t } from '../i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  applyActionCode,
  confirmPasswordReset,
  getIdToken,
  reload,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { Mail } from 'lucide-react';
import { auth, authMessage } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import s from '../styles/App.module.css';

export default function AuthAction() {
  const [params] = useSearchParams();
  const { setAuthOpen } = useApp();
  const [message, setMessage] = useState(t('Checking your link…'));
  const [error, setError] = useState('');
  const [resetReady, setResetReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const code = params.get('oobCode');
  const mode = params.get('mode');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!auth || !code) {
      setError(t('This link is incomplete. Please request a new email.'));
      setMessage('');
      return;
    }
    const process = async () => {
      try {
        await auth!.authStateReady();
        if (mode === 'verifyEmail') {
          await applyActionCode(auth!, code);
          if (auth!.currentUser) {
            await reload(auth!.currentUser);
            await getIdToken(auth!.currentUser, true);
          }
          setMessage(t('Your email is verified. Your journey is ready to follow you.'));
        } else if (mode === 'resetPassword') {
          await verifyPasswordResetCode(auth!, code);
          setMessage(t('Choose a new password for your next adventure.'));
          setResetReady(true);
        } else {
          setError(t('This link is not supported. Please request a new email.'));
          setMessage('');
        }
      } catch (cause) {
        setMessage('');
        setError(authMessage(cause));
      }
    };
    void process();
  }, [code, mode]);
  const reset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth || !code) return;
    setBusy(true);
    setError('');
    try {
      await confirmPasswordReset(
        auth,
        code,
        String(new FormData(event.currentTarget).get('password')),
      );
      setResetReady(false);
      setMessage(t('Your password has been updated. You can sign in now.'));
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={s.actionCard}>
      <span className={s.dialogIcon}>
        <Mail size={24} />
      </span>
      <h1>{t('A little account housekeeping.')}</h1>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className={s.errorMessage}>
          {error}
        </p>
      )}
      {resetReady ? (
        <form onSubmit={(event) => void reset(event)} className={s.authForm}>
          <label>
            {t('New password')}
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <button className={s.primaryButton} disabled={busy}>
            {t('Save new password')}
          </button>
        </form>
      ) : (
        <button className={s.primaryButton} onClick={() => setAuthOpen(true)}>
          {t('Continue to your account')}
        </button>
      )}
    </div>
  );
}
