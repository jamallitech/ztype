import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { Check, Cloud, Crosshair, Monitor, Orbit, SlidersHorizontal, Volume2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { sounds } from '../lib/audio';
import s from '../styles/App.module.css';

export default function Settings() {
  const app = useApp();
  const preferences = app.data!.preferences;
  const [name, setName] = useState(app.data!.displayName);
  const [saved, setSaved] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => setName(app.data!.displayName), [app.data!.displayName]);
  return (
    <>
      <div className={s.pageHeading}>
        <p className={s.eyebrow}>{t('MAKE YOURSELF AT HOME')}</p>
        <h1>
          {t('Your space.')}
          <br />
          <span>{t('Your kind of quiet.')}</span>
        </h1>
        <p>{t('A few small adjustments to help you find your flow.')}</p>
      </div>
      <div className={s.settingsLayout}>
        <section className={s.settingsCard}>
          <div className={s.settingsTitle}>
            <SlidersHorizontal size={21} />
            <div>
              <h2>{t('The way you practice')}</h2>
              <p>{t('These preferences are saved automatically.')}</p>
            </div>
          </div>
          <div className={s.settingRow}>
            <div>
              <h3>{t('Your environment')}</h3>
              <p>{t('A little adventure, or a little less distraction.')}</p>
            </div>
            <div className={s.settingChoices}>
              <button
                className={preferences.scene === 'space' ? s.choiceActive : ''}
                onClick={() => void app.setPreferences({ scene: 'space' })}
              >
                <Orbit size={22} />
                <strong>{t('Space')}</strong>
                <span>{t('Your cosmic companion')}</span>
                {preferences.scene === 'space' && <Check size={13} />}
              </button>
              <button
                className={preferences.scene === 'focus' ? s.choiceActive : ''}
                onClick={() => void app.setPreferences({ scene: 'focus' })}
              >
                <Crosshair size={22} />
                <strong>{t('Focus')}</strong>
                <span>{t('Just you and the words')}</span>
                {preferences.scene === 'focus' && <Check size={13} />}
              </button>
            </div>
          </div>
          <div className={s.settingRow}>
            <div>
              <h3>{t('Typing sounds')}</h3>
              <p>{t('Soft feedback for each little step.')}</p>
            </div>
            <Toggle
              label={t('Typing sounds')}
              checked={preferences.sound}
              onChange={() => {
                void sounds.unlock();
                void app.setPreferences({ sound: !preferences.sound });
              }}
            />
          </div>
          <div className={s.settingRow}>
            <div>
              <h3>{t('Sound volume')}</h3>
              <p>{t('Keep it gentle.')}</p>
            </div>
            <div className={s.volumeControl}>
              <Volume2 size={17} />
              <input
                aria-label={t('Sound volume')}
                type="range"
                min="0"
                max="100"
                value={Math.round(preferences.volume * 100)}
                onChange={(event) =>
                  void app.setPreferences({ volume: Number(event.target.value) / 100 })
                }
              />
              <span>{Math.round(preferences.volume * 100)}%</span>
            </div>
          </div>
          <div className={s.settingRow}>
            <div>
              <h3>{t('Live performance')}</h3>
              <p>{t('Show speed and accuracy while you type.')}</p>
            </div>
            <Toggle
              label={t('Live performance')}
              checked={preferences.showLiveStats}
              onChange={() =>
                void app.setPreferences({ showLiveStats: !preferences.showLiveStats })
              }
            />
          </div>
          <div className={s.settingsNote}>
            <Monitor size={17} />
            <p>
              {t(
                'Ztype follows your reduced-motion preference on your first visit. You can always choose Focus for a still, quiet workspace.',
              )}
            </p>
          </div>
        </section>
        <aside>
          <section className={s.settingsCard}>
            <div className={s.settingsTitle}>
              <Cloud size={21} />
              <div>
                <h2>{t('Your journey')}</h2>
                <p>
                  {app.owner === 'guest'
                    ? t('Saved on this device')
                    : t('Connected to your account')}
                </p>
              </div>
            </div>
            <p className={s.settingsDescription}>
              {app.owner === 'guest'
                ? t(
                    'Your latest 100 sessions stay in this browser. Create an account to keep your progress across devices.',
                  )
                : t(
                    'Your sessions sync whenever you’re online. Offline practice stays safe on this device until it can upload.',
                  )}
            </p>
            {app.owner === 'guest' ? (
              <button className={s.primaryButton} onClick={() => app.setAuthOpen(true)}>
                {t('Save your journey')}
              </button>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void app.setDisplayName(name.trim()).then(() => setSaved(true));
                }}
                className={s.authForm}
              >
                <label>
                  {t('Explorer name')}
                  <input
                    value={name}
                    required
                    minLength={1}
                    maxLength={40}
                    onChange={(event) => {
                      setSaved(false);
                      setName(event.target.value);
                    }}
                  />
                </label>
                <button className={s.secondaryButton}>{t('Save name')}</button>
                {saved && (
                  <span role="status" className={s.successMessage}>
                    {t('Saved on this device; syncing to your account.')}
                  </span>
                )}
              </form>
            )}
            {app.owner === 'guest' && (
              <button className={s.dangerText} onClick={() => dialog.current?.showModal()}>
                {t('Clear guest history')}
              </button>
            )}
          </section>
          <p className={s.settingsFootnote}>
            {t('A comfortable pace is a good pace. Your settings should work for you.')}
          </p>
        </aside>
      </div>
      <dialog ref={dialog} className={s.dialog} aria-labelledby="clear-title">
        <div className={s.dialogContent}>
          <h2 id="clear-title">{t('Start a fresh flight log?')}</h2>
          <p>
            {t(
              'This removes your guest results, mission log, and lesson progress from this browser. Your preferences will stay.',
            )}
          </p>
          <div className={s.resultActions}>
            <button className={s.secondaryButton} onClick={() => dialog.current?.close()}>
              {t('Keep my history')}
            </button>
            <button
              className={s.dangerButton}
              onClick={() => void app.clearLocalHistory().then(() => dialog.current?.close())}
            >
              {t('Clear history')}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
      className={`${s.toggle} ${checked ? s.toggleOn : ''}`}
    >
      <span />
    </button>
  );
}
