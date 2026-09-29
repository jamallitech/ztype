import { t } from '../i18n';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Clock3,
  Crosshair,
  Globe2,
  Keyboard as KeyboardIcon,
  LockKeyhole,
  Orbit,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Type,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  configKey,
  defaultConfig,
  graphemes,
  lessons,
  TypingEngine,
  type Attempt,
  type Snapshot,
  type TestConfig,
} from '@ztype/core';
import { useApp } from '../context/AppContext';
import { sounds } from '../lib/audio';
import { SpaceCompanion } from '../components/SpaceCompanion';
import { Keyboard } from '../components/Keyboard';
import type { SceneSignal } from '../components/SpaceScene';
import s from '../styles/App.module.css';

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

export default function Practice() {
  const [search, setSearch] = useSearchParams();
  const lesson = lessons.find((l) => l.id === search.get('lesson'));
  const [selected, setSelected] = useState<TestConfig>(defaultConfig);
  const config = useMemo<TestConfig>(
    () =>
      lesson
        ? { mode: 'lesson', lessonId: lesson.id, locale: 'en', contentVersion: 'en-1' }
        : selected,
    [lesson, selected],
  );
  const [seed, setSeed] = useState(randomSeed);
  const restart = useCallback(
    () =>
      setSeed((previous) => {
        const next = randomSeed();
        return next === previous ? (previous + 1) >>> 0 : next;
      }),
    [],
  );
  const changeMode = (mode: 'time' | 'words') => {
    setSearch({});
    setSelected(
      mode === 'time'
        ? { mode, limit: 30, locale: 'en', contentVersion: 'en-1' }
        : { mode, limit: 25, locale: 'en', contentVersion: 'en-1' },
    );
  };
  // A fresh session owns its engine, completion guard, input and result together.
  // A finished snapshot must never be paired with the next attempt's engine.
  return (
    <PracticeSession
      key={`${configKey(config)}:${seed}`}
      config={config}
      seed={seed}
      lesson={lesson}
      restart={restart}
      changeMode={changeMode}
      setSelected={setSelected}
    />
  );
}

