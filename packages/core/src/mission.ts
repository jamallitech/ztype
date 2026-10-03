import { getMission, type MissionDefinition } from './campaign';
import { graphemes } from './content';

export type MissionDifficulty = 'relaxed' | 'standard' | 'challenge';
export type MissionPhase =
  | 'prime'
  | 'launch'
  | 'landing'
  | 'walk'
  | 'repair'
  | 'combat'
  | 'rescue'
  | 'extract'
  | 'departure';
export type MissionStatus = 'ready' | 'running' | 'paused' | 'won' | 'lost' | 'ended';
export type MissionFailure = 'health' | 'oxygen' | 'timeout';
export type MissionStep = {
  id: string;
  phase: MissionPhase;
  title: string;
  objective: string;
  radio: string;
  prompt?: string;
  durationMs?: number;
  waves?: readonly number[];
  from: number;
  to: number;
};

export type MissionThreatKind = 'drone' | 'rock' | 'debris';
export const missionDamage: Record<MissionThreatKind, { health: number; oxygen: number }> = {
  drone: { health: 12, oxygen: 6 },
  rock: { health: 22, oxygen: 10 },
  debris: { health: 16, oxygen: 20 },
};
export type MissionThreat = {
  kind: MissionThreatKind;
  id: string;
  word: string;
  slot: number;
  remaining: number;
  budgetMs: number;
};
export type MissionEvent =
  | 'correct'
  | 'mistake'
  | 'lock'
  | 'warning'
  | 'wave'
  | 'shot'
  | 'hit'
  | 'phase'
  | 'rescued'
  | 'ended'
  | 'won'
  | 'lost';
export type MissionImpact = {
  id: number;
  kind: MissionThreatKind | 'shield';
  source: MissionThreatKind;
  healthDamage: number;
  oxygenDamage: number;
  slot: number;
  remaining: number;
  cameraZ: number;
};
export type MissionResult = {
  id: string;
  missionId: string;
  contentVersion: number;
  completedAt: string;
  difficulty: MissionDifficulty;
  pace: number;
  outcome: 'won' | 'lost' | 'ended';
  // Optional for compatibility with saved mission records from earlier versions.
  health?: number;
  oxygen?: number;
  failureReason?: MissionFailure;
  durationMs?: number;
  score: number;
  stars: number;
  accuracy: number;
  wpm: number;
  elapsedMs: number;
  typingMs: number;
  totalEntries: number;
  correctEntries: number;
  disabled: number;
  shield: number;
  rescued: number;
};
export type MissionSnapshot = {
  status: MissionStatus;
  missionId: string;
  stepIndex: number;
  step: MissionStep;
  stepProgress: number;
  elapsedMs: number;
  typingMs: number;
  input: string;
  remainingMs: number;
  prompt: string;
  lockedId: string | null;
  threats: MissionThreat[];
  wave: number;
  shield: number;
  health: number;
  oxygen: number;
  failureReason: MissionFailure | null;
  disabled: number;
  rescued: number;
  accuracy: number;
  wpm: number;
  totalEntries: number;
  correctEntries: number;
  event: MissionEvent | null;
  eventSequence: number;
  lastShot: { slot: number; remaining: number } | null;
  impacts: MissionImpact[];
};
export const isMissionTransition = (phase: MissionPhase) =>
  ['launch', 'landing', 'walk', 'departure'].includes(phase);

