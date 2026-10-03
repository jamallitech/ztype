import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  getMission,
  type MissionDefinition,
  type MissionSnapshot,
  type MissionThreat,
} from '@ztype/core';
import type { TargetLabels } from './MissionViewport';
import { dronePosition, impactPosition } from './combatVisuals';
import { MissionEffects } from './MissionEffects';
import { createRegolith } from './lunarSurface';
import { WorldBody, WorldDetails } from './WorldEnvironment';
import { WorldLandmark } from './WorldLandmark';

type Props = { snapshot: MissionSnapshot; labels: TargetLabels; onReady: () => void };
const clampDelta = (delta: number) => Math.max(0, Math.min(delta, 0.05));
const surfaceZ = (snapshot: MissionSnapshot) =>
  THREE.MathUtils.lerp(snapshot.step.from, snapshot.step.to, snapshot.stepProgress);
function Stars() {
  const positions = useMemo(() => {
    let seed = 73;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return new Float32Array(
      Array.from({ length: 450 * 3 }, (_, i) =>
        i % 3 === 0
          ? (random() - 0.5) * 220
          : i % 3 === 1
            ? random() * 90 + 7
            : -random() * 120 - 25,
      ),
    );
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.16} color="#e9e6dd" transparent opacity={0.75} sizeAttenuation />
    </points>
  );
}
function Earth() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#396e9c';
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 3 ? '#91ad9d' : '#c2c2a3';
      ctx.beginPath();
      for (let j = 0; j < 14; j++) {
        const a = (j / 14) * Math.PI * 2;
        const x = ((i * 137) % 512) + Math.cos(a) * (22 + Math.sin(j * 3 + i) * 14);
        const y = 50 + ((i * 61) % 165) + Math.sin(a) * (26 + Math.cos(j + i) * 13);
        if (!j) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#e1eff1';
    ctx.fillRect(0, 0, 512, 15);
    ctx.fillRect(0, 241, 512, 15);
    for (let i = 0; i < 28; i++) {
      ctx.strokeStyle = '#e8f3f255';
      ctx.lineWidth = 4 + (i % 4);
      ctx.beginPath();
      ctx.ellipse((i * 71) % 512, (i * 37) % 256, 30, 7, -0.3, 0, Math.PI);
      ctx.stroke();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[-27, 29, -100]} rotation={[0.2, 0.4, -0.3]}>
      <sphereGeometry args={[13, 40, 32]} />
      <meshStandardMaterial
        map={texture}
        emissive="#244765"
        emissiveIntensity={0.25}
        roughness={0.95}
      />
    </mesh>
  );
}
function Terrain({ mission }: { mission: MissionDefinition }) {
  const world = mission.environment;
  const icy = ['ice', 'plumes', 'frost', 'glacier'].includes(world.style);
  const surface = useMemo(() => createRegolith(world.style), [world.style]);
  useEffect(() => () => surface.dispose(), [surface]);
  const terrain = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(180, 180, 100, 100);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i);
      const path = Math.min(1, Math.max(0, (Math.abs(x) - 5) / 16));
      const landingPad = Math.min(1, Math.max(0, (Math.hypot(x - 5, z - 46) - 6) / 5));
      positions.setY(
        i,
        (world.style === 'canyon'
          ? 12 + Math.sin(z * 0.2) * 3
          : world.style === 'haze' || world.style === 'dunes'
            ? (Math.sin(x * 0.19 + z * 0.08) + 1) * 3
            : Math.sin(x * 0.13 + mission.level * 0.1) * Math.cos(z * 0.15) * (icy ? 2 : 4) +
              Math.sin(z * 0.4 + x * 0.2) * 0.65) *
          path *
          landingPad -
          0.25,
      );
      // Cut channels into the terrain so the molten surface is visible above it.
      if (world.style === 'lava' && Math.abs(Math.abs(x) - 13) < 2.5) positions.setY(i, -0.7);
      if (world.style === 'haze' && Math.abs(x) < 26 && z < 44 && z > -40) positions.setY(i, -0.7);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, [mission]);
  const ridge = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(240, 75, 120, 38);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i);
      const envelope = Math.pow(Math.max(0, Math.sin(((z + 37.5) / 75) * Math.PI)), 1.4);
      const height =
        6 +
        Math.abs(Math.sin(x * 0.047 + mission.level * 0.9 + Math.sin(z * 0.033))) * 15 +
        Math.sin(x * 0.12 + z * 0.07) * 4 +
        Math.sin(x * 0.37) * Math.cos(z * 0.19) * 1.4;
      positions.setY(i, height * envelope - 0.5);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, [mission]);
  useEffect(() => () => ridge.dispose(), [ridge]);
  useEffect(() => () => terrain.dispose(), [terrain]);
  return (
    <group>
      <mesh geometry={terrain} position={[0, 0, -30]} receiveShadow>
        <meshStandardMaterial
          color={world.ground}
          map={surface.map}
          bumpMap={surface.bump}
          bumpScale={0.22}
          roughness={icy ? 0.5 : 0.98}
        />
      </mesh>
      {Array.from({ length: 45 }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const size = 0.35 + ((i * 17) % 10) * 0.13;
        return (
          <mesh
            key={i}
            castShadow
            receiveShadow
            position={[
              side * ((world.style === 'haze' ? 28 : 7) + ((i * 19 + mission.level * 11) % 29)),
              0.12,
              23 - i * 2.1 + Math.sin(mission.level + i) * 2,
            ]}
            scale={[size * 1.4, size * 0.65, size]}
            rotation={[i * 0.4, i, i * 0.2]}
          >
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial
              color={world.rock}
              map={surface.map}
              bumpMap={surface.bump}
              bumpScale={0.1}
              roughness={1}
            />
          </mesh>
        );
      })}
      <mesh geometry={ridge} position={[0, 0, -101]}>
        <meshStandardMaterial color={world.rock} map={surface.map} roughness={1} />
      </mesh>
      {Array.from(
        { length: ['moon', 'io', 'titan', 'titania'].includes(mission.id) ? 14 : 0 },
        (_, i) => (
          <group key={i} position={[(i % 2 ? 1 : -1) * 2.4, 0.08, 12 - i * 2.2]}>
            <mesh>
              <cylinderGeometry args={[0.11, 0.2, 0.15, 6]} />
              <meshStandardMaterial color="#303e4c" />
            </mesh>
            <mesh position={[0, 0.08, 0]}>
              <sphereGeometry args={[0.085, 8, 6]} />
              <meshBasicMaterial color={world.accent} />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}
function Astronaut({ snapshot }: { snapshot: MissionSnapshot }) {
  const group = useRef<THREE.Group>(null);
  const legA = useRef<THREE.Mesh>(null);
  const legB = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_state, delta) => {
    const escorting = snapshot.rescued > 0 && snapshot.stepIndex < 12;
    if (group.current) {
      const z = escorting ? surfaceZ(snapshot) - 4 : -16.7;
      group.current.position.set(escorting ? -1.65 : 0.9, 0.05, z);
    }
    if (snapshot.status === 'running' && snapshot.step.phase === 'walk')
      t.current += clampDelta(delta) * 5;
    if (legA.current) legA.current.rotation.x = escorting ? Math.sin(t.current) * 0.15 : 0;
    if (legB.current) legB.current.rotation.x = escorting ? -Math.sin(t.current) * 0.15 : 0;
  });
  return (
    <group ref={group} visible={snapshot.stepIndex >= 8 && snapshot.stepIndex < 12}>
      <mesh position={[0, 0.95, 0]}>
        <capsuleGeometry args={[0.29, 0.47, 6, 12]} />
        <meshStandardMaterial color="#e5d7c2" roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.59, 0]}>
        <sphereGeometry args={[0.34, 20, 16]} />
        <meshStandardMaterial color="#ebe3d0" roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.59, 0.22]} scale={[1, 0.72, 0.48]}>
        <sphereGeometry args={[0.29, 20, 16]} />
        <meshStandardMaterial
          color="#936d43"
          metalness={0.7}
          roughness={0.2}
          emissive="#3b3121"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[0, 1, -0.29]}>
        <boxGeometry args={[0.52, 0.61, 0.26]} />
        <meshStandardMaterial color="#b2bac1" />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.41, 0.96, 0]} rotation={[0, 0, side * 0.2]}>
            <capsuleGeometry args={[0.1, 0.44, 4, 8]} />
            <meshStandardMaterial color="#d9cfbc" />
          </mesh>
          <mesh ref={side === -1 ? legA : legB} position={[side * 0.17, 0.35, 0]}>
            <capsuleGeometry args={[0.13, 0.45, 4, 8]} />
            <meshStandardMaterial color="#c5c8c4" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.08, 0.29]}>
        <boxGeometry args={[0.24, 0.17, 0.035]} />
        <meshBasicMaterial color="#91ddce" />
      </mesh>
    </group>
  );
}
function Outpost({ snapshot, mission }: { snapshot: MissionSnapshot; mission: MissionDefinition }) {
  const left = useRef<THREE.Mesh>(null),
    right = useRef<THREE.Mesh>(null);
  useFrame((_state, delta) => {
    const open = snapshot.stepIndex >= 8;
    for (const [mesh, side] of [
      [left.current, -1],
      [right.current, 1],
    ] as const)
      if (mesh)
        mesh.position.x = THREE.MathUtils.damp(
          mesh.position.x,
          side * (open ? 1.7 : 0.49),
          3,
          clampDelta(delta),
        );
  });
  return (
    <group>
      {mission.id === 'moon' ? (
        <group position={[0, 0, -20]}>
          {[-3, 3].map((side) => (
            <group key={side}>
              <mesh position={[side, 1.8, 2.6]} castShadow>
                <boxGeometry args={[0.22, 3.8, 0.4]} />
                <meshStandardMaterial color="#394855" metalness={0.7} roughness={0.5} />
              </mesh>
              <mesh position={[side * 0.76, 2.7, 2.64]}>
                <boxGeometry args={[0.7, 0.055, 0.08]} />
                <meshBasicMaterial color="#e7c59b" />
              </mesh>
            </group>
          ))}
          {[-2.5, -2, -1.5, 1.5, 2, 2.5].map((x) => (
            <mesh key={x} position={[x, 0.48, 2.6]} rotation={[0, 0, -0.4]}>
              <boxGeometry args={[0.16, 0.55, 0.04]} />
              <meshStandardMaterial color="#b59e6b" roughness={0.8} />
            </mesh>
          ))}
          <pointLight
            position={[0, 2.6, 4]}
            color="#a1dbe8"
            intensity={9}
            distance={10}
            decay={2}
          />
          <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
            <boxGeometry args={[6.4, 3.6, 5]} />
            <meshStandardMaterial color="#aab1b3" roughness={0.8} metalness={0.15} />
          </mesh>
          <mesh position={[0, 3.8, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[1, 1, 6.5, 4]} />
            <meshStandardMaterial color="#556e80" roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.45, 2.57]}>
            <boxGeometry args={[2.3, 2.9, 0.3]} />
            <meshStandardMaterial color="#233447" />
          </mesh>
          <mesh ref={left} position={[-0.49, 1.4, 2.78]}>
            <boxGeometry args={[0.94, 2.6, 0.2]} />
            <meshStandardMaterial color="#6a8899" metalness={0.45} roughness={0.6} />
          </mesh>
          <mesh ref={right} position={[0.49, 1.4, 2.78]}>
            <boxGeometry args={[0.94, 2.6, 0.2]} />
            <meshStandardMaterial color="#6a8899" metalness={0.45} roughness={0.6} />
          </mesh>
          <mesh position={[0, 2.97, 2.76]}>
            <boxGeometry args={[2.35, 0.08, 0.07]} />
            <meshBasicMaterial color={snapshot.stepIndex >= 8 ? '#a0e5c7' : '#e6a46e'} />
          </mesh>
          {[-2.1, 2.1].map((x) => (
            <group key={x}>
              <mesh position={[x, 1.9, 2.53]}>
                <boxGeometry args={[1.2, 0.85, 0.05]} />
                <meshStandardMaterial
                  color="#315060"
                  emissive="#588675"
                  emissiveIntensity={0.45}
                  metalness={0.4}
                  roughness={0.2}
                />
              </mesh>
              <mesh position={[x, 0.45, 2.6]}>
                <boxGeometry args={[1.4, 0.15, 0.3]} />
                <meshStandardMaterial color="#dfad7e" />
              </mesh>
            </group>
          ))}
          <mesh position={[-4, 1, 0]}>
            <cylinderGeometry args={[1, 1, 2, 12]} />
            <meshStandardMaterial color="#788a96" metalness={0.4} roughness={0.55} />
          </mesh>
          <group position={[3.5, 0, -4]}>
            <mesh position={[0, 3, 0]}>
              <cylinderGeometry args={[0.05, 0.1, 6, 8]} />
              <meshStandardMaterial color="#8fa1af" />
            </mesh>
            <mesh position={[0, 6, 0]} rotation={[0.7, 0, 0.4]}>
              <sphereGeometry args={[0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#a2b4bf" side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      ) : (
        <WorldLandmark mission={mission} />
      )}
      {mission.id === 'moon' && (
        <group position={[-3.8, 0, -1]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.65, 0.85, 0.6, 6]} />
            <meshStandardMaterial color="#536778" />
          </mesh>
          <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.09, 0.12, 3, 8]} />
            <meshStandardMaterial color="#adbac1" />
          </mesh>
          <mesh position={[0, 3.35, 0]}>
            <sphereGeometry args={[0.23, 16, 12]} />
            <meshBasicMaterial color={snapshot.stepIndex > 4 ? '#a6ebcd' : '#e7af7c'} />
          </mesh>
          <mesh position={[0, 3.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.57, 0.045, 8, 32]} />
            <meshStandardMaterial color="#d6bd9d" />
          </mesh>
        </group>
      )}
      <Astronaut snapshot={snapshot} />
    </group>
  );
}
function RocketModel({ ignition = 0 }: { ignition?: number }) {
  return (
    <group>
      <mesh position={[0, 1.65, 0]}>
        <capsuleGeometry args={[0.55, 1.7, 8, 24]} />
        <meshStandardMaterial color="#e2ded1" metalness={0.3} roughness={0.35} />
      </mesh>
      <mesh position={[0, 3, 0]}>
        <coneGeometry args={[0.52, 1.05, 24]} />
        <meshStandardMaterial color="#dea071" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2, 0.53]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.08, 20]} />
        <meshStandardMaterial color="#dcb385" metalness={0.6} roughness={0.25} />
      </mesh>
      <mesh position={[0, 2, 0.59]} scale={[1, 1, 0.25]}>
        <sphereGeometry args={[0.2, 20, 12]} />
        <meshStandardMaterial color="#427d9b" metalness={0.6} roughness={0.2} />
      </mesh>
      {[0, 1, 2].map((n) => (
        <group key={n} rotation={[0, (n * Math.PI * 2) / 3, 0]}>
          <mesh position={[0.54, 0.63, 0]} rotation={[0, 0, -0.4]}>
            <coneGeometry args={[0.31, 1.05, 3]} />
            <meshStandardMaterial color="#d99e72" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.45, 0.55, 0.3, 16]} />
        <meshStandardMaterial color="#4a6170" metalness={0.55} roughness={0.35} />
      </mesh>
      {ignition > 0 && (
        <group scale={[1, 0.5 + ignition, 1]}>
          <mesh position={[0, -0.7, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.3, 1.5, 20]} />
            <meshBasicMaterial color="#a2e2d7" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, -0.38, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.16, 1, 16]} />
            <meshBasicMaterial color="#e0fff2" />
          </mesh>
        </group>
      )}
    </group>
  );
}
function Flight({ snapshot, mission }: { snapshot: MissionSnapshot; mission: MissionDefinition }) {
  const ship = useRef<THREE.Group>(null);
  const p = snapshot.stepProgress;
  const y =
    snapshot.step.phase === 'launch' || snapshot.step.phase === 'departure'
      ? p * 15
      : snapshot.step.phase === 'landing'
        ? (1 - p) * 12
        : Math.min(0.25, Math.max(0, snapshot.correctEntries - 2) * 0.09);
  useFrame((_state, delta) => {
    if (ship.current)
      ship.current.position.y = THREE.MathUtils.damp(
        ship.current.position.y,
        y,
        4,
        clampDelta(delta),
      );
  });
  const surface = snapshot.step.phase === 'landing' || snapshot.step.phase === 'departure';
  return (
    <group>
      {surface ? (
        <>
          {mission.id === 'moon' ? <Earth /> : <WorldBody mission={mission} />}
          <group position={[-5, 0, -16]}>
            <Terrain mission={mission} />
            <WorldDetails mission={mission} snapshot={snapshot} />
            <Outpost snapshot={snapshot} mission={mission} />
          </group>
        </>
      ) : (
        <WorldBody mission={mission} destination />
      )}
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[4.5, 4.7, 0.6, 32]} />
        <meshStandardMaterial color="#334756" metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.3, 3.36, 64]} />
        <meshBasicMaterial color="#81adbd" />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 4, 0, -2]}>
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[0.2, 3, 0.25]} />
            <meshStandardMaterial color="#546a7b" />
          </mesh>
          <mesh position={[0, 3.1, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color="#d7be97" />
          </mesh>
        </group>
      ))}
      <group ref={ship}>
        <RocketModel ignition={snapshot.correctEntries >= 3 ? 1 : 0} />
      </group>
    </group>
  );
}
function Drone({
  target,
  snapshot,
  labels,
}: {
  target: MissionThreat;
  snapshot: MissionSnapshot;
  labels: TargetLabels;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);
  const time = useRef(0);
  const world = getMission(snapshot.missionId)!.environment;
  useFrame((_state, delta) => {
    if (!group.current) return;
    if (snapshot.status === 'running') time.current += clampDelta(delta);
    dronePosition(group.current.position, target.slot, target.remaining, surfaceZ(snapshot));
    group.current.position.y += Math.sin(time.current * 1.4) * 0.1;
    if (target.kind === 'drone') group.current.rotation.z = Math.sin(time.current) * 0.07;
    else group.current.rotation.set(time.current * 0.55, time.current * 0.4, time.current * 0.3);
    point.copy(group.current.position);
    point.y += 1;
    point.project(camera);
    const element = labels.current.get(target.id);
    if (element) {
      const x = Math.max(70, Math.min(size.width - 70, (point.x / 2 + 0.5) * size.width));
      const y = Math.max(
        size.width < 600 ? 220 : 135,
        Math.min(size.height - 240, (-point.y / 2 + 0.5) * size.height),
      );
      const compactOffset =
        size.width < 600 && target.slot === 0 && snapshot.threats.length === 3 ? -85 : 0;
      element.style.transform = `translate3d(${x}px, ${y + compactOffset}px, 0) translate(-50%, -100%)`;
    }
  });
  return (
    <group ref={group} scale={target.kind === 'rock' ? 1.55 : 1.25}>
      {target.kind === 'rock' ? (
        <group scale={[1.1, 0.85, 1]}>
          <mesh castShadow>
            <dodecahedronGeometry args={[0.7, 1]} />
            <meshStandardMaterial color={world.rock} roughness={1} flatShading />
          </mesh>
          <mesh position={[0.35, 0.15, 0.25]} rotation={[0.3, 0.2, 0.6]} castShadow>
            <icosahedronGeometry args={[0.39, 0]} />
            <meshStandardMaterial color={world.ground} roughness={1} />
          </mesh>
          <mesh position={[-0.32, -0.15, 0.42]}>
            <icosahedronGeometry args={[0.25, 0]} />
            <meshStandardMaterial color="#555553" roughness={1} />
          </mesh>
        </group>
      ) : target.kind === 'debris' ? (
        <group rotation={[0.3, 0.2, 0.4]}>
          <mesh castShadow>
            <boxGeometry args={[1.5, 0.9, 0.09]} />
            <meshStandardMaterial color="#314e69" metalness={0.7} roughness={0.45} />
          </mesh>
          {[-0.6, -0.3, 0, 0.3, 0.6].map((x) => (
            <mesh key={x} position={[x, 0, 0.06]}>
              <boxGeometry args={[0.025, 0.85, 0.025]} />
              <meshStandardMaterial color="#829caf" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
          {[-0.46, 0.46].map((y) => (
            <mesh key={y} position={[0.1, y, 0]}>
              <boxGeometry args={[1.85, 0.09, 0.16]} />
              <meshStandardMaterial color="#adaba1" metalness={0.65} roughness={0.5} />
            </mesh>
          ))}
          <mesh position={[0.6, -0.65, 0.05]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.1, 0.6, 0.12]} />
            <meshStandardMaterial color="#a68a68" roughness={0.65} />
          </mesh>
        </group>
      ) : (
        <>
          <mesh>
            <icosahedronGeometry args={[0.48, 1]} />
            <meshStandardMaterial color="#697d8d" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.12, 20]} />
            <meshStandardMaterial color="#b28e6e" metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.49]}>
            <sphereGeometry args={[0.13, 12, 10]} />
            <meshBasicMaterial
              color={
                snapshot.lockedId === target.id
                  ? '#9bf0dc'
                  : target.remaining < 0.28
                    ? '#ff8268'
                    : '#edaf7f'
              }
            />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[side * 0.59, 0.03, 0]} rotation={[0, 0, side * -0.2]}>
                <boxGeometry args={[0.66, 0.12, 0.38]} />
                <meshStandardMaterial color="#586c7e" metalness={0.5} roughness={0.45} />
              </mesh>
              <mesh position={[side * 0.85, 0.04, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.2, 0.045, 8, 20]} />
                <meshStandardMaterial color="#c8ac84" metalness={0.5} roughness={0.4} />
              </mesh>
            </group>
          ))}
        </>
      )}
    </group>
  );
}
function CameraAndTool({ snapshot, flight }: { snapshot: MissionSnapshot; flight: boolean }) {
  const { camera, setDpr } = useThree();
  const tool = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const beamTime = useRef(0);
  const barrel = useRef<THREE.Group>(null);
  const muzzle = useRef<THREE.Mesh>(null);
  const previousShots = useRef(snapshot.disabled);
  const temp = useMemo(
    () => ({
      position: new THREE.Vector3(),
      look: new THREE.Vector3(),
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      middle: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );
  const frames = useRef({ count: 0, seconds: 0, reduced: false });
  useFrame(({ pointer }, delta) => {
    const dt = clampDelta(delta);
    const z = surfaceZ(snapshot);
    if (flight) {
      const lift =
        snapshot.step.phase === 'launch' || snapshot.step.phase === 'departure'
          ? snapshot.stepProgress * 12
          : snapshot.step.phase === 'landing'
            ? (1 - snapshot.stepProgress) * 8
            : 0;
      temp.position.set(8, 5 + lift * 0.75, 13);
      temp.look.set(0, 1.8 + lift, 0);
    } else {
      temp.position.set(0, 1.72, z);
      temp.look.set(pointer.x * 1.2, 1.7 + pointer.y * 0.38, z - 20);
    }
    camera.position.lerp(temp.position, 1 - Math.exp(-dt * 7));
    camera.lookAt(temp.look);
    if (tool.current) {
      tool.current.position.copy(camera.position);
      tool.current.quaternion.copy(camera.quaternion);
      tool.current.visible = !flight;
    }
    if (snapshot.disabled !== previousShots.current) {
      previousShots.current = snapshot.disabled;
      beamTime.current = 0.22;
    }
    if (snapshot.status === 'running') beamTime.current = Math.max(0, beamTime.current - dt);
    if (barrel.current) barrel.current.position.z = -1.6 + beamTime.current * 0.27;
    if (muzzle.current) {
      muzzle.current.visible = !flight && beamTime.current > 0;
      muzzle.current.scale.setScalar(0.6 + beamTime.current * 3);
      (muzzle.current.material as THREE.MeshBasicMaterial).opacity = beamTime.current * 2.3;
    }
    if (beam.current) {
      beam.current.visible = !flight && beamTime.current > 0;
      if (beam.current.visible) {
        muzzle.current?.getWorldPosition(temp.start);
        const shot = [...snapshot.impacts].reverse().find((impact) => impact.kind !== 'shield');
        if (shot) impactPosition(temp.end, shot);
        temp.middle.addVectors(temp.start, temp.end).multiplyScalar(0.5);
        temp.direction.subVectors(temp.end, temp.start);
        beam.current.position.copy(temp.middle);
        beam.current.scale.y = temp.direction.length();
        beam.current.quaternion.setFromUnitVectors(temp.up, temp.direction.normalize());
      }
    }
    if (snapshot.status === 'running' && delta < 0.2 && !frames.current.reduced) {
      frames.current.seconds += delta;
      frames.current.count++;
      if (frames.current.seconds > 4) {
        if (frames.current.count / frames.current.seconds < 40) {
          setDpr(1);
          frames.current.reduced = true;
        } else {
          frames.current.count = 0;
          frames.current.seconds = 0;
        }
      }
    }
  });
  return (
    <>
      <group ref={tool}>
        <group
          ref={barrel}
          position={[0.58, -0.54, -1.6]}
          rotation={[0.035, 0.22, -0.025]}
          scale={0.86}
        >
          <mesh>
            <boxGeometry args={[0.24, 0.22, 0.6]} />
            <meshStandardMaterial color="#748995" metalness={0.55} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.05, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.32, 12]} />
            <meshStandardMaterial color="#abc2c9" metalness={0.7} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.17, 0.15]} rotation={[-0.25, 0, 0]}>
            <boxGeometry args={[0.14, 0.32, 0.16]} />
            <meshStandardMaterial color="#c3c1b1" />
          </mesh>
          <mesh position={[0, 0.12, -0.05]}>
            <boxGeometry args={[0.14, 0.025, 0.22]} />
            <meshBasicMaterial color="#9adbcc" />
          </mesh>
          <mesh position={[0.015, 0.02, 0.25]}>
            <boxGeometry args={[0.27, 0.27, 0.28]} />
            <meshStandardMaterial color="#273746" metalness={0.55} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.06, -0.33]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.22, 8]} />
            <meshStandardMaterial color="#304650" metalness={0.7} roughness={0.4} />
          </mesh>
          {[-0.22, -0.12, -0.02, 0.08].map((z) => (
            <mesh key={z} position={[0.13, 0.05, z]}>
              <boxGeometry args={[0.02, 0.12, 0.035]} />
              <meshStandardMaterial color="#182734" metalness={0.7} roughness={0.35} />
            </mesh>
          ))}
          <mesh position={[0, 0.23, -0.08]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.055, 0.014, 6, 12]} />
            <meshStandardMaterial color="#b5bbaf" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0.035, -0.24, 0.23]} rotation={[0.3, 0, -0.1]}>
            <capsuleGeometry args={[0.12, 0.16, 4, 8]} />
            <meshStandardMaterial color="#747b7d" roughness={0.95} />
          </mesh>
          <mesh position={[0.04, -0.35, 0.4]} rotation={[-0.5, 0, -0.1]}>
            <capsuleGeometry args={[0.13, 0.38, 4, 8]} />
            <meshStandardMaterial color="#a29d8d" roughness={0.9} />
          </mesh>
          <mesh ref={muzzle} position={[0, 0.05, -0.6]} visible={false}>
            <sphereGeometry args={[0.1, 12, 8]} />
            <meshBasicMaterial color="#a3f3e4" transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      </group>
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.012, 0.018, 1, 8]} />
        <meshBasicMaterial color="#a3eddd" transparent opacity={0.65} depthWrite={false} />
      </mesh>
    </>
  );
}

