import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Crosshair, Rocket, UserRound } from 'lucide-react';
import { getMission, type MissionImpact, type MissionSnapshot } from '@ztype/core';
import { m } from './i18n';
import s from './Mission.module.css';
import { DestinationArt } from './DestinationArt';
import { SuitDamage } from './SuitVitals';

const Scene = lazy(() => import('./MissionScene'));
export type TargetLabels = RefObject<Map<string, HTMLDivElement>>;
class GraphicsBoundary extends Component<
  { children: ReactNode; failed: () => void },
  { broken: boolean }
> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch() {
    this.props.failed();
  }
  render() {
    return this.state.broken ? null : this.props.children;
  }
}

export function MissionViewport({ snapshot, calm }: { snapshot: MissionSnapshot; calm: boolean }) {
  const mission = getMission(snapshot.missionId)!;
  const [available, setAvailable] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const labels = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    let timer = window.setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        setAvailable(Boolean(gl));
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        setAvailable(false);
      }
    }, 120);
    const element = root.current;
    const lost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
      setReady(false);
    };
    element?.addEventListener('webglcontextlost', lost, true);
    return () => {
      clearTimeout(timer);
      element?.removeEventListener('webglcontextlost', lost, true);
    };
  }, []);
  const render3d = available && !failed && !calm;
  useEffect(() => {
    if (!render3d || !ready)
      labels.current.forEach((element) => {
        element.style.transform = '';
      });
  }, [render3d, ready]);
  const flight = ['prime', 'launch', 'landing', 'departure'].includes(snapshot.step.phase);
  return (
    <div
      ref={root}
      className={s.viewport}
      data-testid="mission-viewport"
      data-phase={snapshot.step.phase}
      data-step={snapshot.step.id}
      data-status={snapshot.status}
      data-destination={mission.id}
    >
      {(!render3d || !ready) && (
        <div className={`${s.staticScene} ${flight ? s.staticFlight : ''}`} aria-hidden="true">
          <div className={s.fallbackWorld}>
            <DestinationArt mission={mission} />
          </div>
          {flight ? (
            <div className={s.fallbackShip}>
              <Rocket size={96} strokeWidth={1} />
              <span />
            </div>
          ) : (
            <>
              {snapshot.stepIndex >= 7 && (
                <div className={s.fallbackAstronaut}>
                  <UserRound size={50} />
                </div>
              )}
            </>
          )}
        </div>
      )}
      {render3d && (
        <GraphicsBoundary
          failed={() => {
            setFailed(true);
            setReady(false);
          }}
        >
          <Suspense fallback={null}>
            <Scene snapshot={snapshot} labels={labels} onReady={() => setReady(true)} />
          </Suspense>
        </GraphicsBoundary>
      )}
      <div className={s.visorEdge} aria-hidden="true" />
      <SuitDamage snapshot={snapshot} calm={calm} />
      <ImpactOverlay snapshot={snapshot} calm={calm} fallback={!render3d || !ready} />
      {snapshot.threats.map((target) => (
        <div
          key={target.id}
          data-kind={target.kind}
          ref={(element) => {
            if (element) labels.current.set(target.id, element);
            else labels.current.delete(target.id);
          }}
          className={`${s.targetLabel} ${target.remaining <= 0.28 ? s.targetDanger : ''} ${snapshot.lockedId === target.id ? s.targetLocked : ''} ${!render3d || !ready ? s.targetStatic : ''}`}
          style={
            {
              '--slot': target.slot,
              '--stagger': snapshot.threats.length === 3 && target.slot === 0 ? '-85px' : '0px',
            } as React.CSSProperties
          }
          aria-label={`${m('approaching')}: ${target.word}`}
        >
          {(!render3d || !ready) && (
            <svg className={s.fallbackDrone} viewBox="0 0 110 60" aria-hidden="true">
              {target.kind === 'rock' ? (
                <path
                  d="M25 12 57 4 83 18 91 40 65 56 29 48 15 29Z"
                  fill="#877d6f"
                  stroke="#d0bea4"
                  strokeWidth="2"
                />
              ) : target.kind === 'debris' ? (
                <g transform="rotate(-15 55 30)">
                  <path d="M19 8H91V51H19Z" fill="#375671" stroke="#b9c4c9" strokeWidth="3" />
                  <path d="M35 8V51M55 8V51M75 8V51M19 30H91" stroke="#8bafc9" />
                </g>
              ) : (
                <>
                  <path
                    d="M6 25 32 15 40 22 70 22 78 15 104 25 78 40 67 34 43 34 32 40Z"
                    fill="#64788b"
                    stroke="#c4b28e"
                  />
                  <circle cx="55" cy="28" r="17" fill="#253549" stroke="#db9876" strokeWidth="3" />
                  <circle cx="55" cy="28" r="6" fill="#f1a17e" />
                </>
              )}
            </svg>
          )}
          <span>
            <Crosshair size={11} />
            {target.remaining <= 0.28
              ? m('danger')
              : snapshot.lockedId === target.id
                ? 'LOCKED'
                : target.kind.toUpperCase()}
            <small>{Math.max(1, Math.ceil((target.remaining * target.budgetMs) / 1000))}s</small>
          </span>
          <strong data-testid="threat-word">
            {target.word.split('').map((letter, index) => (
              <i
                key={index}
                className={
                  snapshot.lockedId === target.id && snapshot.input[index] === letter
                    ? s.correct
                    : ''
                }
              >
                {letter}
              </i>
            ))}
          </strong>
          <div className={s.threatMeter}>
            <i style={{ width: `${target.remaining * 100}%` }} />
          </div>
        </div>
      ))}
      {(calm || failed || !available) && <span className={s.stillLabel}>{m('still')}</span>}
    </div>
  );
}

function ImpactOverlay({
  snapshot,
  calm,
  fallback,
}: {
  snapshot: MissionSnapshot;
  calm: boolean;
  fallback: boolean;
}) {
  const [impact, setImpact] = useState<MissionImpact | null>(null);
  const latest = snapshot.impacts.at(-1);
  useEffect(() => {
    if (!latest) return;
    setImpact(latest);
    const timer = setTimeout(() => setImpact(null), 1000);
    return () => clearTimeout(timer);
  }, [latest?.id]);
  if (!impact) return null;
  return (
    <div
      key={impact.id}
      data-testid="impact-feedback"
      data-impact={impact.kind}
      className={`${s.impactOverlay} ${calm ? s.calmEffects : ''}`}
      style={{ animationPlayState: snapshot.status === 'paused' ? 'paused' : 'running' }}
      aria-hidden="true"
    >
      {impact.kind === 'shield' ? (
        <div className={s.shieldRipple}>
          <div />
          <div />
          <div />
        </div>
      ) : (
        <>
          <div className={s.hitMarker}>
            <i />
            <i />
            <i />
            <i />
          </div>
          {fallback && (
            <div className={s.staticBurst} style={{ left: `${50 + impact.slot * 24}%` }}>
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
        </>
      )}
    </div>
  );
}
