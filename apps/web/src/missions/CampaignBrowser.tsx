import { useRef, useState, useEffect, type ReactNode, type RefObject } from 'react';
import { LockKeyhole, Play, Star, X } from 'lucide-react';
import {
  campaignFrontier,
  missionDestinations,
  type CampaignProgress,
  type MissionDefinition,
} from '@ztype/core';
import { DestinationArt } from './DestinationArt';
import { MissionCarousel } from './MissionCarousel';
import { canPlayMission } from './access';
import s from './Mission.module.css';
import { m, missionTime, riskLabels } from './i18n';

export function CampaignBrowser({
  selected,
  progress,
  onSelect,
  onPlay,
  titleRef,
  controls,
}: {
  selected: MissionDefinition | null;
  progress: CampaignProgress;
  onSelect: (id: string | null) => void;
  controls?: ReactNode;
  onPlay: () => void;
  titleRef: RefObject<HTMLHeadingElement | null>;
}) {
  const hero = useRef<HTMLElement>(null);
  const heroTitle = useRef<HTMLHeadingElement>(null);
  const cards = useRef<HTMLDivElement>(null);
  const unlocked = selected ? canPlayMission(selected.id, progress) : false;
  const previous = selected && missionDestinations[selected.level - 2];
  const completed = Object.keys(progress).length;
  const frontier = campaignFrontier(progress);
  const [activeIndex, setActiveIndex] = useState(() => (selected ? selected.level - 1 : frontier));
  const openedId = useRef<string | null>(null);
  useEffect(() => {
    if (selected) {
      openedId.current = selected.id;
      setActiveIndex(selected.level - 1);
      heroTitle.current?.focus({ preventScroll: true });
    } else if (openedId.current) {
      cards.current
        ?.querySelector<HTMLButtonElement>(`[data-testid="level-${openedId.current}"]`)
        ?.focus({ preventScroll: true });
      openedId.current = null;
    }
  }, [selected]);
  const selectedStars = selected ? (progress[selected.missionId]?.stars ?? 0) : 0;
  const close = () => {
    onSelect(null);
  };
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape' && selected) {
          event.preventDefault();
          close();
        }
      }}
    >
      <header className={s.campaignHeading}>
        <div>
          <p className={s.eyebrow}>{m('campaignTitle')}</p>
          <h1 ref={titleRef} tabIndex={-1}>
            {m('destinations')}
          </h1>
        </div>
        <span>
          {m('campaignCompleted', { count: completed, total: missionDestinations.length })}
        </span>
      </header>
      <div className={s.campaignStage}>
        <MissionCarousel
          containerRef={cards}
          hidden={Boolean(selected)}
          activeIndex={activeIndex}
          onChange={setActiveIndex}
          progress={progress}
          onSelect={(id) => {
            setActiveIndex(missionDestinations.findIndex((mission) => mission.id === id));
            onSelect(id);
          }}
        />
        <div id="destination-details">
          {selected && (
            <section
              ref={hero}
              className={s.campaignHero}
              aria-labelledby="destination-title"
              style={{ '--world-accent': selected.environment.accent } as React.CSSProperties}
              data-testid="destination-preview"
              data-destination={selected.id}
            >
              <button className={s.closeDetails} aria-label={m('closeDetails')} onClick={close}>
                <X size={19} />
              </button>
              <div className={s.heroArtwork}>
                <DestinationArt mission={selected} />
              </div>
              <div className={s.heroCopy}>
                <p className={s.eyebrow}>
                  {selected.level - 1 === frontier && !selectedStars
                    ? m('continueJourney')
                    : m('missionBriefing')}{' '}
                  <span> / {String(selected.level).padStart(2, '0')}</span>
                </p>
                <h2 ref={heroTitle} tabIndex={-1} id="destination-title">
                  {selected.name}
                </h2>
                <h3>{selected.title}</h3>
                <p>{selected.description}</p>
                <div className={s.heroMeta}>
                  <span>{m('deadline', { time: missionTime(selected.durationMs) })}</span>
                  <i />
                  <span>{m('startingOxygen')}</span>
                  <i />
                  {selectedStars ? (
                    <span aria-label={m('completedStars', { stars: selectedStars })}>
                      {Array.from({ length: 3 }, (_, i) => (
                        <Star
                          key={i}
                          size={13}
                          fill={i < selectedStars ? 'currentColor' : 'none'}
                        />
                      ))}
                    </span>
                  ) : (
                    <span>{m(riskLabels[selected.surfaceRisk])}</span>
                  )}
                </div>
                {unlocked ? (
                  <button className={s.beginButton} onClick={onPlay}>
                    <Play size={17} fill="currentColor" />
                    {selectedStars ? m('replayMission') : m('begin')}
                  </button>
                ) : (
                  <div className={s.unlockMessage} role="status">
                    <LockKeyhole size={17} />
                    {m('unlockRequirement', {
                      previous: previous?.name ?? '',
                      destination: selected.name,
                    })}
                  </div>
                )}
                <small>{unlocked ? m('oxygenHint') : m('unlockRule')}</small>
              </div>
            </section>
          )}
        </div>
      </div>
      {controls}
    </div>
  );
}
