import { describe, expect, it } from 'vitest';
import { isMissionTransition, missionDamage, MissionEngine } from './mission';

function pilot(engine: MissionEngine) {
  let now = 0;
  return {
    advanceTo(id: string) {
      for (let i = 0; engine.snapshot.step.id !== id && i < 100; i++) {
        now += 100;
        const state = engine.snapshot;
        if (isMissionTransition(state.step.phase)) engine.skipTransition(now);
        else engine.applyInput(state.prompt || state.threats[0].word, now);
      }
      expect(engine.snapshot.step.id).toBe(id);
      return now;
    },
  };
}
describe('lunar rescue mission', () => {
  it('drains oxygen with active time, freezes it when paused, and expires at the rescue deadline', () => {
    const engine = new MissionEngine('standard', 30, 42, 'io');
    expect(engine.snapshot).toMatchObject({ health: 100, oxygen: 100, remainingMs: 120_000 });
    engine.tick(500_000);
    expect(engine.snapshot.oxygen).toBe(100); // Ready time is free.
    engine.applyInput('i', 500_000);
    engine.pause(530_000);
    expect(engine.snapshot).toMatchObject({ oxygen: 75, remainingMs: 90_000 });
    engine.tick(900_000);
    expect(engine.snapshot.oxygen).toBe(75);
    engine.resume(900_000);
    engine.tick(1_000_000);
    expect(engine.snapshot).toMatchObject({
      status: 'lost',
      oxygen: 0,
      health: 100,
      elapsedMs: 120_000,
      remainingMs: 0,
      failureReason: 'timeout',
    });
    const terminal = engine.snapshot;
    engine.applyInput('ignite', 1_100_000);
    engine.end(1_200_000);
    expect(engine.snapshot).toEqual(terminal);
  });
  it.each(['rock', 'debris'] as const)(
    'accumulates %s impacts and can independently exhaust health or oxygen',
    (kind) => {
      const engine = new MissionEngine('challenge', 120, 42);
      let now = pilot(engine).advanceTo('first-contact');
      let hits = 0;
      engine.onEvent((event) => {
        if (event === 'hit') {
          hits++;
          expect(engine.snapshot.impacts.at(-1)).toMatchObject({
            source: kind,
            healthDamage: missionDamage[kind].health,
            oxygenDamage: missionDamage[kind].oxygen,
          });
          expect(engine.snapshot.health).toBe(Math.max(0, 100 - hits * missionDamage[kind].health));
          expect(engine.snapshot.oxygen).toBe(
            Math.max(
              0,
              Math.ceil(
                100 -
                  hits * missionDamage[kind].oxygen -
                  (engine.snapshot.elapsedMs / engine.mission.durationMs) * 100,
              ),
            ),
          );
        }
      });
      for (let i = 0; i < 150 && engine.snapshot.status === 'running'; i++) {
        const state = engine.snapshot;
        if (isMissionTransition(state.step.phase)) engine.skipTransition(++now);
        else if (state.step.phase !== 'combat') engine.applyInput(state.prompt, ++now);
        else {
          const safe = state.threats.find((target) => target.kind !== kind);
          if (safe) engine.applyInput(safe.word, ++now);
          else
            engine.tick(
              (now +=
                Math.min(...state.threats.map((target) => target.remaining * target.budgetMs)) + 1),
            );
        }
      }
      expect(hits).toBe(5);
      expect(engine.snapshot.status).toBe('lost');
      expect(engine.snapshot.failureReason).toBe(kind === 'rock' ? 'health' : 'oxygen');
      expect(engine.snapshot.remainingMs).toBeGreaterThan(0);
    },
  );
  it.each(['ready', 'running', 'paused'] as const)(
    'ends a %s mission once and preserves an honest partial result',
    (status) => {
      const engine = new MissionEngine();
      if (status !== 'ready') engine.applyInput('ig', 100);
      if (status === 'paused') engine.pause(1100);
      engine.end(2100);
      const result = engine.result('partial', '2026-10-03T00:00:00Z')!;
      expect(result).toMatchObject({ outcome: 'ended', stars: 0, rescued: 0, health: 100 });
      expect(result.elapsedMs).toBe(status === 'ready' ? 0 : status === 'paused' ? 1000 : 2000);
      engine.tick(100_000);
      engine.applyInput('ignite', 100_000);
      expect(engine.result(result.id, result.completedAt)).toEqual(result);
    },
  );
  it('accounts for time before skipping and does not skip two scenes at an expiry boundary', () => {
    const engine = new MissionEngine('standard', 30, 42);
    engine.applyInput('ignite', 10);
    engine.skipTransition(610);
    expect(engine.snapshot.step.phase).toBe('landing');
    expect(engine.snapshot.elapsedMs).toBe(600);
    expect(engine.snapshot.typingMs).toBe(0);
    engine.skipTransition(810);
    expect(engine.snapshot.step.phase).toBe('walk');
    expect(engine.snapshot.elapsedMs).toBe(800);
  });
  it('requires correct ignition and commands; correcting errors preserves their accuracy cost', () => {
    const engine = new MissionEngine('standard', 30, 42);
    engine.applyInput('ignitx', 10);
    expect(engine.snapshot.step.phase).toBe('prime');
    engine.applyInput('ignit', 30);
    engine.applyInput('ignite', 50);
    expect(engine.snapshot.step.phase).toBe('launch');
    expect(engine.snapshot.totalEntries).toBe(7);
    expect(engine.snapshot.correctEntries).toBe(6);
  });
  it('locks by initial letter, requires correction, and never applies leftover input to another target', () => {
    const engine = new MissionEngine('standard', 30, 42);
    const now = pilot(engine).advanceTo('first-contact');
    const word = engine.snapshot.threats[0].word;
    engine.applyInput(word[0], now + 1);
    expect(engine.snapshot.prompt).toBe(word);
    engine.applyInput(word.slice(0, -1) + '!', now + 2);
    expect(engine.snapshot.disabled).toBe(0);
    engine.applyInput(word, now + 3);
    expect(engine.snapshot.disabled).toBe(1);
    expect(engine.snapshot.threats).toHaveLength(2);
    expect(engine.snapshot.input).toBe('');
    const next = engine.snapshot.threats[1].word;
    engine.applyInput(next[0], now + 4);
    expect(engine.snapshot.prompt).toBe(next);
    expect(engine.snapshot.threats.find((t) => t.id === engine.snapshot.lockedId)?.word).toBe(next);
  });
  it('pauses both approaching threats and score clocks until an explicit resume', () => {
    const engine = new MissionEngine('standard', 30, 42);
    const now = pilot(engine).advanceTo('first-contact');
    engine.pause(now + 500);
    const paused = engine.snapshot;
    engine.tick(now + 1_000_000);
    engine.applyInput('orbit', now + 1_000_000);
    expect(engine.snapshot).toEqual(paused);
    engine.resume(now + 1_000_000);
    engine.tick(now + 1_000_200);
    expect(engine.snapshot.typingMs).toBe(paused.typingMs + 200);
    expect(engine.snapshot.health).toBe(100);
  });
  it('takes damage at target deadlines, clears expired input, and freezes after failure', () => {
    const engine = new MissionEngine('challenge', 30, 42);
    const now = pilot(engine).advanceTo('first-contact');
    engine.applyInput(engine.snapshot.threats[0].word.slice(0, 2), now + 1);
    const deadline = engine.snapshot.threats[0].budgetMs;
    engine.tick(now + deadline + 1);
    expect(engine.snapshot.health).toBe(88);
    expect(engine.snapshot.input).toBe('');
    engine.tick(now + 400_000);
    expect(engine.snapshot.status).toBe('lost');
    const failed = engine.snapshot;
    engine.applyInput('signal', now + 100_200);
    engine.tick(now + 200_000);
    expect(engine.snapshot).toEqual(failed);
    expect(engine.result('failed', '2026-09-29T00:00:00Z')?.outcome).toBe('lost');
  });
  it('has unambiguous target initials and gives slower typists more time', () => {
    const slow = new MissionEngine('relaxed', 15, 42);
    const fast = new MissionEngine('challenge', 60, 42);
    pilot(slow).advanceTo('first-contact');
    pilot(fast).advanceTo('first-contact');
    expect(slow.snapshot.threats[0].budgetMs).toBeGreaterThan(fast.snapshot.threats[0].budgetMs);
  });
  it('finishes the whole rescue, excludes cutscenes from typing time, and starts clean on replay', () => {
    const engine = new MissionEngine('standard', 30, 42);
    engine.applyInput('ignite', 10);
    engine.tick(3010);
    expect(engine.snapshot.typingMs).toBe(0);
    expect(engine.snapshot.elapsedMs).toBe(3000);
    // Use a fresh deterministic timeline for the entire mission.
    const run = new MissionEngine('standard', 30, 42);
    pilot(run).advanceTo('departure');
    expect(run.snapshot.rescued).toBe(1);
    run.skipTransition(100_000);
    expect(run.snapshot.status).toBe('won');
    const result = run.result('complete', '2026-09-29T00:00:00Z')!;
    expect(result.stars).toBe(3);
    expect(result.disabled).toBe(74);
    expect(result.accuracy).toBe(100);
    expect(result.rescued).toBe(1);
    const replay = new MissionEngine('standard', 30, 42);
    expect(replay.snapshot.status).toBe('ready');
    expect(replay.snapshot.disabled).toBe(0);
    expect(replay.result('unfinished', '')).toBeNull();
  });
  it('ramps later waves, supports three distinct targets, and leaves Pilot enough time at the chosen pace', () => {
    const engine = new MissionEngine('standard', 30, 42);
    pilot(engine).advanceTo('first-contact');
    expect(engine.snapshot.threats[0].budgetMs).toBeLessThan(5000);
    pilot(engine).advanceTo('last-wave');
    const targets = engine.snapshot.threats;
    expect(targets).toHaveLength(3);
    expect(new Set(targets.map((target) => target.slot)).size).toBe(3);
    expect(targets[2].budgetMs).toBeGreaterThan(targets[1].budgetMs);
    const typingTime = targets.reduce((sum, target) => sum + target.word.length * 400, 0);
    expect(targets[2].budgetMs).toBeGreaterThan(typingTime);
    expect(targets[0].budgetMs / targets[0].word.length).toBeLessThan(4100 / 5);
  });
  it('records anchored impacts once and warns once per approaching drone', () => {
    const engine = new MissionEngine('standard', 30, 42);
    const events: string[] = [];
    engine.onEvent((event) => events.push(event));
    const now = pilot(engine).advanceTo('first-contact');
    const budget = engine.snapshot.threats[0].budgetMs;
    engine.tick(now + budget * 0.75);
    engine.tick(now + budget * 0.8);
    expect(events.filter((event) => event === 'warning')).toHaveLength(1);
    engine.applyInput(engine.snapshot.threats[0].word, now + budget * 0.81);
    expect(engine.snapshot.impacts).toHaveLength(1);
    expect(engine.snapshot.impacts[0]).toMatchObject({ kind: 'drone', cameraZ: 8, slot: 0 });
    engine.tick(now + budget * 0.82);
    expect(engine.snapshot.impacts).toHaveLength(1);
    engine.tick(now + 100_000);
    expect(engine.snapshot.impacts.map((impact) => impact.kind)).toEqual([
      'drone',
      'shield',
      'shield',
    ]);
    expect(new Set(engine.snapshot.impacts.map((impact) => impact.id)).size).toBe(3);
  });
  it('randomizes all 27 waves per run without repeating words or ambiguous initials', () => {
    const collect = (seed: number) => {
      const engine = new MissionEngine('standard', 30, seed);
      const words: string[] = [];
      const waves = new Set<string>();
      const kinds = new Set<string>();
      for (let now = 0; engine.snapshot.status !== 'won' && now < 30_000; now += 100) {
        const state = engine.snapshot;
        if (state.step.phase === 'combat') {
          const key = `${state.step.id}-${state.wave}`;
          if (!waves.has(key)) {
            waves.add(key);
            const initials = state.threats.map((t) => t.word[0]);
            expect(new Set(initials).size).toBe(initials.length);
            words.push(...state.threats.map((t) => t.word));
            state.threats.forEach((t) => kinds.add(t.kind));
          }
        }
        if (isMissionTransition(state.step.phase)) engine.skipTransition(now);
        else engine.applyInput(state.prompt || state.threats[0].word, now);
      }
      expect(engine.snapshot.status).toBe('won');
      expect(waves.size).toBe(27);
      expect(words).toHaveLength(74);
      expect(new Set(words).size).toBe(words.length);
      expect([...kinds].sort()).toEqual(['debris', 'drone', 'rock']);
      return words;
    };
    const first = collect(123);
    expect(collect(123)).toEqual(first);
    expect(collect(456)).not.toEqual(first);
  });
  it('gives every Pilot wave enough time to clear sequentially at the selected pace', () => {
    for (const pace of [15, 30, 80]) {
      const engine = new MissionEngine('standard', pace, 123);
      let now = 0;
      while (!['won', 'lost'].includes(engine.snapshot.status) && now < 1_000_000) {
        const state = engine.snapshot;
        if (isMissionTransition(state.step.phase)) engine.skipTransition((now += 1));
        else {
          const word = state.prompt || state.threats[0].word;
          now += (word.length * 60_000) / (pace * 5);
          engine.applyInput(word, now);
        }
        expect(engine.snapshot.health).toBe(100);
      }
      expect(engine.snapshot.status).toBe(pace === 15 ? 'lost' : 'won');
      if (pace === 15) expect(engine.snapshot.failureReason).toBe('timeout');
    }
  });
});
