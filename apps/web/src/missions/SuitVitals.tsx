import type { MissionSnapshot } from '@ztype/core';
import { m } from './i18n';
import s from './Mission.module.css';

export function suitCondition(health: number, oxygen: number) {
  const lowest = Math.min(health, oxygen);
  return lowest <= 10 ? 'danger' : lowest <= 25 ? 'critical' : lowest <= 50 ? 'warning' : 'stable';
}

export function SuitVitals({ snapshot }: { snapshot: MissionSnapshot }) {
  const condition = suitCondition(snapshot.health, snapshot.oxygen);
  return (
    <div className={s.suitVitals} data-condition={condition} data-testid="suit-vitals">
      <svg viewBox="0 0 64 76" aria-hidden="true">
        <circle
          cx="32"
          cy="23"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="3"
        />
        <circle
          cx="32"
          cy="23"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          pathLength="100"
          strokeDasharray={`${snapshot.health} 100`}
          transform="rotate(-90 32 23)"
        />
        <path
          d="M23 27V20a9 9 0 0 1 18 0v7l-4 5H27Zm1 12-9 7-3 17m28-24 9 7 3 17M22 42v19l-3 12m23-31v19l3 12M24 49h16M26 20h12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <div>
        {(
          [
            ['health', snapshot.health],
            ['oxygen', snapshot.oxygen],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className={s.vitalRow}>
            <span>
              {m(label)} <strong>{value}%</strong>
            </span>
            <div
              role="meter"
              aria-label={m(label)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value}
            >
              <i style={{ width: `${value}%` }} />
            </div>
          </div>
        ))}
        <small role="status">{m(condition)}</small>
      </div>
    </div>
  );
}

export function SuitDamage({ snapshot, calm }: { snapshot: MissionSnapshot; calm: boolean }) {
  const condition = suitCondition(snapshot.health, snapshot.oxygen);
  return (
    <div
      className={s.suitDamage}
      data-testid="suit-damage"
      data-condition={condition}
      data-animate={!calm && snapshot.status === 'running'}
      aria-hidden="true"
    >
      {snapshot.health <= 25 && (
        <svg viewBox="0 0 1000 700" preserveAspectRatio="none">
          <path
            d="M0 0h100l-26 14-17 30-10-13-9 44-11-12-8 46L0 135ZM1000 0h-78l21 25 12 51 13-20 10 51 22 12ZM0 700v-104l22 38 17-11 12 30 44 47ZM1000 700h-106l45-27 7-30 22 13 12-58 20-20Z"
            fill="#7d1923"
            opacity="0.45"
          />
          <g fill="#9e2930" opacity="0.3">
            <circle cx="29" cy="153" r="6" />
            <circle cx="965" cy="151" r="4" />
            <ellipse cx="71" cy="54" rx="3" ry="8" />
          </g>
        </svg>
      )}
    </div>
  );
}
