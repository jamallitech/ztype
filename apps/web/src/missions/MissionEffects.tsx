import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MissionImpact, MissionSnapshot } from '@ztype/core';
import { impactPosition } from './combatVisuals';

const POOL = 8;
const SHARDS = 22;
const LIFE = 1.4;

/** Fixed particle pool; effects keep their world position when the camera moves. */
export function MissionEffects({ snapshot }: { snapshot: MissionSnapshot }) {
  const debris = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const cores = useRef<(THREE.Mesh | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const clouds = useRef<(THREE.Mesh | null)[]>([]);
  const latest = useRef(snapshot.impacts.at(-1)?.id ?? 0);
  const cursor = useRef(0);
  const bursts = useMemo(
    () =>
      Array.from({ length: POOL }, () => ({
        age: LIFE,
        origin: new THREE.Vector3(),
        kind: 'drone' as MissionImpact['kind'],
      })),
    [],
  );
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const directions = useMemo(
    () =>
      Array.from({ length: SHARDS }, (_, i) => {
        const y = 1 - (i / (SHARDS - 1)) * 2;
        const angle = i * 2.399963;
        const radius = Math.sqrt(1 - y * y);
        return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      }),
    [],
  );
  useEffect(() => {
    if (!debris.current) return;
    for (let i = 0; i < POOL * SHARDS; i++) {
      debris.current.setColorAt(i, new THREE.Color(i % 3 ? '#e8b784' : '#8ce7e1'));
      scratch.scale.setScalar(0);
      scratch.updateMatrix();
      debris.current.setMatrixAt(i, scratch.matrix);
    }
    debris.current.instanceMatrix.needsUpdate = true;
  }, [scratch]);
  useFrame(({ invalidate }, delta) => {
    for (const impact of snapshot.impacts) {
      if (impact.id <= latest.current) continue;
      latest.current = impact.id;
      const burst = bursts[cursor.current++ % POOL];
      impactPosition(burst.origin, impact);
      burst.age = 0;
      burst.kind = impact.kind;
      if (debris.current) {
        for (let p = 0; p < SHARDS; p++) {
          const color =
            impact.kind === 'rock'
              ? p % 3
                ? '#9e8d74'
                : '#d5b995'
              : impact.kind === 'debris'
                ? p % 3
                  ? '#dbe7ed'
                  : '#efb876'
                : p % 3
                  ? '#e8b784'
                  : '#8ce7e1';
          debris.current.setColorAt(
            ((cursor.current - 1) % POOL) * SHARDS + p,
            new THREE.Color(color),
          );
        }
        if (debris.current.instanceColor) debris.current.instanceColor.needsUpdate = true;
      }
    }
    const dt = snapshot.status === 'paused' ? 0 : Math.min(delta, 0.05);
    let active = false;
    let illumination = 0;
    for (let b = 0; b < POOL; b++) {
      const burst = bursts[b];
      burst.age = Math.min(LIFE, burst.age + dt);
      const alive = burst.age < LIFE;
      active ||= alive;
      const t = burst.age / LIFE;
      const ring = rings.current[b];
      const core = cores.current[b];
      if (ring && core) {
        ring.visible = core.visible = alive;
        ring.position.copy(burst.origin);
        core.position.copy(burst.origin);
        ring.scale.setScalar(0.2 + t * (burst.kind === 'shield' ? 3.2 : 2.6));
        core.scale.setScalar(Math.max(0.001, (1 - t) * 0.6));
        const ringMaterial = ring.material as THREE.MeshBasicMaterial;
        const coreMaterial = core.material as THREE.MeshBasicMaterial;
        ringMaterial.opacity = (1 - t) * 0.52;
        coreMaterial.opacity = Math.pow(1 - t, 3) * 0.72;
        ringMaterial.color.set(
          burst.kind === 'shield' || burst.kind === 'rock' ? '#dcab79' : '#9aeade',
        );
      }
      const cloud = clouds.current[b];
      if (cloud) {
        cloud.visible = alive;
        cloud.position.copy(burst.origin);
        cloud.position.y += t * 0.4;
        cloud.scale.setScalar(0.3 + t * (burst.kind === 'rock' ? 2.6 : 1.8));
        const material = cloud.material as THREE.MeshStandardMaterial;
        material.opacity = Math.sin(t * Math.PI) * (burst.kind === 'rock' ? 0.24 : 0.13);
        material.color.set(burst.kind === 'rock' ? '#96866f' : '#66727a');
      }
      const strength = alive ? Math.pow(1 - t, 3) * 4 : 0;
      if (strength > illumination && light.current) {
        illumination = strength;
        light.current.position.copy(burst.origin);
      }
      for (let p = 0; p < SHARDS; p++) {
        scratch.position
          .copy(burst.origin)
          .addScaledVector(directions[p], burst.age * (1.9 + (p % 4) * 0.55));
        scratch.position.y -= burst.age * burst.age * 1.1;
        scratch.rotation.set(t * (p + 2), t * p, t * 3);
        const size = alive ? (0.035 + (p % 3) * 0.02) * Math.pow(1 - t, 0.7) : 0;
        scratch.scale.set(
          size * (burst.kind === 'rock' ? 2.8 : 1),
          size,
          size * (burst.kind === 'debris' ? 4 : 1),
        );
        scratch.updateMatrix();
        debris.current?.setMatrixAt(b * SHARDS + p, scratch.matrix);
      }
    }
    if (debris.current) debris.current.instanceMatrix.needsUpdate = true;
    if (light.current) light.current.intensity = illumination;
    // Allow the final hit to dissipate after defeat without an endless render loop.
    if (active && snapshot.status !== 'paused') invalidate();
  });
  return (
    <group>
      <instancedMesh
        ref={debris}
        args={[undefined, undefined, POOL * SHARDS]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {bursts.map((_, i) => (
        <group key={i}>
          <mesh
            ref={(node) => {
              clouds.current[i] = node;
            }}
            visible={false}
          >
            <icosahedronGeometry args={[1, 2]} />
            <meshStandardMaterial transparent opacity={0} depthWrite={false} roughness={1} />
          </mesh>
          <mesh
            ref={(node) => {
              rings.current[i] = node;
            }}
            visible={false}
          >
            <torusGeometry args={[1, 0.035, 6, 40]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh
            ref={(node) => {
              cores.current[i] = node;
            }}
            visible={false}
          >
            <sphereGeometry args={[1, 12, 8]} />
            <meshBasicMaterial
              color="#f2d2a2"
              transparent
              opacity={0}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      <pointLight ref={light} color="#a9f0e6" intensity={0} distance={9} decay={2} />
    </group>
  );
}
