import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Check,
  ChevronDown,
  Clock3,
  CloudUpload,
  Flame,
  LockKeyhole,
  Orbit,
  Rocket,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { configKey, lessons, type Attempt } from '@ztype/core';
import { useApp } from '../context/AppContext';
import s from '../styles/App.module.css';

export default function ProgressPage() {
  const app = useApp();
  const { data, owner } = app;
  const [filter, setFilter] = useState('');
  const [history, setHistory] = useState<Attempt[]>(data!.attempts);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const latest = useRef(app);
  latest.current = app;
  const loadId = useRef(0);
  const progress = data!.progress;
  const attempts = data!.attempts;
  const best = Math.max(0, ...Object.values(progress.bests).map((b) => b.wpm));
  const accuracy = attempts.length
    ? Math.round((attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length) * 10) / 10
    : 0;

  useEffect(() => {
    const generation = ++loadId.current;
    setHistory(data!.attempts.filter((a) => !filter || configKey(a.config) === filter));
    setCursor(null);
    setError('');
    if (owner === 'guest') return;
    setLoading(true);
    void latest.current
      .loadHistory(undefined, filter || undefined)
      .then((page) => {
        if (loadId.current === generation) {
          setHistory(page.results);
          setCursor(page.cursor);
        }
      })
      .catch(() => {
        if (loadId.current === generation)
          setError(
            t('Showing results saved on this device. Cloud history is temporarily unavailable.'),
          );
      })
      .finally(() => {
        if (loadId.current === generation) setLoading(false);
      });
    return () => {
      loadId.current++;
    };
  }, [filter, owner, data!.attempts]);
  const more = async () => {
    if (!cursor) return;
    setLoading(true);
    const generation = loadId.current;
    try {
      const page = await app.loadHistory(cursor, filter || undefined);
      if (generation === loadId.current) {
        setHistory((previous) => [
          ...new Map([...previous, ...page.results].map((a) => [a.id, a])).values(),
        ]);
        setCursor(page.cursor);
      }
    } catch {
      setError(t('Couldn’t load more results. Please try again.'));
    } finally {
      setLoading(false);
    }
  };
  const importHistory = async () => {
    setImporting(true);
    setImportMessage('');
    try {
      await app.importGuest();
      setImportMessage(t('Your guest journeys are now part of your account.'));
    } catch (cause) {
      setImportMessage(
        cause instanceof Error ? cause.message : t('Unable to import. Please try again.'),
      );
    } finally {
      setImporting(false);
    }
  };
  return (
    <>
      <div className={s.pageHeading}>
        <p className={s.eyebrow}>{t('YOUR FLIGHT LOG')}</p>
        <h1>
          {t('Look how far')}
          <br />
          <span>{t('you’re going.')}</span>
        </h1>
        <p>{t('Every word counts. Here’s your little collection of progress.')}</p>
      </div>
      {owner !== 'guest' && app.guestCount > 0 && (
        <div className={s.importBanner}>
          <CloudUpload size={25} />
          <div>
            <strong>{t('Bring your first journeys with you.')}</strong>
            <p>
              {t('Import ')}
              {app.guestCount}
              {t(' guest ')}
              {app.guestCount === 1 ? 'result' : 'results'}
              {t(' saved in this browser.')}
            </p>
          </div>
          <button
            className={s.primaryButton}
            onClick={() => void importHistory()}
            disabled={importing}
          >
            {importing ? 'Importing…' : t('Import guest progress')} <ArrowRight size={15} />
          </button>
        </div>
      )}
      {importMessage && (
        <p role="status" className={s.notice}>
          {importMessage}
        </p>
      )}
      <div className={s.statGrid}>
        <Stat
          icon={<Zap size={19} />}
          title={t('Personal best')}
          value={best || '—'}
          suffix="wpm"
          note={t('Best across your test settings')}
        />
        <Stat
          icon={<Target size={19} />}
          title={t('Average accuracy')}
          value={accuracy || '—'}
          suffix="%"
          note={t('Your most recent sessions')}
        />
        <Stat
          icon={<Orbit size={19} />}
          title={t('Little journeys')}
          value={progress.totalSessions}
          note={t('Completed practice sessions')}
        />
        <Stat
          icon={<Clock3 size={19} />}
          title={t('Time well spent')}
          value={Math.round(progress.totalPracticeMs / 60_000)}
          suffix="min"
          note={t('A little investment in yourself')}
        />
      </div>
      <section className={s.chartCard}>
        <div className={s.sectionHeading}>
          <div>
            <p className={s.eyebrow}>{t('STEADY DOES IT')}</p>
            <h2>{t('Your rhythm over time')}</h2>
          </div>
          <label className={s.selectLabel}>
            <span className={s.srOnly}>{t('Filter history by test configuration')}</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">{t('All practice')}</option>
              {[15, 30, 60, 120].map((n) => (
                <option key={n} value={`en:time:${n}`}>
                  {n}
                  {t(' second tests')}
                </option>
              ))}
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={`en:words:${n}`}>
                  {n}
                  {t(' word tests')}
                </option>
              ))}
              {lessons.map((l) => (
                <option key={l.id} value={`en:lesson:${l.id}`}>
                  {l.title}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
        <ProgressChart attempts={history} />
        {!filter && history.length > 0 && (
          <p className={s.chartNote}>
            {t(
              'Different test settings can give different speeds. Choose one above for a like-for-like view.',
            )}
          </p>
        )}
      </section>
      <div className={s.progressColumns}>
        <section className={s.historyCard}>
          <div className={s.sectionHeading}>
            <h2>{t('Recent journeys')}</h2>
            <span>{owner === 'guest' ? t('Saved in this browser') : t('Your flight history')}</span>
          </div>
          {error && (
            <p className={s.notice} role="status">
              {error}
            </p>
          )}
          {history.length ? (
            <div className={s.tableScroll}>
              <table className={s.historyTable}>
                <thead>
                  <tr>
                    <th>{t('Practice')}</th>
                    <th>{t('Speed')}</th>
                    <th>{t('Accuracy')}</th>
                    <th>{t('When')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span className={s.tableIcon}>
                          {a.config.mode === 'time' ? (
                            <Clock3 size={14} />
                          ) : a.config.mode === 'lesson' ? (
                            <Award size={14} />
                          ) : (
                            <TypeIcon />
                          )}
                        </span>
                        {a.config.mode === 'lesson'
                          ? lessons.find(
                              (l) => a.config.mode === 'lesson' && l.id === a.config.lessonId,
                            )?.title
                          : `${a.config.limit} ${a.config.mode === 'time' ? 'seconds' : 'words'}`}
                      </td>
                      <td>
                        <strong>{a.wpm}</strong> <small>{t('wpm')}</small>
                      </td>
                      <td>
                        <span className={a.accuracy >= 95 ? s.goodAccuracy : ''}>
                          {a.accuracy}%
                        </span>
                      </td>
                      <td>
                        {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
                          new Date(a.completedAt),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={s.emptyHistory}>
              <Orbit size={28} />
              <p>
                {filter
                  ? t('No journeys with these settings yet.')
                  : t('Your story starts with a single word.')}
              </p>
              <Link to="/" className={s.textButton}>
                {t('Take a typing test ')}
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
          {cursor && (
            <button className={s.loadMore} onClick={() => void more()} disabled={loading}>
              {loading ? 'Loading…' : t('Load more journeys')}
            </button>
          )}
        </section>
        <section className={s.badgesCard}>
          <div className={s.sectionHeading}>
            <h2>{t('Small wins')}</h2>
            <Trophy size={17} />
          </div>
          <p className={s.muted}>{t('A few milestones worth celebrating.')}</p>
          {[
            {
              id: 'first-flight',
              title: t('First flight'),
              text: t('Complete your first session.'),
              Icon: Rocket,
            },
            {
              id: 'frequent-flyer',
              title: t('Frequent flyer'),
              text: t('Find your flow 10 times.'),
              Icon: Flame,
            },
            {
              id: 'flight-academy',
              title: t('Academy graduate'),
              text: t('Master all 8 lessons.'),
              Icon: Award,
            },
          ].map(({ id, title, text, Icon }) => (
            <div
              className={`${s.badgeRow} ${progress.badges.includes(id) ? s.badgeEarned : ''}`}
              key={id}
            >
              <span>
                <Icon size={24} />
              </span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
              {progress.badges.includes(id) ? <Check size={15} /> : <LockKeyhole size={13} />}
            </div>
          ))}
        </section>
      </div>
      {owner === 'guest' && (
        <div className={s.saveBanner}>
          <div>
            <strong>{t('Your progress deserves a home.')}</strong>
            <p>
              {t(
                'Keep your journey across devices with a free account. Clearing browser data removes guest history.',
              )}
            </p>
          </div>
          <button className={s.secondaryButton} onClick={() => app.setAuthOpen(true)}>
            {t('Save your journey ')}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}

function TypeIcon() {
  return <span aria-hidden="true">{t('Aa')}</span>;
}
function Stat({
  icon,
  title,
  value,
  suffix,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  suffix?: string;
  note: string;
}) {
  return (
    <div className={s.statCard}>
      <div>
        {icon}
        <span>{title}</span>
      </div>
      <strong>
        {value}
        <small>{suffix}</small>
      </strong>
      <p>{note}</p>
    </div>
  );
}
function ProgressChart({ attempts }: { attempts: Attempt[] }) {
  const rows = attempts.slice(0, 20).reverse();
  if (!rows.length)
    return (
      <div className={s.emptyChart}>
        <div className={s.chartGridLines} />
        <Orbit size={35} />
        <strong>{t('A whole universe of potential.')}</strong>
        <p>{t('Complete your first test to see your progress take shape.')}</p>
      </div>
    );
  const width = 900,
    height = 180,
    padding = 20;
  const max = Math.max(40, Math.ceil(Math.max(...rows.map((a) => a.wpm)) / 20) * 20);
  const points = rows.map((a, i) => ({
    x: padding + (i / Math.max(rows.length - 1, 1)) * (width - padding * 2),
    y: height - padding - (a.wpm / max) * (height - padding * 2),
    attempt: a,
  }));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  return (
    <div className={s.chartWrapper}>
      <div className={s.chartAxis}>
        <span>{max}</span>
        <span>{max / 2}</span>
        <span>0</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={s.progressChart}
        role="img"
        aria-label={`Typing speed for your last ${rows.length} sessions, from ${rows[0].wpm} to ${rows.at(-1)!.wpm} words per minute. Exact results are in the table below.`}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#93cfc0" stopOpacity=".16" />
            <stop offset="1" stopColor="#93cfc0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 90, 160].map((y) => (
          <line
            key={y}
            x1={padding}
            x2={width - padding}
            y1={y}
            y2={y}
            stroke="#24303b"
            strokeDasharray="4 6"
          />
        ))}
        <path
          d={`${path} L${points.at(-1)!.x},${height - padding} L${points[0].x},${height - padding} Z`}
          fill="url(#chart-fill)"
        />
        <path d={path} fill="none" stroke="#a0dbcc" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p) => (
          <circle
            key={p.attempt.id}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#a0dbcc"
            stroke="#141d29"
            strokeWidth="2"
          >
            <title>
              {p.attempt.wpm}
              {t(' wpm · ')}
              {p.attempt.accuracy}
              {t('% accuracy')}
            </title>
          </circle>
        ))}
      </svg>
      <div className={s.chartDates}>
        <span>{t('Earlier journeys')}</span>
        <span>{t('Most recent')}</span>
      </div>
    </div>
  );
}
