import { generatePrompt, graphemes } from './content';
import { deriveAttempt, SCORING_VERSION, type Attempt, type TestConfig } from './types';

export type TypingEvent = 'correct' | 'mistake' | 'word' | 'complete';
export type Snapshot = {
  status: 'ready' | 'running' | 'finished';
  input: string;
  elapsedMs: number;
  correctCharacters: number;
  totalEntries: number;
  correctEntries: number;
  wpm: number;
  accuracy: number;
  progress: number;
  completedWords: number;
};

export class TypingEngine {
  readonly prompt: string;
  readonly letters: string[];
  private startedAt: number | null = null;
  private input: string[] = [];
  private samples: { second: number; wpm: number }[] = [];
  private listeners = new Set<(event: TypingEvent) => void>();
  private state: Snapshot = {
    status: 'ready',
    input: '',
    elapsedMs: 0,
    correctCharacters: 0,
    totalEntries: 0,
    correctEntries: 0,
    wpm: 0,
    accuracy: 100,
    progress: 0,
    completedWords: 0,
  };

  constructor(
    readonly config: TestConfig,
    readonly seed: number,
  ) {
    this.prompt = generatePrompt(config, seed);
    this.letters = graphemes(this.prompt, config.locale);
  }
  get snapshot(): Snapshot {
    return { ...this.state };
  }
  onEvent(callback: (event: TypingEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
  private emit(event: TypingEvent) {
    for (const listener of this.listeners) listener(event);
  }

  applyInput(value: string, now: number): Snapshot {
    if (this.state.status === 'finished') return this.snapshot;
    this.tick(now);
    if (this.snapshot.status === 'finished') return this.snapshot;
    const next = graphemes(value, this.config.locale).slice(0, this.letters.length);
    if (this.startedAt === null && next.length === 0) return this.snapshot;
    if (this.startedAt === null) {
      this.startedAt = now;
      this.state.status = 'running';
    }
    let prefix = 0;
    while (
      prefix < next.length &&
      prefix < this.input.length &&
      next[prefix] === this.input[prefix]
    )
      prefix++;
    let suffix = 0;
    while (
      suffix < next.length - prefix &&
      suffix < this.input.length - prefix &&
      next[next.length - 1 - suffix] === this.input[this.input.length - 1 - suffix]
    )
      suffix++;
    for (let i = prefix; i < next.length - suffix; i++) {
      this.state.totalEntries++;
      if (next[i] === this.letters[i]) {
        this.state.correctEntries++;
        this.emit('correct');
      } else this.emit('mistake');
      if (next[i] === ' ' && next[i] === this.letters[i]) this.emit('word');
    }
    this.input = next;
    this.state.input = next.join('');
    this.state.correctCharacters = next.reduce(
      (count, letter, i) => count + Number(letter === this.letters[i]),
      0,
    );
    this.state.completedWords =
      (this.state.input.match(/ /g) ?? []).length + Number(next.length === this.letters.length);
    this.tick(now);
    if (this.config.mode !== 'time' && next.length === this.letters.length) this.finish();
    return this.snapshot;
  }

  tick(now: number): Snapshot {
    if (this.startedAt === null || this.state.status === 'finished') return this.snapshot;
    const duration = this.config.mode === 'time' ? this.config.limit * 1000 : 1_800_000;
    this.state.elapsedMs = Math.min(
      duration,
      Math.max(this.state.elapsedMs, Math.round(now - this.startedAt)),
    );
    this.state.wpm = this.state.elapsedMs
      ? Math.round(this.state.correctCharacters / 5 / (this.state.elapsedMs / 60_000))
      : 0;
    this.state.accuracy = this.state.totalEntries
      ? Math.round((this.state.correctEntries / this.state.totalEntries) * 1000) / 10
      : 100;
    this.state.progress =
      this.config.mode === 'time'
        ? this.state.elapsedMs / duration
        : this.input.length / this.letters.length;
    const second = Math.floor(this.state.elapsedMs / 1000);
    if (second > 0 && second > (this.samples.at(-1)?.second ?? 0))
      this.samples.push({ second, wpm: this.state.wpm });
    if (this.state.elapsedMs >= duration) this.finish();
    return this.snapshot;
  }

  private finish() {
    if (this.state.status === 'finished') return;
    this.state.elapsedMs = Math.max(1, this.state.elapsedMs);
    this.state.status = 'finished';
    this.state.progress = 1;
    this.emit('complete');
  }

  result(id: string, completedAt: string): Attempt | null {
    if (this.state.status !== 'finished' || !this.state.totalEntries || !this.input.length)
      return null;
    // An unfinished word/lesson session that reaches the safety timeout is not a completed result.
    if (this.config.mode !== 'time' && this.input.length !== this.letters.length) return null;
    return deriveAttempt({
      id,
      config: this.config,
      seed: this.seed,
      scoringVersion: SCORING_VERSION,
      completedAt,
      elapsedMs: this.state.elapsedMs,
      characters: this.input.length,
      correctCharacters: this.state.correctCharacters,
      totalEntries: this.state.totalEntries,
      correctEntries: this.state.correctEntries,
      samples: this.samples,
    });
  }
}