// One shuffled deck per run: no repeated words, and distinct initials in each
// wave make target selection unambiguous. Seeds let tests replay an encounter.
const missionWords = `orbit lunar signal drift guard beacon rescue vector shield comet anchor
return plasma guardian horizon velocity crater silent copper rocket engine radar pilot flight
planet oxygen station capsule nebula gravity meteor galaxy solar cosmic launch module reactor
voyage silver frozen summit tunnel valley shadow impact target sector repair patrol remote
static channel circuit sensor hazard breach carbon quartz cobalt iron nickel amber flare spark
stone rubble metal alloy shard debris wreck panel frame cable bolt wing pulse light dark dusk
nova echo flux glow dust gate wave zone core link scan lock fire star moon mars safe calm
rapid focus clear brave quick steady climb guide watch track move turn lift land rise dive
water ice frost snow cloud storm thunder winter spring summer autumn wind rain ocean river
forest meadow canyon desert island coast stream ridge cavern garden timber willow cedar maple
falcon eagle raven finch robin heron crane swan hawk fox wolf bear otter tiger lion horse
harbor bridge tower beacon shelter bunker hangar portal passage corridor antenna battery
thruster turbine magnet helmet visor gloves boots tether thermal pressure vacuum orbiting
apex bright charge defend escape fragment granite habitat journey kinetic lattice mineral
network outpost pioneer resolve scanner tempest uplink venture waypoint xenon yield zenith
balance durable energy freedom gather hidden isolate jumper kindle listen motion navigate
observe protect recover support transmit uncover venture wander yellow zero archive border
compass direct ember fusion gentle humble intact jacket keeper launch monitor noble object
prism quiet ranger secure travel unique violet warmth beacon count delta elbow flare giant
honor inlet jewel kneel logic music north optic patch reach south trace unity value wheat
axis blade clean depth event field glass hinge ivory joint known laser march night outer
proof radio route scope troop urban vital world young brisk dream forge green heavy image
limit orbit point round swift touch upper vivid waste yacht acceleration atmosphere avalanche
calibrate celestial clearance collision commander component containment coordinate corrosion
countdown crystalline deactivate decompress deployment diagnostic discovery electrical emergency
encounter endurance evacuation expedition extraction formation frequency generator geological
guidance hemisphere hydrogen identify illuminate infrared integrity intercept isolation latitude
longitude maintenance maneuver navigation nitrogen objective operation oscillator perimeter
platform precision propulsion proximity radiation reconnaissance reinforce replenish resistance
resonance satellite sector secure separation shutdown signature stabilize structure subsystem
surveillance synchronize telemetry temperature trajectory transmitter turbulence ultraviolet
underground ventilation vibration visibility waypoint weathering wilderness withstand`.split(/\s+/);
const wordBank = [...new Set(missionWords)];
function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
function encounterDeck(seed: number, mission: MissionDefinition) {
  const random = seededRandom(seed);
  const deck = [...wordBank];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const encounters = new Map<string, string[][]>();
  for (const step of mission.steps) {
    if (!step.waves) continue;
    encounters.set(
      step.id,
      step.waves.map((count, wave) => {
        const words: string[] = [];
        for (let i = 0; i < count; i++) {
          // Start with short words, then introduce longer ones as pressure rises.
          const maxLength =
            mission.level === 1 && step.id === 'first-contact' && wave < 3
              ? 5
              : mission.maxWordLength;
          let index = deck.findIndex(
            (word) =>
              word.length >= mission.minWordLength &&
              word.length <= maxLength &&
              !words.some((chosen) => chosen[0] === word[0]),
          );
          if (index < 0)
            index = deck.findIndex((word) => !words.some((chosen) => chosen[0] === word[0]));
          if (index < 0) throw new Error('Mission word bank exhausted');
          words.push(deck.splice(index, 1)[0]);
        }
        return words;
      }),
    );
  }
  return encounters;
}

