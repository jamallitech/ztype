import { t } from '../i18n';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CaseSensitive,
  Check,
  Clock3,
  Hand,
  Hash,
  Home,
  Quote,
  Sparkles,
} from 'lucide-react';
import { lessons } from '@ztype/core';
import { useApp } from '../context/AppContext';
import s from '../styles/App.module.css';

const icons = [Home, Hand, Hand, ArrowUp, ArrowDown, CaseSensitive, Hash, Quote];
export default function Learn() {
  const { data } = useApp();
  const mastered = data!.progress.masteredLessons;
  return (
    <>
      <div className={`${s.pageHeading} ${s.academyHeading}`}>
        <p className={s.eyebrow}>{t('FLIGHT ACADEMY')}</p>
        <h1>
          {t('Good habits.')}
          <br />
          <span>{t('Great little beginnings.')}</span>
        </h1>
        <p>
          {t(
            'Find your fingers, build your confidence, and make yourself at home on the keyboard.',
          )}
        </p>
        <div className={s.academySculpture} aria-hidden="true">
          <div className={s.academyOrbit} />
          <span className={s.floatingKey}>
            F<span />
          </span>
          <span className={s.floatingKey}>
            J<span />
          </span>
          <i className={s.academyStar} />
          <i className={s.academyStar} />
        </div>
      </div>
      <div className={s.learningIntro}>
        <span className={s.nudgeIcon}>
          <Sparkles size={24} />
        </span>
        <div>
          <strong>{t('A little practice goes a long way.')}</strong>
          <p>{t('Start anywhere. Go at your own pace. Reach 95% accuracy to master a lesson.')}</p>
        </div>
        <div className={s.lessonCount}>
          <strong>
            {mastered.length}
            <span> / 8</span>
          </strong>
          <small>{t('lessons mastered')}</small>
        </div>
      </div>
      <div className={s.lessonGrid}>
        {lessons.map((lesson, index) => {
          const Icon = icons[index];
          const done = mastered.includes(lesson.id);
          return (
            <Link
              to={`/?lesson=${lesson.id}`}
              key={lesson.id}
              className={`${s.lessonCard} ${done ? s.masteredCard : ''}`}
            >
              <div className={s.lessonCardTop}>
                <span className={s.lessonIcon}>
                  <Icon size={23} />
                </span>
                <span className={s.lessonNumber}>{String(index + 1).padStart(2, '0')}</span>
              </div>
              <h2>{lesson.title}</h2>
              <p>{lesson.subtitle}</p>
              <div className={s.lessonKeys}>
                {lesson.keys === t('Shift') ? (
                  <kbd>{t('shift')}</kbd>
                ) : (
                  [...lesson.keys].slice(0, 6).map((key) => <kbd key={key}>{key}</kbd>)
                )}
                {lesson.keys.length > 6 && <span>…</span>}
              </div>
              <div className={s.lessonCardBottom}>
                <span>
                  {done ? (
                    <>
                      <Check size={14} />
                      {t(' Mastered')}
                    </>
                  ) : (
                    <>
                      <Clock3 size={13} />
                      {t(' About ')}
                      {lesson.duration}
                    </>
                  )}
                </span>
                <ArrowRight size={18} />
              </div>
            </Link>
          );
        })}
      </div>
      <div className={s.learningFooter}>
        <p>{t('There’s no race to the finish. A few mindful minutes each day are enough.')}</p>
        <Link className={s.textButton} to="/">
          {t('Or jump into a typing test ')}
          <ArrowRight size={15} />
        </Link>
      </div>
    </>
  );
}
