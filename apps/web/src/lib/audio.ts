import type { TypingEvent } from '@ztype/core';

class SoundEngine {
  private context: AudioContext | null = null;
  private last = 0;
  async unlock() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      /* Practice works without audio support. */
    }
  }
  play(event: TypingEvent | 'best', volume: number) {
    if (document.hidden || !this.context || this.context.state !== 'running') return;
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
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
  silence() {
    void this.context?.suspend();
  }
}
export const sounds = new SoundEngine();
