import { t } from '../i18n';
import s from '../styles/App.module.css';

const rows = ['1234567890', 'qwertyuiop', 'asdfghjkl;', 'zxcvbnm,./'];
export function Keyboard({ keys }: { keys: string }) {
  return (
    <div className={s.keyboardGuide}>
      <div className={s.keyboard} aria-label={`QWERTY keyboard. Practice keys: ${keys}`}>
        {rows.map((row, r) => (
          <div key={row} className={s.keyboardRow} style={{ paddingLeft: `${r * 7}px` }}>
            {r === 3 && (
              <span className={`${s.key} ${s.shiftKey} ${keys === t('Shift') ? s.keyActive : ''}`}>
                {t('shift')}
              </span>
            )}
            {[...row].map((key) => (
              <span
                key={key}
                className={`${s.key} ${keys.toLowerCase().includes(key) ? s.keyActive : ''} ${key === 'f' || key === 'j' ? s.homeKey : ''}`}
              >
                {key}
              </span>
            ))}
          </div>
        ))}
        <div className={s.keyboardRow}>
          <span className={s.spaceKey}>{t('space')}</span>
        </div>
      </div>
      <p>
        <span className={s.liveDot} />
        {t(' Find the bumps on ')}
        <kbd>{t('F')}</kbd>
        {t(' and ')}
        <kbd>{t('J')}</kbd>
        {t('. That’s home.')}
      </p>
    </div>
  );
}
