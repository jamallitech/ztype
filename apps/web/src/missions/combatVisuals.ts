import type { MissionImpact } from '@ztype/core';
import type { Vector3 } from 'three';

export function dronePosition(point: Vector3, slot: number, remaining: number, cameraZ: number) {
  const distance = 2.8 + Math.pow(Math.max(0, remaining), 0.85) * 20;
  return point.set(slot * Math.min(5.2, distance * 0.38), 2.1, cameraZ - distance);
}

export function impactPosition(point: Vector3, impact: MissionImpact) {
  return dronePosition(point, impact.slot, impact.remaining, impact.cameraZ);
}
