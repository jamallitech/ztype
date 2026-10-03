import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Crosshair,
  Flag,
  Keyboard,
  Maximize2,
  Minimize2,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Square,
  Timer,
  Star,
  UserRound,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  graphemes,
  isMissionTransition,
  campaignProgress,
  getMission,
  type MissionDefinition,
  missionDestinations,
  MissionEngine,
  type MissionDifficulty,
  type MissionResult,
} from '@ztype/core';
import { useApp } from '../context/AppContext';
import { sounds } from '../lib/audio';
import { storageFailed } from '../lib/storage';
import { CampaignBrowser } from '../missions/CampaignBrowser';
import { canPlayMission } from '../missions/access';
import { MissionViewport } from '../missions/MissionViewport';
import { SuitVitals } from '../missions/SuitVitals';
import { m } from '../missions/i18n';
import s from '../missions/Mission.module.css';

const difficultyNames = {
  relaxed: m('relaxed'),
  standard: m('standard'),
  challenge: m('challenge'),
};
const timeLabel = (ms: number) =>
  `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export default function Missions() {
  const app = useApp();
  const [difficulty, setDifficulty] = useState<MissionDifficulty>('standard');
  const [pace, setPace] = useState(() => {
    const recent = app.data!.attempts.slice(0, 5);
    return recent.length
      ? Math.max(
          15,
          Math.min(80, Math.round(recent.reduce((n, a) => n + a.wpm, 0) / recent.length / 5) * 5),
        )
      : 30;
  });
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState<MissionDefinition | null>(null);
  const [search, setSearch] = useSearchParams();
  const runs = app.data!.missionRuns ?? [];
  const progress = campaignProgress(runs, app.data!.campaign);
  const selected = getMission(search.get('destination') ?? '') ?? null;
  const select = (id: string | null) =>
    setSearch(id ? { destination: id } : {}, { replace: true, preventScrollReset: true });
  useEffect(() => {
    setPlaying(null);
  }, [app.owner]);
  const [calm, setCalm] = useState(
    () =>
      app.data!.preferences.scene === 'focus' ||
      matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const titleRef = useRef<HTMLHeadingElement>(null);
  const start = (id = selected?.id) => {
    const mission = getMission(id ?? '');
    if (!mission || !canPlayMission(mission.id, progress)) return;
    if (app.data!.preferences.sound) void sounds.unlock();
    setRun((n) => n + 1);
    select(mission.id);
    setPlaying(mission);
  };
  const leave = () => {
    select(null);
    setPlaying(null);
    requestAnimationFrame(() => titleRef.current?.focus());
  };
  if (playing)
    return (
      <MissionRun
        key={`${app.owner}:${run}`}
        mission={playing}
        next={missionDestinations[playing.level]}
        onNext={() => {
          const next = missionDestinations[playing.level];
          if (next) start(next.id);
        }}
        difficulty={difficulty}
        pace={pace}
        calm={calm}
        setCalm={setCalm}
        restart={() => start(playing.id)}
        leave={leave}
      />
    );
  return (
    <div className={`${s.page} ${s.campaignPage}`}>
      <div className={s.mobileNote}>
        <Keyboard size={17} />
        <p>{m('keyboard')}</p>
      </div>
      <CampaignBrowser
        selected={selected}
        progress={progress}
        onSelect={select}
        onPlay={() => start()}
        titleRef={titleRef}
        controls={
          <>
            <div className={s.menuOptions}>
              <button
                className={s.compactSound}
                role="switch"
                aria-checked={app.data!.preferences.sound}
                aria-label={m('combatSound')}
                onClick={() => {
                  const prefs = app.data!.preferences;
                  if (prefs.sound) sounds.silence();
                  else void sounds.unlock().then(() => sounds.playMission('pulse', prefs.volume));
                  void app.setPreferences({ sound: !prefs.sound });
                }}
              >
                {app.data!.preferences.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
                {m('combatSound')}
                <span>{app.data!.preferences.sound ? m('audioOn') : m('audioOff')}</span>
              </button>
              <span>
                {difficultyNames[difficulty]} · {pace} wpm
              </span>
            </div>
            <details className={s.menuDisclosure}>
              <summary>{m('missionSettings')}</summary>
              <div className={s.settingsBody}>
                <div className={s.difficulties} aria-label={m('difficulty')}>
                  {(['relaxed', 'standard', 'challenge'] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={difficulty === value}
                      onClick={() => setDifficulty(value)}
                      className={difficulty === value ? s.difficultyActive : ''}
                    >
                      <span>
                        {difficultyNames[value]}
                        {difficulty === value && <Check size={14} />}
                      </span>
                    </button>
                  ))}
                </div>
                <p className={s.help}>{m(`${difficulty}Hint`)}</p>
                <label className={s.paceLabel} htmlFor="mission-pace">
                  {m('pace')}
                  <strong>
                    {pace} <small>wpm</small>
                  </strong>
                </label>
                <input
                  id="mission-pace"
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={pace}
                  onChange={(e) => setPace(Number(e.target.value))}
                />
                <p className={s.help}>{m('paceHelp')}</p>
                <p className={s.help}>
                  {m('instruction2')} {m('instruction3')}
                </p>
              </div>
            </details>
          </>
        }
      />
      <details className={s.menuDisclosure}>
        <summary>
          {m('log')}
          {runs.length > 0 && <span>{runs.length}</span>}
        </summary>
        <section className={s.log} aria-labelledby="mission-log">
          <div className={s.sectionTitle}>
            <h2 id="mission-log">{m('log')}</h2>
            <span>{m('local')}</span>
          </div>
          {runs.length ? (
            <div className={s.logScroll}>
              <table>
                <thead>
                  <tr>
                    <th>{m('historyMission')}</th>
                    <th>{m('historyOutcome')}</th>
                    <th>{m('score')}</th>
                    <th>{m('accuracy')}</th>
                    <th>{m('historyDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 10).map((result) => (
                    <tr key={result.id}>
                      <td>
                        {getMission(result.missionId)?.title ?? result.missionId}
                        <small>{difficultyNames[result.difficulty]}</small>
                      </td>
                      <td className={result.outcome === 'won' ? s.successText : s.warningText}>
                        {result.outcome === 'won'
                          ? m('rescued')
                          : result.outcome === 'ended'
                            ? m('ended')
                            : m('failed')}
                      </td>
                      <td>{result.score.toLocaleString()}</td>
                      <td>{result.accuracy}%</td>
                      <td>
                        {new Date(result.completedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={s.emptyLog}>
              <Flag size={18} />
              {m('noRuns')}
            </p>
          )}
        </section>
      </details>
    </div>
  );
}

function MissionRun({
  mission,
  next,
  onNext,
  difficulty,
  pace,
  calm,
  setCalm,
  restart,
  leave,
}: {
  mission: MissionDefinition;
  next?: MissionDefinition;
  onNext: () => void;
  difficulty: MissionDifficulty;
  pace: number;
  calm: boolean;
  setCalm: (calm: boolean) => void;
  restart: () => void;
  leave: () => void;
}) {
  const app = useApp();
  const latest = useRef(app);
  latest.current = app;
  const [engine] = useState(() => new MissionEngine(difficulty, pace, undefined, mission.id));
  const [snapshot, setSnapshot] = useState(engine.snapshot);
  const [result, setResult] = useState<MissionResult | null>(null);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error'>('saving');
  const saved = useRef(false);
  const [hint, setHint] = useState('');
  const [feedback, setFeedback] = useState<'hit' | 'shot' | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const resumeButton = useRef<HTMLButtonElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const runElement = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const composing = useRef(false);
  const committedComposition = useRef<string | null>(null);
  const [composition, setComposition] = useState<string | null>(null);
  const transition = isMissionTransition(snapshot.step.phase);
  const preferences = app.data!.preferences;
  const finished = ['won', 'lost', 'ended'].includes(snapshot.status);
  const endMission = () => {
    sounds.silence();
    setSnapshot(engine.end(performance.now()));
  };
  const refresh = () => setSnapshot(engine.snapshot);
  useEffect(() => {
    let feedbackTimer: ReturnType<typeof setTimeout>;
    const unsubscribe = engine.onEvent((event) => {
      if (event === 'hit' || event === 'shot') {
        setFeedback(event);
        clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(() => setFeedback(null), 1800);
      }
      const prefs = latest.current.data!.preferences;
      if (!prefs.sound) return;
      const state = engine.snapshot;
      const pan = (state.impacts.at(-1)?.slot ?? 0) * 0.6;
      if (event === 'shot') {
        const kind = state.impacts.at(-1)?.kind;
        sounds.playMission(
          kind === 'rock' ? 'shatter' : kind === 'debris' ? 'metal' : 'pulse',
          prefs.volume,
          pan,
        );
      } else if (event === 'hit') sounds.playMission('shield', prefs.volume, pan);
      else if (event === 'warning' || event === 'lock') sounds.playMission(event, prefs.volume);
      else if (event === 'won' || event === 'rescued') sounds.playMission('arrival', prefs.volume);
      else if (event === 'wave') sounds.playMission('incoming', prefs.volume);
      else if (event === 'phase') {
        if (['launch', 'departure'].includes(state.step.phase))
          sounds.playMission('launch', prefs.volume);
        else if (state.step.phase === 'combat') sounds.playMission('incoming', prefs.volume);
      } else if (event === 'correct' || event === 'mistake') sounds.play(event, prefs.volume);
    });
    const interval = setInterval(() => {
      if (engine.snapshot.status === 'running') setSnapshot(engine.tick(performance.now()));
    }, 50);
    const pause = () => {
      setSnapshot(engine.pause(performance.now()));
      sounds.silence();
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault();
        pause();
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (['running', 'paused'].includes(engine.snapshot.status)) {
        event.preventDefault();
      }
    };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('keydown', escape);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      unsubscribe();
      clearTimeout(feedbackTimer);
      clearInterval(interval);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('beforeunload', beforeUnload);
      sounds.silence();
    };
  }, [engine]);
  useEffect(() => {
    runElement.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    let wasFullscreen = false;
    const change = () => {
      const active = document.fullscreenElement === runElement.current;
      setFullscreen(active);
      if (wasFullscreen && !active) {
        setSnapshot(engine.pause(performance.now()));
        sounds.silence();
      } else if (!isMissionTransition(engine.snapshot.step.phase))
        input.current?.focus({ preventScroll: true });
      wasFullscreen = active;
    };
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, [engine]);
  useEffect(() => {
    if (app.authOpen) setSnapshot(engine.pause(performance.now()));
  }, [app.authOpen, engine]);
  useEffect(() => {
    if (snapshot.status === 'paused') {
      resumeButton.current?.focus();
      return;
    }
    if (!transition && !finished) input.current?.focus({ preventScroll: true });
  }, [snapshot.stepIndex, snapshot.status, transition, finished]);
  useEffect(() => {
    if (!finished || saved.current) return;
    saved.current = true;
    const completed = engine.result(crypto.randomUUID(), new Date().toISOString())!;
    setResult(completed);
    void latest.current
      .saveMission(completed)
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('error'));
  }, [finished, engine]);
  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);
  const resume = () => {
    if (preferences.sound) void sounds.unlock();
    setSnapshot(engine.resume(performance.now()));
  };
  const apply = (value: string) => {
    if (preferences.sound) void sounds.unlock();
    setSnapshot(engine.applyInput(value, performance.now()));
  };
  const onInput = (event: FormEvent<HTMLTextAreaElement>) => {
    const native = event.nativeEvent as InputEvent;
    if (composing.current || native.isComposing) {
      setComposition(event.currentTarget.value);
      return;
    }
    const committed = committedComposition.current;
    committedComposition.current = null;
    // Firefox emits a final input after compositionend. The commit may have
    // already disabled a drone and cleared the field for the next encounter.
    if (
      committed !== null &&
      (event.currentTarget.value === committed ||
        native.inputType === 'insertCompositionText' ||
        native.inputType === 'insertFromComposition')
    ) {
      refresh();
      return;
    }
    apply(event.currentTarget.value);
  };
  const typed = graphemes(snapshot.input);
  const targetWords = snapshot.threats.map((target) => target.word).join(', ');
  const announce = finished
    ? snapshot.status === 'won'
      ? m('rescued')
      : snapshot.status === 'ended'
        ? m('ended')
        : m('failed')
    : `${snapshot.step.title}. ${snapshot.step.objective}${targetWords ? ` ${m('approaching')}: ${targetWords}.` : ''}`;
  return (
    <div ref={runElement} className={s.run} data-testid="mission-run">
      <div className={s.runHeading}>
        <div>
          <h1>
            {mission.name}{' '}
            <span className={s.runLevel}>/ {String(mission.level).padStart(2, '0')}</span>
          </h1>
        </div>
        <div className={s.runTools}>
          <span>
            {difficultyNames[difficulty]} <i /> {pace} wpm
          </span>
          <button
            aria-label={preferences.sound ? m('soundOff') : m('soundOn')}
            aria-pressed={preferences.sound}
            onClick={() => {
              if (preferences.sound) sounds.silence();
              else void sounds.unlock().then(() => sounds.playMission('pulse', preferences.volume));
              void app.setPreferences({ sound: !preferences.sound });
              input.current?.focus({ preventScroll: true });
            }}
            title={preferences.sound ? m('soundOff') : m('soundOn')}
          >
            {preferences.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <label className={s.missionVolume}>
            <span className={s.announcement}>{m('volume')}</span>
            <input
              aria-label={m('volume')}
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={preferences.volume}
              onChange={(event) => {
                void app.setPreferences({ volume: Number(event.target.value) });
                if (Number(event.target.value) === 0) sounds.silence();
              }}
            />
          </label>
          <button
            aria-label={calm ? m('calmOff') : m('calmOn')}
            aria-pressed={calm}
            onClick={() => setCalm(!calm)}
          >
            <Orbit size={18} />
          </button>
          <button
            aria-label={fullscreen ? m('exitFullscreen') : m('fullscreen')}
            title={fullscreen ? m('exitFullscreen') : m('fullscreen')}
            aria-pressed={fullscreen}
            onClick={() => {
              const action = fullscreen
                ? document.exitFullscreen()
                : runElement.current?.requestFullscreen?.();
              if (action) void action.catch(() => setHint(m('fullscreenUnavailable')));
              else setHint(m('fullscreenUnavailable'));
            }}
          >
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          {!finished && (
            <button className={s.endMission} onClick={endMission}>
              <Square size={14} />
              {m('endMission')}
            </button>
          )}
          {!finished && (
            <button
              aria-label={m('pause')}
              onClick={() => {
                setSnapshot(engine.pause(performance.now()));
                sounds.silence();
              }}
            >
              <Pause size={18} />
            </button>
          )}
        </div>
      </div>
      <div className={s.announcement} role="status" aria-live="polite">
        {announce}
      </div>
      <div className={s.cockpit} data-finished={finished}>
        <div className={s.flightDeck}>
          <MissionViewport snapshot={snapshot} calm={calm} />
          <div className={s.sceneHud}>
            <div className={s.objective}>
              <strong>{snapshot.step.title}</strong>
              <span className={s.missionTimer} data-urgent={snapshot.remainingMs <= 30_000}>
                <Timer size={14} />
                <time aria-label={m('remaining')} data-testid="mission-timer">
                  {timeLabel(Math.ceil(snapshot.remainingMs / 1000) * 1000)}
                </time>
              </span>
            </div>
            <SuitVitals snapshot={snapshot} />
            <div className={s.crosshair} aria-hidden="true">
              <i />
              <i />
            </div>
            {snapshot.rescued > 0 && !finished && (
              <span className={s.passengerPill}>
                <UserRound size={13} />
                {m('passenger')}
              </span>
            )}
            {feedback && !finished && (
              <span
                role="status"
                className={`${s.encounterFeedback} ${feedback === 'hit' ? s.damageFeedback : ''}`}
              >
                {feedback === 'hit' ? <Shield size={14} /> : <Crosshair size={14} />}
                {feedback === 'hit'
                  ? m('damageAmount', {
                      health: snapshot.impacts.at(-1)?.healthDamage ?? 0,
                      oxygen: snapshot.impacts.at(-1)?.oxygenDamage ?? 0,
                    })
                  : m('targetCleared')}
              </span>
            )}
          </div>
          {snapshot.status === 'paused' && (
            <div
              className={s.pauseOverlay}
              role="dialog"
              aria-modal="true"
              aria-labelledby="paused-title"
              onKeyDown={(event) => {
                if (event.key === 'Tab') {
                  const buttons = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
                  );
                  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                  event.preventDefault();
                  buttons[
                    (index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length
                  ]?.focus();
                }
              }}
            >
              <div>
                <span className={s.pauseIcon}>
                  <Pause size={27} />
                </span>
                <h2 id="paused-title">{m('paused')}</h2>
                <p>{m('pausedHint')}</p>
                <button ref={resumeButton} className={s.beginButton} onClick={resume}>
                  <Play size={16} />
                  {m('resume')}
                </button>
                <button className={s.textButton} onClick={endMission}>
                  {m('endMission')}
                </button>
                <small>{m('leaveHint')}</small>
              </div>
            </div>
          )}
        </div>
        {result ? (
          <section className={s.debrief} aria-labelledby="debrief-title">
            <div className={s.debriefHeader}>
              <span className={result.outcome === 'won' ? s.wonIcon : s.lostIcon}>
                {result.outcome === 'won' ? <Flag size={26} /> : <Shield size={26} />}
              </span>
              <div>
                <p className={s.eyebrow}>
                  {result.outcome === 'won'
                    ? m('rescued')
                    : result.outcome === 'ended'
                      ? m('ended')
                      : m('failed')}
                </p>
                <h2 id="debrief-title" ref={resultHeading} tabIndex={-1}>
                  {result.outcome === 'won'
                    ? mission.successTitle
                    : result.outcome === 'ended'
                      ? m('endedTitle')
                      : m('failureTitle')}
                </h2>
              </div>
              <div className={s.stars} aria-label={`${result.stars} / 3 ${m('stars')}`}>
                {[1, 2, 3].map((n) => (
                  <Star
                    key={n}
                    size={25}
                    fill={result.stars >= n ? 'currentColor' : 'none'}
                    className={result.stars >= n ? s.starEarned : ''}
                  />
                ))}
              </div>
            </div>
            <p>
              {result.outcome === 'won'
                ? mission.successText
                : result.outcome === 'ended'
                  ? m('endedText')
                  : result.failureReason === 'health'
                    ? m('failureHealth')
                    : result.failureReason === 'oxygen'
                      ? m('failureOxygen')
                      : result.failureReason === 'timeout'
                        ? m('failureTimeout')
                        : m('failureText')}
            </p>
            <div className={s.resultStats}>
              {[
                [m('score'), result.score.toLocaleString()],
                [m('accuracy'), `${result.accuracy}%`],
                [m('typingPace'), `${result.wpm} wpm`],
                [m('disabled'), result.disabled],
                [m('elapsed'), timeLabel(result.elapsedMs)],
                [m('health'), `${result.health ?? 100}%`],
                [m('oxygen'), `${result.oxygen ?? 100}%`],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className={s.help}>
              {m('scoreHint')} {m('paceNote')}
            </p>
            {result.outcome === 'won' && next && (
              <p className={s.nextUnlocked} role="status">
                {m('nextUnlocked', { destination: next.name })}
              </p>
            )}
            <div className={s.debriefActions}>
              {result.outcome === 'won' && next && (
                <button className={s.beginButton} onClick={onNext} disabled={saveState !== 'saved'}>
                  {m('nextMission', { destination: next.name })}
                  <ArrowRight size={16} />
                </button>
              )}
              <button className={s.beginButton} onClick={restart}>
                <RotateCcw size={16} />
                {result.outcome === 'won' ? m('replay') : m('retry')}
              </button>
              <button className={s.secondaryButton} onClick={leave}>
                <ArrowLeft size={16} />
                {m('levelSelect')}
              </button>
              <span>
                {saveState === 'saving'
                  ? m('saving')
                  : saveState === 'error'
                    ? m('saveFailed')
                    : storageFailed()
                      ? m('temporary')
                      : m('saved')}
              </span>
              {saveState === 'error' && (
                <button
                  onClick={() => {
                    setSaveState('saving');
                    void app
                      .saveMission(result)
                      .then(() => setSaveState('saved'))
                      .catch(() => setSaveState('error'));
                  }}
                >
                  {m('saveAgain')}
                </button>
              )}
            </div>
          </section>
        ) : (
          <section className={s.console} aria-label={m('instructions')}>
            {transition ? (
              <div className={s.transitionConsole}>
                <div>
                  <span className={s.eyebrow}>{m('transition')}</span>
                  <p>{m('transitionHint')}</p>
                </div>
                <button
                  className={s.secondaryButton}
                  disabled={snapshot.status === 'paused'}
                  onClick={() => {
                    engine.skipTransition(performance.now());
                    refresh();
                  }}
                >
                  {m('skip')}
                  <ChevronRight size={16} />
                </button>
                <div className={s.transitionProgress}>
                  <i style={{ width: `${snapshot.stepProgress * 100}%` }} />
                </div>
              </div>
            ) : (
              <div className={s.commandArea}>
                <div className={s.commandLabel}>
                  <span>
                    <Crosshair size={13} />
                    {snapshot.step.phase === 'combat'
                      ? snapshot.lockedId
                        ? m('target')
                        : m('chooseTarget')
                      : snapshot.step.title}
                  </span>
                  <span>
                    {snapshot.step.phase === 'combat'
                      ? `${m('wave')} ${snapshot.wave + 1} / ${snapshot.step.waves!.length}`
                      : `${typed.length} / ${graphemes(snapshot.prompt).length}`}
                  </span>
                </div>
                <div className={s.prompt} data-testid="mission-prompt" aria-hidden="true">
                  {snapshot.prompt ? (
                    graphemes(snapshot.prompt).map((letter, i) => (
                      <span
                        key={i}
                        className={
                          i < typed.length
                            ? typed[i] === letter
                              ? s.correct
                              : s.incorrect
                            : i === typed.length
                              ? s.caret
                              : ''
                        }
                      >
                        {letter}
                      </span>
                    ))
                  ) : (
                    <span className={s.chooseHint}>{m('chooseHint')}</span>
                  )}
                </div>
                <span id="mission-command" className={s.announcement}>
                  {snapshot.prompt || `${m('approaching')}: ${targetWords}`}
                </span>
                <textarea
                  ref={input}
                  aria-label={m('input')}
                  placeholder={m('type')}
                  rows={1}
                  value={composition ?? snapshot.input}
                  readOnly={snapshot.status === 'paused'}
                  onInput={onInput}
                  onChange={() => {}}
                  onCompositionStart={() => {
                    committedComposition.current = null;
                    composing.current = true;
                    setComposition(snapshot.input);
                  }}
                  onCompositionEnd={(event) => {
                    committedComposition.current = event.currentTarget.value;
                    composing.current = false;
                    setComposition(null);
                    apply(event.currentTarget.value);
                  }}
                  onPaste={(event) => {
                    event.preventDefault();
                    setHint(m('paste'));
                  }}
                  onDrop={(event) => event.preventDefault()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing)
                      event.preventDefault();
                  }}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="none"
                  aria-describedby="mission-command mission-input-help"
                />
                <div className={s.consoleFooter}>
                  <p id="mission-input-help">{hint || m('pauseHelp')}</p>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