/** A deterministic encounter clock. Rendering, storage and audio never control mission rules. */
export class MissionEngine {
  private status: MissionStatus = 'ready';
  private beforePause: 'ready' | 'running' = 'ready';
  private index = 0;
  private lastTime: number | null = null;
  private stepMs = 0;
  private elapsedMs = 0;
  private typingMs = 0;
  private typed = '';
  private lockedId: string | null = null;
  private wave = 0;
  private targets: (MissionThreat & { elapsedMs: number; warned: boolean })[] = [];
  private impacts: MissionImpact[] = [];
  private impactId = 0;
  private health = 100;
  private oxygen = 100;
  private failureReason: MissionFailure | null = null;
  private disabled = 0;
  private rescued = 0;
  private totalEntries = 0;
  private correctEntries = 0;
  private completedCharacters = 0;
  private event: MissionEvent | null = null;
  private eventSequence = 0;
  private lastShot: MissionSnapshot['lastShot'] = null;
  private listeners = new Set<(event: MissionEvent) => void>();
  readonly pace: number;
  readonly mission: MissionDefinition;
  private readonly encounters: Map<string, string[][]>;
  constructor(
    readonly difficulty: MissionDifficulty = 'standard',
    pace = 30,
    seed = Math.floor(Math.random() * 4294967296),
    destination = 'moon',
  ) {
    const mission = getMission(destination);
    if (!mission) throw new Error(`Unknown mission: ${destination}`);
    this.mission = mission;
    this.encounters = encounterDeck(seed, mission);
    this.pace = Math.max(10, Math.min(120, Number.isFinite(pace) ? pace : 30));
  }
  onEvent(listener: (event: MissionEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(event: MissionEvent) {
    this.event = event;
    this.eventSequence++;
    this.listeners.forEach((listener) => listener(event));
  }
  get snapshot(): MissionSnapshot {
    const step: MissionStep = this.mission.steps[this.index];
    const prompt =
      step.phase === 'combat'
        ? (this.targets.find((target) => target.id === this.lockedId)?.word ?? '')
        : (step.prompt ?? '');
    const letters = graphemes(prompt);
    const retained = graphemes(this.typed).filter((letter, i) => letter === letters[i]).length;
    return {
      status: this.status,
      missionId: this.mission.missionId,
      stepIndex: this.index,
      step,
      input: this.typed,
      prompt,
      lockedId: this.lockedId,
      threats: this.targets.map(({ elapsedMs: _elapsed, warned: _warned, ...target }) => ({
        ...target,
      })),
      impacts: this.impacts.map((impact) => ({ ...impact })),
      wave: this.wave,
      shield: Math.ceil((this.health * 3) / 100),
      health: this.health,
      oxygen: Math.ceil(this.oxygen),
      failureReason: this.failureReason,
      disabled: this.disabled,
      rescued: this.rescued,
      elapsedMs: this.elapsedMs,
      remainingMs: Math.max(0, this.mission.durationMs - this.elapsedMs),
      typingMs: this.typingMs,
      totalEntries: this.totalEntries,
      correctEntries: this.correctEntries,
      accuracy: this.totalEntries
        ? Math.round((this.correctEntries / this.totalEntries) * 1000) / 10
        : 100,
      wpm: this.typingMs
        ? Math.round((this.completedCharacters + retained) / 5 / (this.typingMs / 60_000))
        : 0,
      stepProgress: step.durationMs
        ? Math.min(1, this.stepMs / step.durationMs)
        : step.phase === 'combat'
          ? this.wave / (step.waves?.length ?? 1)
          : prompt.length
            ? Math.min(1, this.typed.length / prompt.length)
            : 0,
      event: this.event,
      eventSequence: this.eventSequence,
      lastShot: this.lastShot && { ...this.lastShot },
    };
  }
  tick(now: number): MissionSnapshot {
    if (this.status !== 'running') return this.snapshot;
    const previousOxygen = this.oxygen;
    const delta = Math.min(
      Math.max(0, now - (this.lastTime ?? now)),
      this.mission.durationMs - this.elapsedMs,
      (this.oxygen * this.mission.durationMs) / 100,
    );
    this.lastTime = Math.max(now, this.lastTime ?? now);
    this.elapsedMs += delta;
    this.stepMs += delta;
    this.oxygen = Math.max(0, this.oxygen - (delta * 100) / this.mission.durationMs);
    if (this.oxygen < 1e-8) this.oxygen = 0;
    const step = this.snapshot.step;
    if (!isMissionTransition(step.phase)) this.typingMs += delta;
    if (!this.oxygen || this.elapsedMs >= this.mission.durationMs) {
      this.failureReason = this.elapsedMs >= this.mission.durationMs - 1 ? 'timeout' : 'oxygen';
      this.status = 'lost';
      this.emit('lost');
      return this.snapshot;
    }
    if ([50, 25, 10].some((threshold) => previousOxygen > threshold && this.oxygen <= threshold))
      this.emit('warning');
    if (isMissionTransition(step.phase)) {
      if (this.stepMs >= (step.durationMs ?? 0)) this.advance();
    } else {
      if (step.phase === 'combat') {
        for (const target of [...this.targets]) {
          target.elapsedMs += delta;
          target.remaining = Math.max(0, 1 - target.elapsedMs / target.budgetMs);
          if (target.remaining > 0 && target.remaining <= 0.28 && !target.warned) {
            target.warned = true;
            this.emit('warning');
          }
          if (target.remaining === 0) {
            this.targets = this.targets.filter((item) => item.id !== target.id);
            if (this.lockedId === target.id) {
              this.lockedId = null;
              this.typed = '';
            }
            const damage = missionDamage[target.kind];
            this.health = Math.max(0, this.health - damage.health);
            this.oxygen = Math.max(0, this.oxygen - damage.oxygen);
            this.recordImpact('shield', target);
            this.emit('hit');
            if (!this.health || !this.oxygen) {
              this.failureReason = !this.health ? 'health' : 'oxygen';
              this.status = 'lost';
              this.emit('lost');
              break;
            }
          }
        }
        if (this.status === 'running' && !this.targets.length) this.nextWave();
      }
    }
    return this.snapshot;
  }
  applyInput(value: string, now: number): MissionSnapshot {
    if (this.status !== 'ready' && this.status !== 'running') return this.snapshot;
    const previousStep = this.index;
    const previousLock = this.lockedId;
    this.tick(now);
    if (
      previousStep !== this.index ||
      (previousLock && !this.targets.some((t) => t.id === previousLock)) ||
      this.snapshot.status === 'lost'
    )
      return this.snapshot;
    const step = this.snapshot.step;
    if (isMissionTransition(step.phase)) return this.snapshot;
    if (this.status === 'ready' && value) {
      this.status = 'running';
      this.lastTime = now;
    }
    if (step.phase === 'combat' && !this.lockedId && value) {
      const first = graphemes(value)[0];
      this.lockedId = this.targets.find((target) => target.word.startsWith(first))?.id ?? null;
      if (!this.lockedId) {
        this.totalEntries += graphemes(value).length;
        this.emit('mistake');
        return this.snapshot;
      }
      this.emit('lock');
    }
    const expected = graphemes(this.snapshot.prompt);
    const old = graphemes(this.typed);
    const next = graphemes(value).slice(0, expected.length);
    let prefix = 0;
    while (prefix < Math.min(old.length, next.length) && old[prefix] === next[prefix]) prefix++;
    let suffix = 0;
    while (
      suffix < Math.min(old.length, next.length) - prefix &&
      old[old.length - suffix - 1] === next[next.length - suffix - 1]
    )
      suffix++;
    for (let i = prefix; i < next.length - suffix; i++) {
      this.totalEntries++;
      if (next[i] === expected[i]) {
        this.correctEntries++;
        this.emit('correct');
      } else this.emit('mistake');
    }
    this.typed = next.join('');
    if (!this.typed) this.lockedId = null;
    if (expected.length && this.typed === expected.join('')) {
      this.completedCharacters += expected.length;
      if (step.phase === 'combat') {
        const target = this.targets.find((target) => target.id === this.lockedId)!;
        this.lastShot = { slot: target.slot, remaining: target.remaining };
        this.recordImpact(target.kind, target);
        this.targets = this.targets.filter((target) => target.id !== this.lockedId);
        this.disabled++;
        this.typed = '';
        this.lockedId = null;
        this.emit('shot');
        if (!this.targets.length) this.nextWave();
      } else {
        if (step.phase === 'rescue') {
          this.rescued = 1;
          this.emit('rescued');
        }
        this.advance();
      }
    }
    return this.snapshot;
  }
  pause(now: number): MissionSnapshot {
    this.tick(now);
    if (this.status === 'running' || this.status === 'ready') {
      this.beforePause = this.status;
      this.status = 'paused';
    }
    return this.snapshot;
  }
  resume(now: number): MissionSnapshot {
    if (this.status === 'paused') {
      this.status = this.beforePause;
      this.lastTime = now;
    }
    return this.snapshot;
  }
  end(now: number): MissionSnapshot {
    this.tick(now);
    if (['ready', 'running', 'paused'].includes(this.status)) {
      this.status = 'ended';
      this.emit('ended');
    }
    return this.snapshot;
  }
  skipTransition(now: number): MissionSnapshot {
    if (this.status === 'running' && isMissionTransition(this.snapshot.step.phase)) {
      const previousStep = this.index;
      this.tick(now);
      // A click on an expiring sequence must not also skip the following one.
      if (previousStep === this.index && this.snapshot.status === 'running') this.advance();
    }
    return this.snapshot;
  }
  private advance() {
    if (this.index === this.mission.steps.length - 1) {
      this.status = 'won';
      this.emit('won');
      return;
    }
    this.index++;
    this.stepMs = 0;
    this.typed = '';
    this.lockedId = null;
    this.wave = 0;
    if (this.snapshot.step.phase === 'combat') this.spawnWave();
    this.emit('phase');
  }
  private nextWave() {
    this.wave++;
    if (this.wave >= (this.snapshot.step.waves?.length ?? 0)) this.advance();
    else {
      this.spawnWave();
      this.emit('wave');
    }
  }
  private spawnWave() {
    const words = this.encounters.get(this.snapshot.step.id)![this.wave];
    const profile = {
      relaxed: { multiplier: 2.2, grace: 3000, minimum: 5000, ramp: 0.015 },
      standard: { multiplier: 1.25, grace: 1600, minimum: 3200, ramp: 0.025 },
      challenge: { multiplier: 1, grace: 900, minimum: 2400, ramp: 0.035 },
    }[this.difficulty];
    const encounter = this.mission.steps
      .slice(0, this.index)
      .filter((step) => step.phase === 'combat').length;
    const pressure = Math.max(
      this.difficulty === 'challenge' ? 0.78 : 0.86,
      (1 - (encounter + this.wave) * profile.ramp) * this.mission.pressure,
    );
    let characters = 0;
    this.targets = words.map((word, slot) => {
      characters += graphemes(word).length;
      return {
        id: `${this.index}-${this.wave}-${slot}`,
        kind: this.mission.threatPattern[
          (this.wave + slot + encounter) % this.mission.threatPattern.length
        ],
        word,
        slot:
          (words.length === 1 ? 0 : -1 + (slot * 2) / (words.length - 1)) *
          (this.mission.level >= 10 && this.wave % 2 ? -1 : 1),
        remaining: 1,
        elapsedMs: 0,
        warned: false,
        // Later deadlines include earlier words' typing time. Each encounter
        // tightens the margin; Commander asks for bursts above the chosen pace.
        budgetMs: Math.max(
          profile.minimum + slot * 900,
          (((characters * 60_000) / (this.pace * 5)) * profile.multiplier + profile.grace) *
            pressure,
        ),
      };
    });
  }
  private recordImpact(kind: MissionImpact['kind'], target: MissionThreat) {
    this.impacts = [
      ...this.impacts.slice(-7),
      {
        id: ++this.impactId,
        kind,
        source: target.kind,
        healthDamage: kind === 'shield' ? missionDamage[target.kind].health : 0,
        oxygenDamage: kind === 'shield' ? missionDamage[target.kind].oxygen : 0,
        slot: target.slot,
        remaining: target.remaining,
        cameraZ: this.snapshot.step.from,
      },
    ];
  }
  result(id: string, completedAt: string): MissionResult | null {
    if (this.status !== 'won' && this.status !== 'lost' && this.status !== 'ended') return null;
    const snapshot = this.snapshot;
    const won = this.status === 'won';
    return {
      id,
      completedAt,
      missionId: this.mission.missionId,
      contentVersion: this.mission.version,
      difficulty: this.difficulty,
      pace: this.pace,
      outcome: this.status,
      health: this.health,
      oxygen: snapshot.oxygen,
      durationMs: this.mission.durationMs,
      ...(this.failureReason ? { failureReason: this.failureReason } : {}),
      score: Math.round(
        ((this.disabled * 100 + (won ? 1000 + this.health * 3 : 0)) * snapshot.accuracy) / 100,
      ),
      stars: won ? 1 + Number(snapshot.accuracy >= 95) + Number(this.health === 100) : 0,
      accuracy: snapshot.accuracy,
      wpm: snapshot.wpm,
      elapsedMs: Math.round(this.elapsedMs),
      typingMs: Math.round(this.typingMs),
      totalEntries: this.totalEntries,
      correctEntries: this.correctEntries,
      disabled: this.disabled,
      shield: snapshot.shield,
      rescued: won ? this.rescued : 0,
    };
  }
}
