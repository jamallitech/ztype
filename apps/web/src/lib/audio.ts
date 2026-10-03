import type { TypingEvent } from '@ztype/core';

class SoundEngine {
  private context: AudioContext | null = null;
  private output: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Set<AudioScheduledSourceNode>();
  private last = 0;
  private lastWarning = -10;
  private suspension: Promise<void> | null = null;
  private generation = 0;
  async unlock() {
    try {
      this.context ??= new AudioContext({ latencyHint: 'interactive' });
      if (!this.output) {
        this.output = this.context.createDynamicsCompressor();
        this.output.threshold.value = -18;
        this.output.knee.value = 12;
        this.output.ratio.value = 6;
        this.output.attack.value = 0.003;
        this.output.release.value = 0.18;
        this.output.connect(this.context.destination);
      }
      if (this.suspension) await this.suspension;
      if (this.context.state !== 'running' && this.context.state !== 'closed')
        await this.context.resume();
    } catch {
      /* Practice works without audio support. */
    }
  }
  play(event: TypingEvent | 'best', volume: number) {
    if (document.hidden || !this.context || this.context.state !== 'running' || volume <= 0) return;
    const context = this.context;
    const time = context.currentTime;
    if (event === 'correct' && time - this.last < 0.045) return;
    this.last = time;
    const notes =
      event === 'complete'
        ? [440, 554, 659]
        : event === 'best'
          ? [523, 659, 784, 1046]
          : event === 'mistake'
            ? [160]
            : event === 'word'
              ? [660]
              : [420];
    notes.forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = time + i * 0.1;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(
        volume * (event === 'correct' ? 0.07 : 0.14),
        start + 0.005,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      oscillator.connect(gain);
      gain.connect(this.output ?? context.destination);
      this.voices.add(oscillator);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
      oscillator.onended = () => {
        this.voices.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
  playMission(
    event:
      | 'pulse'
      | 'shatter'
      | 'metal'
      | 'incoming'
      | 'shield'
      | 'warning'
      | 'lock'
      | 'launch'
      | 'arrival',
    volume: number,
    pan = 0,
  ) {
    if (this.context && (this.context.state !== 'running' || this.suspension)) {
      const generation = this.generation;
      const requested = performance.now();
      void this.unlock().then(() => {
        if (
          generation === this.generation &&
          this.context?.state === 'running' &&
          performance.now() - requested < 350
        )
          this.playMission(event, volume, pan);
      });
      return;
    }
    if (
      document.hidden ||
      !this.context ||
      this.context.state !== 'running' ||
      !this.output ||
      volume <= 0
    )
      return;
    const ctx = this.context;
    const now = ctx.currentTime;
    if (event === 'warning') {
      if (now - this.lastWarning < 0.8) return;
      this.lastWarning = now;
    }
    const level = Math.max(0, Math.min(1, volume));
    const route = (
      source: AudioScheduledSourceNode,
      duration: number,
      peak: number,
      delay = 0,
      filter?: BiquadFilterNode,
    ) => {
      const envelope = ctx.createGain();
      const stereo = ctx.createStereoPanner();
      stereo.pan.value = Math.max(-0.8, Math.min(0.8, pan));
      const start = now + delay;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(level * peak, start + Math.min(0.018, duration / 4));
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter ?? envelope);
      if (filter) filter.connect(envelope);
      envelope.connect(stereo);
      stereo.connect(this.output!);
      this.voices.add(source);
      source.onended = () => {
        this.voices.delete(source);
        source.disconnect();
        filter?.disconnect();
        envelope.disconnect();
        stereo.disconnect();
      };
      source.start(start);
      source.stop(start + duration + 0.02);
    };
    const tone = (
      from: number,
      to: number,
      duration: number,
      peak: number,
      type: OscillatorType = 'sine',
      delay = 0,
    ) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, now + delay);
      oscillator.frequency.exponentialRampToValueAtTime(to, now + delay + duration);
      route(oscillator, duration, peak, delay);
    };
    const noise = (duration: number, frequency: number, peak: number, delay = 0) => {
      if (!this.noise) {
        this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const channel = this.noise.getChannelData(0);
        for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(frequency, now + delay);
      filter.frequency.exponentialRampToValueAtTime(100, now + delay + duration);
      route(source, duration, peak, delay, filter);
    };
    if (event === 'pulse' || event === 'shatter' || event === 'metal') {
      // Every hit begins with the same tool report, followed by the material.
      // Low punch + crack + delayed tails give weight without increasing the master level.
      tone(880, 85, 0.16, 0.22, 'triangle');
      tone(105, 38, 0.48, 0.34, 'sine', 0.025);
      noise(0.12, 4200, 0.3);
      if (event === 'shatter') {
        noise(0.8, 1500, 0.46, 0.06);
        noise(0.36, 2900, 0.2, 0.18);
        tone(65, 28, 0.85, 0.2, 'sine', 0.08);
      } else if (event === 'metal') {
        noise(0.36, 3600, 0.33, 0.06);
        [730, 1193, 1847].forEach((hz, i) =>
          tone(hz, hz * 0.72, 0.45 + i * 0.12, 0.08, 'triangle', 0.065 + i * 0.018),
        );
        noise(0.65, 850, 0.15, 0.2);
      } else {
        noise(0.65, 2300, 0.38, 0.06);
        tone(140, 42, 0.65, 0.25, 'sine', 0.07);
        tone(1700, 300, 0.28, 0.07, 'sine', 0.1);
        noise(0.32, 1200, 0.12, 0.24);
      }
    } else if (event === 'incoming') {
      // A short low sting marks each reinforcement wave, not a repeating alarm.
      tone(55, 48, 1.1, 0.16);
      tone(82.4, 73.4, 0.85, 0.08, 'triangle');
      noise(0.55, 380, 0.1);
    } else if (event === 'shield') {
      noise(0.85, 1300, 0.48);
      noise(0.25, 3200, 0.22, 0.04);
      tone(95, 30, 0.9, 0.37);
      tone(230, 72, 0.65, 0.12, 'triangle', 0.1);
      tone(390, 155, 0.35, 0.14, 'triangle');
    } else if (event === 'warning') {
      tone(460, 410, 0.14, 0.12, 'sine');
      tone(460, 410, 0.14, 0.1, 'sine', 0.23);
    } else if (event === 'lock') {
      tone(600, 850, 0.09, 0.07, 'sine');
    } else if (event === 'launch') {
      noise(1.9, 1800, 0.4);
      tone(35, 110, 1.7, 0.24, 'triangle');
      tone(52, 155, 1.6, 0.15, 'sine', 0.08);
      noise(0.9, 650, 0.2, 0.7);
    } else {
      [330, 440, 554, 660].forEach((hz, i) => tone(hz, hz, 0.38, 0.14, 'sine', i * 0.14));
    }
  }
  silence() {
    this.generation++;
    // Stop queued bursts too: resuming the context must not replay old impacts.
    this.voices.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
    });
    this.voices.clear();
    if (this.context) {
      const pending = this.context.suspend().catch(() => {});
      this.suspension = pending;
      void pending.then(() => {
        if (this.suspension === pending) this.suspension = null;
      });
    }
  }
}
export const sounds = new SoundEngine();
