import en from './en.json';
export const m = (key: keyof typeof en, values: Record<string, string | number> = {}): string =>
  en[key].replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));

export const missionTime = (ms: number) =>
  `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
export const riskLabels = {
  low: 'riskLow',
  moderate: 'riskModerate',
  high: 'riskHigh',
  extreme: 'riskExtreme',
} as const;
