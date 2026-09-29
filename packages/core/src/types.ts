import { z } from 'zod';

export const CONTENT_VERSION = 'en-1';
export const SCORING_VERSION = 1;
export const lessonIds = [
  'home',
  'left',
  'right',
  'upper',
  'lower',
  'capitals',
  'numbers',
  'punctuation',
] as const;
const commonConfig = { locale: z.literal('en'), contentVersion: z.literal(CONTENT_VERSION) };
export const configSchema = z.discriminatedUnion('mode', [
  z.object({
    ...commonConfig,
    mode: z.literal('time'),
    limit: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120)]),
  }),
  z.object({
    ...commonConfig,
    mode: z.literal('words'),
    limit: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]),
  }),
  z.object({ ...commonConfig, mode: z.literal('lesson'), lessonId: z.enum(lessonIds) }),
]);
export type TestConfig = z.infer<typeof configSchema>;
export const defaultConfig: TestConfig = {
  mode: 'time',
  limit: 30,
  locale: 'en',
  contentVersion: CONTENT_VERSION,
};

export const preferencesSchema = z.object({
  scene: z.enum(['space', 'focus']),
  sound: z.boolean(),
  volume: z.number().min(0).max(1),
  showLiveStats: z.boolean(),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: Preferences = {
  scene: 'space',
  sound: false,
  volume: 0.25,
  showLiveStats: true,
};

export const attemptSchema = z
  .object({
    id: z.string().uuid(),
    config: configSchema,
    scoringVersion: z.literal(SCORING_VERSION),
    seed: z.number().int().min(0).max(0xffffffff),
    completedAt: z.string().datetime(),
    elapsedMs: z.number().int().min(1).max(1_800_000),
    characters: z.number().int().min(1).max(50_000),
    correctCharacters: z.number().int().min(0).max(50_000),
    totalEntries: z.number().int().min(1).max(100_000),
    correctEntries: z.number().int().min(0).max(100_000),
    samples: z
      .array(z.object({ second: z.number().min(0).max(1800), wpm: z.number().min(0).max(100_000) }))
      .max(1801),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (
      a.correctCharacters > a.characters ||
      a.correctEntries > a.totalEntries ||
      a.characters > a.totalEntries ||
      a.correctCharacters > a.correctEntries
    ) {
      ctx.addIssue({ code: 'custom', message: 'Character counters are inconsistent.' });
    }
    if (a.config.mode === 'time' && a.elapsedMs !== a.config.limit * 1000) {
      ctx.addIssue({ code: 'custom', message: 'Timed attempts must run for their full duration.' });
    }
    if (
      a.samples.some(
        (s, i) => s.second > a.elapsedMs / 1000 || (i > 0 && s.second <= a.samples[i - 1].second),
      )
    ) {
      ctx.addIssue({ code: 'custom', message: 'Samples must follow the attempt timeline.' });
    }
  });
export type AttemptInput = z.infer<typeof attemptSchema>;
export type Attempt = AttemptInput & { wpm: number; accuracy: number; mistakes: number };
export type Progress = {
  totalSessions: number;
  totalPracticeMs: number;
  bests: Record<string, { wpm: number; accuracy: number; attemptId: string }>;
  masteredLessons: string[];
  badges: string[];
};
export type LanguagePack = {
  locale: string;
  direction: 'ltr' | 'rtl';
  contentVersion: string;
  keyboardLayout: string;
  words: readonly string[];
};
export type Profile = { displayName: string; preferences: Preferences };

export function deriveAttempt(input: AttemptInput): Attempt {
  return {
    ...input,
    wpm: Math.round(input.correctCharacters / 5 / (input.elapsedMs / 60_000)),
    accuracy: Math.round((input.correctEntries / input.totalEntries) * 1000) / 10,
    mistakes: input.totalEntries - input.correctEntries,
  };
}
export function configKey(config: TestConfig): string {
  return config.mode === 'lesson'
    ? `${config.locale}:lesson:${config.lessonId}`
    : `${config.locale}:${config.mode}:${config.limit}`;
}
export const emptyProgress = (): Progress => ({
  totalSessions: 0,
  totalPracticeMs: 0,
  bests: {},
  masteredLessons: [],
  badges: [],
});
export function addToProgress(previous: Progress, attempt: Attempt): Progress {
  const key = configKey(attempt.config);
  const best = previous.bests[key];
  const mastered = new Set(previous.masteredLessons);
  if (attempt.config.mode === 'lesson' && attempt.correctEntries / attempt.totalEntries >= 0.95)
    mastered.add(attempt.config.lessonId);
  const totalSessions = previous.totalSessions + 1;
  return {
    totalSessions,
    totalPracticeMs: previous.totalPracticeMs + attempt.elapsedMs,
    bests: {
      ...previous.bests,
      ...(!best || attempt.wpm > best.wpm
        ? { [key]: { wpm: attempt.wpm, accuracy: attempt.accuracy, attemptId: attempt.id } }
        : {}),
    },
    masteredLessons: [...mastered],
    badges: [
      'first-flight',
      ...(totalSessions >= 10 ? ['frequent-flyer'] : []),
      ...(mastered.size === lessonIds.length ? ['flight-academy'] : []),
    ],
  };
}
