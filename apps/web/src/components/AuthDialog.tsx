import { t } from '../i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  getIdToken,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { ArrowRight, CheckCircle2, LogOut, Mail, Rocket, X } from 'lucide-react';
import { auth, authMessage } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import s from '../styles/App.module.css';

export function AuthDialog() {
  const { authOpen, setAuthOpen, user, logOut, syncNow } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (authOpen) {
      dialog.current?.showModal();
      setMode('signin');
      setError('');
      setMessage('');
    } else dialog.current?.close();
  }, [authOpen]);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth) return;
    setBusy(true);
    setMessage('');
    setError('');
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get('email')).trim();
    const password = String(fields.get('password'));
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email, { url: window.location.origin });
        setMessage(
          t(
            'If that email has an account, a reset link is on its way. Check your inbox and spam folder.',
          ),
        );
      } else if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(result.user, { url: window.location.origin });
        setCooldown(60);
        setMessage(
          t(
            'A verification link is on its way. Your typing progress will stay here while you check your inbox.',
          ),
        );
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setAuthOpen(false);
      }
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      await reload(user);
      await getIdToken(user, true);
      if (user.emailVerified) {
        await syncNow();
        setAuthOpen(false);
      } else
        setMessage(
          t('Your email is not verified yet. Open the link in your inbox, then come back here.'),
        );
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      await sendEmailVerification(user, { url: window.location.origin });
      setCooldown(60);
      setMessage(t('A fresh verification link is on its way.'));
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className={s.dialog}
      onCancel={() => setAuthOpen(false)}
      onClick={(event) => {
        if (event.target === dialog.current) setAuthOpen(false);
      }}
      aria-labelledby="account-title"
    >
      <div className={s.dialogContent}>
        <button
          className={s.closeButton}
          onClick={() => setAuthOpen(false)}
          aria-label={t('Close account dialog')}
        >
          <X size={20} />
        </button>
        <span className={s.dialogIcon}>
          <Rocket size={25} />
        </span>
        <p className={s.eyebrow}>{t('YOUR JOURNEY, SAVED')}</p>
        <h2 id="account-title">
          {user
            ? user.emailVerified
              ? t('Welcome aboard.')
              : t('Check your inbox.')
            : mode === 'signup'
              ? t('A little space of your own.')
              : mode === 'reset'
                ? t('Let’s get you back in.')
                : t('Good to see you.')}
        </h2>
        {!auth ? (
          <>
            <p>
              {t(
                'Accounts aren’t available on this preview yet. You can keep practicing, and your progress will be saved in this browser.',
              )}
            </p>
            <button className={s.primaryButton} onClick={() => setAuthOpen(false)}>
              {t('Keep exploring ')}
              <ArrowRight size={17} />
            </button>
          </>
        ) : user ? (
          <>
            <p>
              {user.emailVerified ? (
                t('Your progress can travel with you, wherever you practice.')
              ) : (
                <>
                  {t('We’ll verify ')}
                  <strong>{user.email}</strong>
                  {t(' before syncing your progress. You can keep practicing in the meantime.')}
                </>
              )}
            </p>
            {user.emailVerified ? (
              <div className={s.verified}>
                <CheckCircle2 size={17} /> {user.email}
              </div>
            ) : (
              <>
                <button className={s.primaryButton} disabled={busy} onClick={() => void verify()}>
                  {t('I’ve verified my email ')}
                  <ArrowRight size={17} />
                </button>
                <button
                  className={s.textButton}
                  disabled={busy || cooldown > 0}
                  onClick={() => void resend()}
                >
                  {cooldown ? `Resend in ${cooldown}s` : t('Resend verification email')}
                </button>
              </>
            )}
            <button className={s.textButton} onClick={() => void logOut()}>
              <LogOut size={15} />
              {t(' Sign out')}
            </button>
          </>
        ) : (
          <>
            <p>
              {mode === 'signup'
                ? t(
                    'Keep your progress, celebrate your milestones, and pick up where you left off.',
                  )
                : mode === 'reset'
                  ? t('Enter your email and we’ll send a password reset link.')
                  : t('Sign in to bring your typing journey with you.')}
            </p>
            <form onSubmit={(event) => void submit(event)} className={s.authForm}>
              <label>
                {t('Email address')}
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>
              {mode !== 'reset' && (
                <label>
                  {t('Password')}
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={mode === 'signup' ? 8 : 1}
                    maxLength={128}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder={
                      mode === 'signup' ? t('At least 8 characters') : t('Your password')
                    }
                  />
                </label>
              )}
              {mode === 'signin' && (
                <button
                  type="button"
                  className={s.forgotButton}
                  onClick={() => {
                    setMode('reset');
                    setMessage('');
                    setError('');
                  }}
                >
                  {t('Forgot password?')}
                </button>
              )}
              <button className={s.primaryButton} disabled={busy}>
                {busy
                  ? t('One moment…')
                  : mode === 'signup'
                    ? t('Create account')
                    : mode === 'reset'
                      ? t('Send reset link')
                      : t('Sign in')}{' '}
                <ArrowRight size={17} />
              </button>
            </form>
            <p className={s.authSwitch}>
              {mode === 'signin'
                ? t('New to Ztype?')
                : mode === 'signup'
                  ? t('Already have an account?')
                  : t('Remember your password?')}{' '}
              <button
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError('');
                  setMessage('');
                }}
              >
                {mode === 'signin' ? t('Create an account') : t('Sign in')}
              </button>
            </p>
            <div className={s.authFootnote}>
              <Mail size={14} />
              {t(' Just your progress. No noisy inbox.')}
            </div>
          </>
        )}
        {message && (
          <p className={s.successMessage} role="status">
            {message}
          </p>
        )}
        {error && (
          <p className={s.errorMessage} role="alert">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