export default function MissionScene({ snapshot, labels, onReady }: Props) {
  const mission = getMission(snapshot.missionId)!;
  const world = mission.environment;
  const flight = ['prime', 'launch', 'landing', 'departure'].includes(snapshot.step.phase);
  return (
    <Canvas
      aria-hidden="true"
      tabIndex={-1}
      camera={{ position: [8, 5, 13], fov: 60, near: 0.1, far: 240 }}
      dpr={[1, 1.5]}
      shadows="soft"
      frameloop={snapshot.status === 'running' ? 'always' : 'demand'}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.setClearColor(world.sky);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        onReady();
      }}
    >
      <fog
        attach="fog"
        args={[world.fog, world.style === 'haze' ? 24 : 45, world.style === 'haze' ? 85 : 160]}
      />
      <hemisphereLight args={['#99bad6', '#37313a', 0.65]} />
      <directionalLight
        castShadow
        position={[-18, 24, 12]}
        intensity={3.2}
        color={world.sun}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-camera-far={110}
        shadow-normalBias={0.06}
      />
      <directionalLight position={[14, 8, -30]} intensity={1.3} color="#7cadd8" />
      <Stars />
      {flight ? (
        <Flight snapshot={snapshot} mission={mission} />
      ) : (
        <>
          {mission.id === 'moon' ? <Earth /> : <WorldBody mission={mission} />}
          <Terrain mission={mission} />
          <WorldDetails mission={mission} snapshot={snapshot} />
          <Outpost snapshot={snapshot} mission={mission} />
          <group position={[5, 0, 16]}>
            <RocketModel />
          </group>
        </>
      )}
      {snapshot.threats.map((target) => (
        <Drone key={target.id} target={target} snapshot={snapshot} labels={labels} />
      ))}
      <CameraAndTool snapshot={snapshot} flight={flight} />
      <MissionEffects snapshot={snapshot} />
    </Canvas>
  );
}
