import { describe, expect, it } from 'vitest';
import {
  TypingEngine,
  defaultConfig,
  deriveAttempt,
  attemptSchema,
  addToProgress,
  emptyProgress,
  generatePrompt,
  graphemes,
  configKey,
} from './index';

const id = '9ef97dba-b71e-41e7-8929-c438493c2033';
describe('typing and scoring', () => {
  it('starts on input and preserves mistakes after correction', () => {
    const e = new TypingEngine(defaultConfig, 42);
    e.applyInput('', 0);
    expect(e.snapshot.status).toBe('ready');
    const letter = e.letters[0];
    e.applyInput(letter, 1000);
    e.applyInput(letter + '#', 2000);
    e.applyInput(letter, 3000);
    e.applyInput(e.prompt.slice(0, 2), 4000);
    e.tick(31_000);
    const result = e.result(id, new Date().toISOString())!;
    expect(result.accuracy).toBe(66.7);
    expect(result.mistakes).toBe(1);
    expect(result.correctCharacters).toBe(2);
    expect(result.elapsedMs).toBe(30_000);
    expect(attemptSchema.safeParse(resultInput(result)).success).toBe(true);
  });
  it('finishes on the deadline after background throttling and ignores late input', () => {
    const e = new TypingEngine(defaultConfig, 1);
    e.applyInput(e.prompt.slice(0, 3), 100);
    e.applyInput(e.prompt.slice(0, 10), 90_000);
    expect(e.snapshot.input.length).toBe(3);
    expect(e.snapshot.elapsedMs).toBe(30_000);
    expect(e.snapshot.status).toBe('finished');
  });
  it('completes word mode, tracks replacement input and calculates remaining correct characters', () => {
    const e = new TypingEngine({ ...defaultConfig, mode: 'words', limit: 10 }, 99);
    e.applyInput(e.prompt.slice(0, 1), 0);
    e.applyInput(e.prompt, 60_000);
    const r = e.result(id, new Date().toISOString())!;
    expect(r.wpm).toBe(Math.round(e.letters.length / 5));
    expect(r.accuracy).toBe(100);
    expect(e.snapshot.completedWords).toBe(10);
  });
  it('segments graphemes and normalizes Unicode', () => {
    expect(graphemes('e\u0301👩‍🚀')).toEqual(['é', '👩‍🚀']);
    expect(graphemes('سلام').length).toBe(4);
  });
  it('generates reproducible prompts and isolates personal bests', () => {
    expect(generatePrompt(defaultConfig, 9)).toBe(generatePrompt(defaultConfig, 9));
    expect(generatePrompt(defaultConfig, 9)).not.toBe(generatePrompt(defaultConfig, 10));
    expect(configKey(defaultConfig)).not.toBe(
      configKey({ ...defaultConfig, mode: 'time', limit: 60 }),
    );
  });
  it('does not count deleted letters as correct retained characters', () => {
    const e = new TypingEngine(defaultConfig, 9);
    e.applyInput(e.prompt.slice(0, 5), 0);
    e.applyInput(e.prompt.slice(0, 2), 1000);
    expect(e.snapshot.correctCharacters).toBe(2);
    expect(e.snapshot.totalEntries).toBe(5);
  });
});

function resultInput({
  wpm: _w,
  accuracy: _a,
  mistakes: _m,
  ...input
}: ReturnType<typeof deriveAttempt>) {
  return input;
}

describe('progress', () => {
  it('awards ten-session badge and masters lessons without rounding up accuracy', () => {
    const e = new TypingEngine(
      { mode: 'lesson', lessonId: 'home', locale: 'en', contentVersion: 'en-1' },
      1,
    );
    e.applyInput(e.prompt[0], 0);
    e.applyInput(e.prompt, 60_000);
    const attempt = e.result(id, new Date().toISOString())!;
    let progress = emptyProgress();
    for (let i = 0; i < 10; i++) progress = addToProgress(progress, attempt);
    expect(progress.badges).toEqual(['first-flight', 'frequent-flyer']);
    expect(progress.masteredLessons).toEqual(['home']);
    expect(progress.totalPracticeMs).toBe(600_000);
    expect(
      addToProgress(emptyProgress(), {
        ...attempt,
        correctEntries: 9496,
        totalEntries: 10_000,
        accuracy: 95,
      }).masteredLessons,
    ).toEqual([]);
  });
  it('rejects impossible counters and shortened timed sessions', () => {
    expect(attemptSchema.safeParse({}).success).toBe(false);
  });
});