function PracticeSession({
  config,
  seed,
  lesson,
  restart,
  changeMode,
  setSelected,
}: {
  config: TestConfig;
  seed: number;
  lesson: (typeof lessons)[number] | undefined;
  restart: () => void;
  changeMode: (mode: 'time' | 'words') => void;
  setSelected: (config: TestConfig) => void;
}) {
  const app = useApp();
  const [engine] = useState(() => new TypingEngine(config, seed));
  const [snapshot, setSnapshot] = useState<Snapshot>(engine.snapshot);
  const [result, setResult] = useState<Attempt | null>(null);
  const [personalBest, setPersonalBest] = useState(false);
  const [signal, setSignal] = useState<SceneSignal | null>(null);
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const savedEngine = useRef<TypingEngine | null>(null);
  const signalSequence = useRef(0);
  const latest = useRef(app);
  latest.current = app;
  const preferences = app.data!.preferences;

  useEffect(() => {
    savedEngine.current = null;
    setSnapshot(engine.snapshot);
    setResult(null);
    setPersonalBest(false);
    setHint('');
    if (input.current) input.current.value = '';
    const focus = setTimeout(() => {
      if (matchMedia('(pointer:fine)').matches) input.current?.focus({ preventScroll: true });
    }, 100);
    const unsubscribe = engine.onEvent((event) => {
      setSignal({ event, sequence: ++signalSequence.current });
      if (latest.current.data?.preferences.sound)
        sounds.play(event, latest.current.data.preferences.volume);
    });
    return () => {
      clearTimeout(focus);
      unsubscribe();
    };
  }, [engine]);

  useEffect(() => {
    const tick = () => {
      if (engine.snapshot.status === 'running') setSnapshot(engine.tick(performance.now()));
    };
    const interval = setInterval(tick, 100);
    const visibility = () => {
      tick();
      if (document.hidden) sounds.silence();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [engine]);

  useEffect(() => {
    if (snapshot.status !== 'finished' || savedEngine.current === engine) return;
    const attempt = engine.result(crypto.randomUUID(), new Date().toISOString());
    if (!attempt) {
      setHint(t('No completed result this time. Start a fresh journey whenever you’re ready.'));
      return;
    }
    savedEngine.current = engine;
    setResult(attempt);
    const previous = latest.current.data?.progress.bests[configKey(config)];
    const best = Boolean(previous && attempt.wpm > previous.wpm);
    setPersonalBest(best);
    if (best) {
      setSignal({ event: 'best', sequence: ++signalSequence.current });
      if (latest.current.data?.preferences.sound)
        sounds.play('best', latest.current.data.preferences.volume);
    }
    void latest.current.saveAttempt(attempt);
  }, [snapshot.status, engine, config]);

  const apply = (value: string) => {
    if (latest.current.data?.preferences.sound) void sounds.unlock();
    setSnapshot(engine.applyInput(value, performance.now()));
  };
  const handleInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (!composing.current) apply(event.currentTarget.value);
  };
  const remaining =
    config.mode === 'time'
      ? Math.max(0, config.limit - Math.floor(snapshot.elapsedMs / 1000))
      : config.mode === 'words'
        ? Math.max(0, config.limit - snapshot.completedWords)
        : Math.round(snapshot.progress * 100);

  return (
    <>
      <div className={s.practiceHeading}>
        <div>
          <p className={s.eyebrow}>
            {lesson ? t('FLIGHT ACADEMY') : t('A LITTLE PRACTICE. A WORLD OF POSSIBILITY.')}
          </p>
          <h1>
            {lesson ? (
              lesson.title
            ) : (
              <>
                {t('Find your ')}
                <span>{t('flow.')}</span>
              </>
            )}
          </h1>
          <p>
            {lesson
              ? lesson.subtitle
              : t('Clear your mind. Find your rhythm. Let your fingers do the exploring.')}
          </p>
        </div>
        <div className={s.experienceSwitch} aria-label={t('Experience')}>
          <button
            className={preferences.scene === 'space' ? s.selected : ''}
            onClick={() => void app.setPreferences({ scene: 'space' })}
          >
            <Orbit size={15} />
            {t(' Space')}
          </button>
          <button
            className={preferences.scene === 'focus' ? s.selected : ''}
            onClick={() => void app.setPreferences({ scene: 'focus' })}
          >
            <Crosshair size={15} />
            {t(' Focus')}
          </button>
        </div>
      </div>
      <div className={s.mobileNotice}>
        <KeyboardIcon size={19} />
        <p>
          {t('A little room for your keyboard.')}
          <span>
            {t(
              'Connect a physical keyboard or open Ztype on a computer to practice. Your progress is right here on any screen.',
            )}
          </span>
        </p>
      </div>
      {lesson && (
        <div className={s.lessonTip}>
          <span>
            <KeyboardIcon size={20} />
          </span>
          <p>{lesson.finger}</p>
          <Link to="/learn" className={s.textButton}>
            <ArrowLeft size={15} />
            {t(' All lessons')}
          </Link>
        </div>
      )}
      {preferences.scene === 'space' && <SpaceCompanion snapshot={snapshot} signal={signal} />}
      <section
        className={`${s.typingCard} ${preferences.scene === 'space' ? s.floatingConsole : ''}`}
        aria-label={t('Typing practice')}
      >
        <div className={s.testToolbar}>
          <div className={s.modeButtons} aria-label={t('Test mode')}>
            <button
              className={!lesson && config.mode === 'time' ? s.activeMode : ''}
              onClick={() => changeMode('time')}
            >
              <Clock3 size={15} />
              {t(' time')}
            </button>
            <button
              className={!lesson && config.mode === 'words' ? s.activeMode : ''}
              onClick={() => changeMode('words')}
            >
              <Type size={16} />
              {t(' words')}
            </button>
            {lesson && (
              <span className={s.activeMode}>
                <KeyboardIcon size={15} />
                {t(' lesson')}
              </span>
            )}
          </div>
          <span className={s.toolbarDivider} />
          {!lesson && (
            <div
              className={s.durationButtons}
              aria-label={config.mode === 'time' ? t('Test duration') : t('Word count')}
            >
              {(config.mode === 'time' ? [15, 30, 60, 120] : [10, 25, 50, 100]).map((limit) => (
                <button
                  key={limit}
                  aria-pressed={'limit' in config && config.limit === limit}
                  className={'limit' in config && config.limit === limit ? s.activeDuration : ''}
                  onClick={() => setSelected({ ...config, limit } as TestConfig)}
                >
                  {limit}
                </button>
              ))}
            </div>
          )}
          <div className={s.toolbarRight}>
            <span>
              <Globe2 size={14} />
              {t(' english ')}
              <ChevronDown size={12} />
            </span>
            <button
              className={s.iconButton}
              aria-label={preferences.sound ? t('Mute sound') : t('Enable sound')}
              aria-pressed={preferences.sound}
              onClick={() => {
                void sounds.unlock();
                void app.setPreferences({ sound: !preferences.sound });
              }}
            >
              {preferences.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
          </div>
        </div>

        {result ? (
          <Result result={result} best={personalBest} restart={restart} />
        ) : (
          <>
            <div className={s.testTopline}>
              <span className={s.countdown}>
                {remaining}
                <small>
                  {config.mode === 'time'
                    ? 'seconds'
                    : config.mode === 'words'
                      ? t('words left')
                      : t('% complete')}
                </small>
              </span>
              {preferences.showLiveStats && snapshot.status !== 'ready' ? (
                <div className={s.liveStats}>
                  <span>
                    <Zap size={13} /> {snapshot.wpm}
                    {t(' wpm')}
                  </span>
                  <span>
                    <Target size={13} /> {snapshot.accuracy}%
                  </span>
                </div>
              ) : (
                <span className={s.readyLabel}>
                  <span className={s.liveDot} />{' '}
                  {snapshot.status === 'ready'
                    ? t('the first keystroke starts your journey')
                    : t('one word at a time')}
                </span>
              )}
            </div>
            <div
              className={`${s.typingArea} ${!focused && snapshot.status !== 'finished' ? s.unfocused : ''}`}
              onClick={() => input.current?.focus({ preventScroll: true })}
            >
              <TypingWords engine={engine} snapshot={snapshot} focused={focused} />
              <textarea
                ref={input}
                className={s.typingInput}
                aria-label={t('Typing input')}
                aria-describedby="typing-help"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="none"
                autoComplete="off"
                readOnly={snapshot.status === 'finished'}
                onInput={handleInput}
                onCompositionStart={() => {
                  composing.current = true;
                }}
                onCompositionEnd={(event) => {
                  composing.current = false;
                  apply(event.currentTarget.value);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onPaste={(event) => {
                  event.preventDefault();
                  setHint(t('This little journey is for your fingers. Pasting is disabled.'));
                }}
                onDrop={(event) => event.preventDefault()}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.currentTarget.blur();
                  }
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    if (snapshot.status === 'finished') restart();
                  }
                }}
              />
              {!focused && snapshot.status !== 'finished' && (
                <button className={s.focusPrompt} onClick={() => input.current?.focus()}>
                  <KeyboardIcon size={17} />
                  {t(' Click here to find your flow')}
                </button>
              )}
            </div>
            <div className={s.testBottomline}>
              <p id="typing-help">
                {hint ||
                  (snapshot.status === 'ready'
                    ? t('Take a breath. Start typing whenever you’re ready.')
                    : snapshot.status === 'finished'
                      ? t('Ready for another go?')
                      : t('Accuracy first. The speed will follow.'))}
              </p>
              <button className={s.restartButton} onClick={restart} aria-label={t('Restart test')}>
                <RotateCcw size={17} />
              </button>
            </div>
          </>
        )}
        <div className={s.testProgress} aria-hidden="true">
          <i style={{ width: `${snapshot.progress * 100}%` }} />
        </div>
      </section>
      <div className={s.keyboardHint}>
        <kbd>{t('tab')}</kbd>
        <span>{t('to move between controls')}</span>
        <i /> <kbd>{t('esc')}</kbd>
        <span>{t('to take a breath')}</span>
      </div>
      {lesson ? (
        <Keyboard keys={lesson.keys} />
      ) : (
        <div className={s.belowPractice}>
          <Link to="/learn" className={s.learnNudge}>
            <span className={s.nudgeIcon}>
              <Sparkles size={21} />
            </span>
            <div>
              <strong>{t('Every expert was a beginner.')}</strong>
              <p>{t('Build good habits with bite-sized typing lessons.')}</p>
            </div>
            <ArrowUpRightIcon />
          </Link>
          <div className={s.guestNudge}>
            <LockKeyhole size={17} />
            <p>
              {app.owner === 'guest' ? (
                <>
                  {t('No account? No problem.')}
                  <span>{t('Your progress stays in this browser.')}</span>
                </>
              ) : (
                <>
                  {t('Your own little universe.')}
                  <span>{t('Your practice, progress, and milestones.')}</span>
                </>
              )}
            </p>
            {app.owner === 'guest' ? (
              <button onClick={() => app.setAuthOpen(true)}>
                {t('Save your journey ')}
                <ArrowRight size={14} />
              </button>
            ) : (
              <Link to="/progress">
                {t('Your progress ')}
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M6 18 18 6M6 6h12v12" />
    </svg>
  );
}

function TypingWords({
  engine,
  snapshot,
  focused,
}: {
  engine: TypingEngine;
  snapshot: Snapshot;
  focused: boolean;
}) {
  const words = useMemo(() => {
    let index = 0;
    return engine.prompt.split(' ').map((word) => {
      const item = { word, start: index, letters: graphemes(word) };
      index += item.letters.length + 1;
      return item;
    });
  }, [engine]);
  const typed = useMemo(() => graphemes(snapshot.input), [snapshot.input]);
  const currentWord = Math.max(
    0,
    words.findIndex((w) => w.start + w.letters.length >= typed.length),
  );
  const start = Math.max(0, Math.floor(currentWord / 30) * 30 - 8);
  const content = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const caret = content.current?.querySelector<HTMLElement>('[data-current="true"]');
    setOffset(Math.max(0, (caret?.offsetTop ?? 0) - 52));
  }, [typed.length, start, engine]);
  return (
    <div className={s.wordsViewport} aria-hidden="true">
      <div
        ref={content}
        data-testid="typing-prompt"
        className={s.words}
        style={{ transform: `translateY(-${offset}px)` }}
      >
        {words.slice(start, start + 60).map(({ word, start: wordStart, letters }, wordIndex) => (
          <span className={s.word} key={wordStart}>
            {[...letters, ...(start + wordIndex < words.length - 1 ? [' '] : [])].map(
              (letter, i) => {
                const position = wordStart + i;
                const isCurrent = position === typed.length;
                return (
                  <span
                    data-current={isCurrent || undefined}
                    key={`${word}-${i}`}
                    className={`${position < typed.length ? (typed[position] === letter ? s.correctChar : s.wrongChar) : ''} ${isCurrent && focused ? s.caret : ''}`}
                  >
                    {letter === ' ' ? '\u00a0' : letter}
                  </span>
                );
              },
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function Result({
  result,
  best,
  restart,
}: {
  result: Attempt;
  best: boolean;
  restart: () => void;
}) {
  const { owner, setAuthOpen } = useApp();
  const recommendation =
    result.accuracy < 90
      ? t('Try a little slower next time. A steady rhythm will help your accuracy grow.')
      : result.accuracy < 98
        ? t('A lovely rhythm. Keep your eyes on the words and let accuracy lead the way.')
        : t('Beautifully done. Your accuracy is looking stellar — try a longer journey next.');
  const mastered =
    result.config.mode === 'lesson' && result.correctEntries / result.totalEntries >= 0.95;
  return (
    <div className={s.result}>
      <div className={s.resultHeading}>
        <span className={s.resultIcon}>{best ? <Trophy size={22} /> : <Check size={23} />}</span>
        <div>
          <p className={s.eyebrow}>
            {best
              ? t('A NEW PERSONAL BEST')
              : mastered
                ? t('LESSON MASTERED')
                : t('JOURNEY COMPLETE')}
          </p>
          <h2>
            {best
              ? t('Look how far you’ve come.')
              : mastered
                ? t('A new skill in your orbit.')
                : t('A little better than yesterday.')}
          </h2>
        </div>
      </div>
      <p className={s.srOnly} role="status">
        {t('Test complete. ')}
        {result.wpm}
        {t(' words per minute, ')}
        {result.accuracy}
        {t('% accuracy, ')}
        {result.mistakes}
        {t(' mistakes.')}
      </p>
      <div className={s.resultStats}>
        <div>
          <span>
            <Zap size={15} />
            {t(' typing speed')}
          </span>
          <strong>
            {result.wpm}
            <small>{t('wpm')}</small>
          </strong>
        </div>
        <div>
          <span>
            <Target size={15} />
            {t(' accuracy')}
          </span>
          <strong>
            {result.accuracy}
            <small>%</small>
          </strong>
        </div>
        <div>
          <span>
            <Clock3 size={15} />
            {t(' time')}
          </span>
          <strong>
            {Math.round(result.elapsedMs / 1000)}
            <small>{t('sec')}</small>
          </strong>
        </div>
        <div>
          <span>
            <Type size={15} />
            {t(' mistakes')}
          </span>
          <strong>{result.mistakes}</strong>
        </div>
      </div>
      <p className={s.recommendation}>{recommendation}</p>
      <div className={s.resultActions}>
        <button className={s.primaryButton} onClick={restart}>
          {t('Another little journey ')}
          <RotateCcw size={16} />
        </button>
        <Link className={s.secondaryButton} to="/progress">
          <BarChart3 size={16} />
          {t(' Your progress')}
        </Link>
        {owner === 'guest' && (
          <button className={s.textButton} onClick={() => setAuthOpen(true)}>
            {t('Save to an account ')}
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
