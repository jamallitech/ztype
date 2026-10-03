import { describe, it, expect } from 'vitest';
import {
  campaignProgress,
  campaignFrontier,
  getMission,
  isMissionUnlocked,
  missionDestinations,
  missionWaveCount,
  type CampaignProgress,
} from './campaign';
import { MissionEngine, isMissionTransition, type MissionResult } from './mission';

function complete(id: string, pace = 30, seed = 42): MissionResult {
  const engine = new MissionEngine('standard', pace, seed, id);
  let now = 0;
  let actions = 0;
  const used = new Set<string>();
  while (!['won', 'lost'].includes(engine.snapshot.status) && actions++ < 150) {
    const state = engine.snapshot;
    if (isMissionTransition(state.step.phase)) engine.skipTransition((now += 1));
    else {
      const word = state.prompt || state.threats[0].word;
      if (state.step.phase === 'combat') {
        expect(used.has(word)).toBe(false);
        used.add(word);
        expect(new Set(state.threats.map((t) => t.word[0])).size).toBe(state.threats.length);
        expect(state.threats.length).toBeLessThanOrEqual(3);
      }
      now += (word.length * 60_000) / (pace * 5);
      engine.applyInput(word, now);
    }
    expect(engine.snapshot.health).toBe(100);
  }
  expect(engine.snapshot.status).toBe('won');
  const result = engine.result(`run-${id}-${seed}`, '2026-09-30T12:00:00Z')!;
  expect(result.missionId).toBe(getMission(id)!.missionId);
  expect(result.disabled).toBe(used.size);
  expect(result.stars).toBe(3);
  return result;
}

describe('12-destination campaign', () => {
  it.each(missionDestinations.map((m) => [m.id]))(
    'completes %s with unique words and fair Pilot deadlines',
    (id) => {
      for (const pace of [30, 45, 80]) complete(id, pace);
    },
  );
  it('uses terrain-based rescue windows between two and five minutes', () => {
    expect(missionDestinations).toHaveLength(12);
    expect(new Set(missionDestinations.map((m) => m.missionId)).size).toBe(12);
    expect(new Set(missionDestinations.map((m) => m.title)).size).toBe(12);
    expect(new Set(missionDestinations.map((m) => m.steps[7].prompt)).size).toBe(12);
    expect(missionWaveCount(missionDestinations[0])).toBe(27);
    expect(missionWaveCount(missionDestinations[11])).toBe(6);
    expect(getMission('moon')!.durationMs).toBe(300_000);
    expect(getMission('io')!.durationMs).toBe(120_000);
    expect(getMission('callisto')!.durationMs).toBeGreaterThan(getMission('ceres')!.durationMs);
    for (const mission of missionDestinations) {
      expect(mission.durationMs).toBeGreaterThanOrEqual(120_000);
      expect(mission.durationMs).toBeLessThanOrEqual(300_000);
      expect(
        mission.steps.slice(1, 4).reduce((sum, step) => sum + (step.durationMs ?? 0), 0),
      ).toBeLessThan(2500);
    }
    expect(() => new MissionEngine('standard', 30, 42, 'unknown')).toThrow('Unknown mission');
  });
  it('unlocks exactly the next level after each win, on any difficulty, with one star', () => {
    let progress: CampaignProgress = {};
    for (const mission of missionDestinations) {
      expect(campaignFrontier(progress)).toBe(mission.level - 1);
      expect(isMissionUnlocked(mission.id, progress)).toBe(true);
      const next = missionDestinations[mission.level];
      if (next) expect(isMissionUnlocked(next.id, progress)).toBe(false);
      const win = { ...complete(mission.id), difficulty: 'relaxed' as const, stars: 1 };
      progress = campaignProgress([win], progress);
      if (next) expect(isMissionUnlocked(next.id, progress)).toBe(true);
    }
    expect(Object.keys(progress)).toHaveLength(12);
    expect(campaignFrontier(progress)).toBe(11);
  });
  it('preserves old Moon wins, best stars and unlocks after the recent log is pruned', () => {
    const moon = { ...complete('moon'), contentVersion: 1 };
    const original = campaignProgress([moon]);
    const lower = { ...moon, id: 'replay', stars: 1 };
    const retained = campaignProgress([lower], original);
    expect(retained[moon.missionId].stars).toBe(3);
    expect(isMissionUnlocked('mars', campaignProgress([], retained))).toBe(true);
    const failed = { ...moon, outcome: 'lost' as const, stars: 0 };
    expect(isMissionUnlocked('mars', campaignProgress([failed]))).toBe(false);
    expect(isMissionUnlocked('mars', campaignProgress([failed], retained))).toBe(true);
    expect(isMissionUnlocked('unknown', retained)).toBe(false);
  });
  it('does not infer earlier wins or share progress between player records', () => {
    const later = campaignProgress([complete('europa')]);
    expect(campaignFrontier(later)).toBe(0);
    expect(isMissionUnlocked('europa', later)).toBe(false);
    const guest = campaignProgress([complete('moon')]);
    const account = campaignProgress([]);
    expect(isMissionUnlocked('mars', guest)).toBe(true);
    expect(isMissionUnlocked('mars', account)).toBe(false);
  });
});
