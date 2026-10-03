import { useRef, type CSSProperties, type RefObject } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole, Check } from 'lucide-react';
import { missionDestinations, type CampaignProgress } from '@ztype/core';
import { DestinationArt } from './DestinationArt';
import { canPlayMission } from './access';
import { m, missionTime } from './i18n';
import s from './Mission.module.css';

const count = missionDestinations.length;
const wrap = (index: number) => (index + count) % count;

export function MissionCarousel({
  activeIndex,
  onChange,
  onSelect,
  progress,
  hidden,
  containerRef,
}: {
  activeIndex: number;
  onChange: (index: number) => void;
  onSelect: (id: string) => void;
  progress: CampaignProgress;
  hidden: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const move = (index: number, focus = false) => {
    const next = wrap(index);
    onChange(next);
    if (focus)
      requestAnimationFrame(() => buttons.current.get(next)?.focus({ preventScroll: true }));
  };
  return (
    <div
      ref={containerRef}
      hidden={hidden}
      className={s.carousel}
      role="region"
      aria-label={m('destinations')}
      aria-roledescription="carousel"
      data-testid="destination-carousel"
      data-active={missionDestinations[activeIndex].id}
      onKeyDown={(event) => {
        swiped.current = false;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        move(
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : activeIndex + (event.key === 'ArrowRight' ? 1 : -1),
          true,
        );
      }}
    >
      <div
        className={s.carouselTrack}
        data-testid="destination-rail"
        onPointerDown={(event) => {
          gesture.current = { x: event.clientX, y: event.clientY };
          swiped.current = false;
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        onPointerUpCapture={(event) => {
          const start = gesture.current;
          gesture.current = null;
          if (!start) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            swiped.current = true;
            move(activeIndex + (dx < 0 ? 1 : -1));
          }
        }}
        onClickCapture={(event) => {
          if (swiped.current) {
            event.preventDefault();
            event.stopPropagation();
            swiped.current = false;
          }
        }}
      >
        {missionDestinations.map((mission, index) => {
          let offset = wrap(index - activeIndex);
          if (offset > count / 2) offset -= count;
          const active = offset === 0;
          const unlocked = canPlayMission(mission.id, progress);
          const stars = progress[mission.missionId]?.stars ?? 0;
          const previous = missionDestinations[mission.level - 2];
          return (
            <button
              key={mission.id}
              ref={(element) => {
                if (element) buttons.current.set(index, element);
                else buttons.current.delete(index);
              }}
              className={s.carouselCard}
              style={
                {
                  '--slide-offset': offset,
                  '--world-accent': mission.environment.accent,
                } as CSSProperties
              }
              data-testid={`level-${mission.id}`}
              data-unlocked={unlocked}
              data-active={active}
              data-distant={Math.abs(offset) > 1}
              aria-hidden={Math.abs(offset) > 1 ? true : undefined}
              aria-expanded={hidden && active}
              aria-controls="destination-details"
              aria-label={m('cardLabel', {
                level: mission.level,
                destination: mission.name,
                status: stars
                  ? m('cardCompleted', { stars })
                  : unlocked
                    ? m('cardReady')
                    : m('cardLocked', { previous: previous.name }),
              })}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(mission.id)}
            >
              <span className={s.carouselArtwork}>
                <DestinationArt mission={mission} />
              </span>
              <span className={s.carouselTopline}>
                <span>
                  {String(mission.level).padStart(2, '0')} / {mission.system}
                </span>
                {stars ? <Check size={18} /> : !unlocked ? <LockKeyhole size={17} /> : null}
              </span>
              <span className={s.carouselCaption}>
                <span className={s.carouselStatus}>
                  {stars
                    ? m('completedStars', { stars })
                    : unlocked
                      ? m('readyToPlay')
                      : m('locked')}
                </span>
                <strong>{mission.name}</strong>
                <span className={s.carouselSubtitle}>{mission.title}</span>
                <span className={s.destinationVitals}>
                  {missionTime(mission.durationMs)} · {m('startingOxygen')}
                </span>
                <span className={s.carouselExplore}>
                  {m('viewMission')} <ArrowRight size={18} />
                </span>
              </span>
            </button>
          );
        })}
        <button
          className={`${s.carouselArrow} ${s.carouselPrevious}`}
          aria-label={m('previousDestinations')}
          onClick={() => move(activeIndex - 1)}
        >
          <ArrowLeft size={22} />
        </button>
        <button
          className={`${s.carouselArrow} ${s.carouselNext}`}
          aria-label={m('nextDestinations')}
          onClick={() => move(activeIndex + 1)}
        >
          <ArrowRight size={22} />
        </button>
      </div>
      <div className={s.carouselNavigation}>
        <p className={s.carouselPosition} aria-live="polite" aria-atomic="true">
          {String(activeIndex + 1).padStart(2, '0')} <span>/ {count}</span>
        </p>
        <div className={s.carouselDots} role="group" aria-label={m('chooseDestination')}>
          {missionDestinations.map((mission, index) => (
            <button
              key={mission.id}
              aria-label={m('showDestination', { destination: mission.name })}
              aria-current={index === activeIndex ? 'true' : undefined}
              title={mission.name}
              onClick={() => move(index)}
            >
              <span />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
