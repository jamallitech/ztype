import { t } from './i18n';
import { Component, Suspense, lazy, useEffect, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CloudOff,
  Keyboard,
  Orbit,
  Rocket,
  Settings2,
  Sparkle,
  UserRound,
} from 'lucide-react';
import { useApp } from './context/AppContext';
import { AuthDialog } from './components/AuthDialog';
import Practice from './pages/Practice';
import s from './styles/App.module.css';

const Learn = lazy(() => import('./pages/Learn'));
const Progress = lazy(() => import('./pages/Progress'));
const Settings = lazy(() => import('./pages/Settings'));
const AuthAction = lazy(() => import('./pages/AuthAction'));
const Missions = lazy(() => import('./pages/Missions'));

export default function App() {
  const app = useApp();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${location.pathname === '/missions' ? t('Missions') : location.pathname === '/learn' ? t('Flight academy') : location.pathname === '/progress' ? t('Your progress') : location.pathname === '/settings' ? t('Your space') : t('Find your flow')} — Ztype`;
  }, [location.pathname]);
  return (
    <div className={s.app}>
      <a href="#main" className={s.skipLink}>
        {t('Skip to content')}
      </a>
      <header className={s.header}>
        <div className={s.headerInner}>
          <Link to="/" className={s.brand} aria-label={t('Ztype home')}>
            <Sparkle size={31} fill="currentColor" strokeWidth={1.25} />
            <span>
              {t('ztype')}
              <span className={s.brandDot}>.</span>
            </span>
            <small>{t('BETA')}</small>
          </Link>
          <nav className={s.nav} aria-label={t('Main navigation')}>
            {[
              { to: '/', title: t('Practice'), Icon: Keyboard },
              { to: '/missions', title: t('Missions'), Icon: Rocket },
              { to: '/learn', title: t('Learn'), Icon: BookOpen },
              { to: '/progress', title: t('Progress'), Icon: BarChart3 },
              { to: '/settings', title: t('Settings'), Icon: Settings2 },
            ].map(({ to, title, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `${s.navLink} ${isActive ? s.navActive : ''}`}
              >
                <Icon size={16} />
                <span>{title}</span>
              </NavLink>
            ))}
          </nav>
          <button className={s.accountButton} onClick={() => app.setAuthOpen(true)}>
            <UserRound size={16} />
            <span>
              {app.user
                ? app.user.emailVerified
                  ? app.data?.displayName || t('Account')
                  : t('Verify email')
                : t('Sign in')}
            </span>
            {!app.user && <ArrowRight size={14} />}
          </button>
        </div>
      </header>
      <main id="main" className={s.main}>
        {app.storageError && (
          <div role="alert" className={s.notice}>
            {t(
              'Browser storage is unavailable. Your results are kept for this visit only; keep this tab open until you can save them to an account.',
            )}
          </div>
        )}
        {app.syncError && (
          <div role="status" className={s.notice}>
            <CloudOff size={15} /> {app.syncError}
            <button className={s.textButton} onClick={() => void app.syncNow()}>
              {t('Retry')}
            </button>
          </div>
        )}
        {app.user && !app.user.emailVerified && (
          <div className={s.verificationBanner}>
            {t('One small step left: verify your email to sync your progress.')}
            <button className={s.textButton} onClick={() => app.setAuthOpen(true)}>
              {t('Check verification ')}
              <ArrowRight size={14} />
            </button>
          </div>
        )}
        {app.user?.emailVerified && app.guestCount > 0 && location.pathname !== '/progress' && (
          <div className={s.verificationBanner}>
            {t('Your guest journeys are ready to come aboard.')}
            <Link to="/progress" className={s.textButton}>
              {t('Import progress ')}
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
        {(app.ready && app.data) || location.pathname === '/auth/action' ? (
          <PageBoundary key={location.pathname}>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Practice key={app.owner} />} />
                <Route path="/missions" element={<Missions key={app.owner} />} />
                <Route path="/learn" element={<Learn />} />
                <Route path="/progress" element={<Progress key={app.owner} />} />
                <Route path="/settings" element={<Settings key={app.owner} />} />
                <Route path="/auth/action" element={<AuthAction />} />
                <Route
                  path="*"
                  element={
                    <div className={s.actionCard}>
                      <Orbit size={40} />
                      <h1>{t('A little off course.')}</h1>
                      <p>{t('Let’s find our way back to the words.')}</p>
                      <Link className={s.primaryButton} to="/">
                        {t('Back to practice ')}
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  }
                />
              </Routes>
            </Suspense>
          </PageBoundary>
        ) : (
          <Loading />
        )}
      </main>
      <footer className={s.footer}>
        <div>
          <Sparkle size={14} />
          <span>{t('A little better, one word at a time.')}</span>
        </div>
        <div>
          <span className={s.footerStatus}>
            {app.owner === 'guest' ? (
              <>
                <span className={s.liveDot} />
                {t(' Free to explore. Always.')}
              </>
            ) : app.syncing ? (
              t('Syncing your journey…')
            ) : app.data?.pending.length ? (
              t('Progress waiting to sync')
            ) : (
              <>
                <Check size={13} />
                {t(' Your journey is saved')}
              </>
            )}
          </span>
          <span className={s.footerVersion}>{t('ztype · v1.0')}</span>
        </div>
      </footer>
      <AuthDialog />
    </div>
  );
}
function Loading() {
  return (
    <div className={s.loading} role="status">
      <Orbit size={28} />
      {t(' Finding your little corner of space…')}
    </div>
  );
}
class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className={s.actionCard}>
        <h1>{t('Let’s try that again.')}</h1>
        <p>{t('Your saved results are still here. Reload to return to your journey.')}</p>
        <button className={s.primaryButton} onClick={() => window.location.reload()}>
          {t('Reload Ztype')}
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
