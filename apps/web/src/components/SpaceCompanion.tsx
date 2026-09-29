import { t } from '../i18n';
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Circle, Orbit, Sparkles } from 'lucide-react';
import type { Snapshot } from '@ztype/core';
import type { SceneSignal } from './SpaceScene';
import s from '../styles/App.module.css';

const Scene = lazy(() => import('./SpaceScene'));
// This boundary must live outside the lazy module: that module can fail to download.
class SceneLoadBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? <StaticSpace /> : this.props.children;
  }
}
function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    const supported = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return supported;
  } catch {
    return false;
  }
}

export function SpaceCompanion({
  snapshot,
  signal,
}: {
  snapshot: Snapshot;
  signal: SceneSignal | null;
}) {
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const sceneRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = sceneRoot.current;
    const lost = (event: Event) => {
      event.preventDefault();
      setAvailable(false);
    };
    // Capture even context failures that happen before the renderer is fully initialized.
    root?.addEventListener('webglcontextlost', lost, true);
    return () => root?.removeEventListener('webglcontextlost', lost, true);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAvailable(window.innerWidth >= 600 && supportsWebGL());
      setLoaded(true);
    }, 180);
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return (
    <section className={s.space} aria-label={t('Space companion: a journey to Kepler')}>
      <div className={s.spaceGrid} aria-hidden="true" />
      <div className={s.nebula} aria-hidden="true" />
      <div className={s.orbitLabel}>
        <span className={s.liveDot} />
        {t(' YOUR LITTLE CORNER OF THE COSMOS')}
      </div>
      <span className={s.missionTag}>{t('EXPLORATION 01')}</span>
      <div className={s.scene} ref={sceneRoot}>
        {loaded && available ? (
          <SceneLoadBoundary onFailure={() => setAvailable(false)}>
            <Suspense fallback={<StaticSpace />}>
              <Scene
                snapshot={snapshot}
                signal={signal}
                hidden={hidden}
                onFailure={() => setAvailable(false)}
              />
            </Suspense>
          </SceneLoadBoundary>
        ) : (
          <StaticSpace />
        )}
      </div>
      <div className={s.sceneCaption}>
        <span className={s.tinyCaps}>
          {snapshot.status === 'finished'
            ? t('A LITTLE FURTHER THAN BEFORE')
            : t('YOUR NEXT ORBIT')}
        </span>
        <p>
          {snapshot.status === 'finished' ? (
            t('A good place to land.')
          ) : (
            <>
              {t('A little focus.')}
              <br />
              <span>{t('A whole new world.')}</span>
            </>
          )}
        </p>
        <span className={s.sceneSubline}>{t('Your words power the journey.')}</span>
      </div>
      <div className={s.destination}>
        <div>
          <Orbit size={17} />
          <span>{t('YOUR NEXT DESTINATION')}</span>
        </div>
        <strong>
          {t('Kepler 22b ')}
          <span>{Math.round(snapshot.progress * 100)}%</span>
        </strong>
        <div className={s.destinationProgress}>
          <i style={{ width: `${Math.max(6, snapshot.progress * 100)}%` }} />
        </div>
      </div>
      <div className={s.sceneStatus}>
        <Circle size={7} fill="currentColor" />{' '}
        {snapshot.status === 'running'
          ? t('Cruising. You’re doing great.')
          : snapshot.status === 'finished'
            ? t('Journey complete')
            : t('Ready when you are')}{' '}
        <Sparkles size={13} />
      </div>
    </section>
  );
}

function StaticSpace() {
  return (
    <div className={s.staticSpace} aria-hidden="true">
      <div className={s.staticStars} />
      <div className={s.staticPlanet}>
        <div />
      </div>
      <svg className={s.staticShip} viewBox="0 0 180 90">
        <defs>
          <linearGradient id="ship-body" x2="0" y2="1">
            <stop stopColor="#f6f0dd" />
            <stop offset="1" stopColor="#a4b1b2" />
          </linearGradient>
        </defs>
        <path d="M45 33 12 45 45 58" fill="#8bd3c5" opacity=".8" />
        <path d="m64 29-17-16 43 9M64 61 47 77 90 68" fill="#df966f" />
        <path d="M45 31Q102 13 145 45 102 76 45 59Z" fill="url(#ship-body)" />
        <path d="M115 27Q135 33 148 45 135 58 115 63Z" fill="#edaa7d" />
        <circle cx="91" cy="45" r="13" fill="#ca926a" />
        <circle cx="91" cy="45" r="9" fill="#569ba3" />
      </svg>
    </div>
  );
}
