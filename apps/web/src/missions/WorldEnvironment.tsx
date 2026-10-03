import { useMemo, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MissionDefinition, MissionSnapshot } from '@ztype/core';

type WorldProps = { mission: MissionDefinition; snapshot: MissionSnapshot };

export function WorldBody({
  mission,
  destination = false,
}: {
  mission: MissionDefinition;
  destination?: boolean;
}) {
  const parent = mission.environment.parent;
  const palette = {
    earth: ['#346483', '#9fbbaa'],
    jupiter: ['#c4a185', '#876047'],
    saturn: ['#c3b582', '#927b56'],
    uranus: ['#94d2d8', '#73b4c8'],
    neptune: ['#3865bc', '#7492d1'],
    sun: ['#ffe0ae', '#ffce88'],
    charon: ['#b4a4a1', '#7d727a'],
  }[parent];
  const map = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = destination ? mission.environment.ground : palette[0];
    ctx.fillRect(0, 0, 512, 256);
    if (!destination && ['jupiter', 'saturn', 'uranus', 'neptune'].includes(parent)) {
      for (let i = 0; i < 28; i++) {
        ctx.fillStyle = i % 3 ? palette[1] : '#eee3cc';
        ctx.globalAlpha = i % 3 ? 0.3 : 0.16;
        ctx.beginPath();
        for (let x = 0; x <= 512; x += 8) ctx.lineTo(x, i * 10 + Math.sin(x * 0.04 + i) * 4);
        ctx.lineTo(512, i * 10 + 6);
        ctx.lineTo(0, i * 10 + 6);
        ctx.fill();
      }
      if (parent === 'jupiter') {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#a76647';
        ctx.beginPath();
        ctx.ellipse(330, 164, 33, 13, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.globalAlpha = 0.24;
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = i % 2 ? (destination ? mission.environment.rock : palette[1]) : '#dfdde0';
        ctx.beginPath();
        ctx.ellipse(
          (i * 137.3) % 512,
          (i * 71.7) % 256,
          3 + (i % 16),
          3 + (i % 11),
          i * 0.3,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [mission, destination]);
  useEffect(() => () => map.dispose(), [map]);
  if (!destination && parent === 'sun') return null;
  const radius = destination ? 10 : parent === 'jupiter' ? 19 : parent === 'saturn' ? 14 : 12;
  return (
    <group position={destination ? [8, 7, -30] : [-28, 29, -100]} rotation={[0.2, 0.3, -0.2]}>
      <mesh>
        <sphereGeometry args={[radius, 40, 28]} />
        <meshStandardMaterial
          map={map}
          roughness={0.95}
          emissive={destination ? mission.environment.ground : palette[0]}
          emissiveIntensity={0.15}
        />
      </mesh>
      {!destination && parent === 'saturn' && (
        <mesh rotation={[-1.1, 0.2, 0]}>
          <ringGeometry args={[19, 29, 80]} />
          <meshStandardMaterial
            color="#d4c6a2"
            side={THREE.DoubleSide}
            transparent
            opacity={0.6}
            roughness={1}
          />
        </mesh>
      )}
    </group>
  );
}

function Rover({ snapshot }: { snapshot: MissionSnapshot }) {
  const rover = useRef<THREE.Group>(null);
  useFrame(() => {
    if (rover.current && snapshot.rescued && snapshot.step.phase === 'walk')
      rover.current.position.z = THREE.MathUtils.lerp(-15, 4, snapshot.stepProgress);
  });
  return (
    <group ref={rover} position={[-4.4, 0.5, -15]}>
      <mesh castShadow position={[0, 0.65, 0]}>
        <boxGeometry args={[1.8, 1, 2.8]} />
        <meshStandardMaterial color="#c8b395" metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.15, -0.5]}>
        <boxGeometry args={[1.45, 0.5, 1]} />
        <meshStandardMaterial color="#304f67" metalness={0.6} roughness={0.25} />
      </mesh>
      {[-1, 1].flatMap((side) =>
        [-0.9, 0.9].map((z) => (
          <mesh
            key={`${side}-${z}`}
            position={[side * 1, 0, z]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.48, 0.48, 0.3, 12]} />
            <meshStandardMaterial color="#252d35" roughness={1} />
          </mesh>
        )),
      )}
      <mesh position={[0.6, 2, 0.6]}>
        <cylinderGeometry args={[0.025, 0.025, 1.8, 6]} />
        <meshStandardMaterial color="#bac5c9" />
      </mesh>
      <mesh position={[0.6, 2.95, 0.6]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial color="#ffd39e" />
      </mesh>
    </group>
  );
}

function IcePlumes({ snapshot, color }: { snapshot: MissionSnapshot; color: string }) {
  const points = useRef<THREE.Points>(null);
  const elapsed = useRef(0);
  const positions = useMemo(() => new Float32Array(180 * 3), []);
  useFrame((_state, delta) => {
    if (snapshot.status === 'running') elapsed.current += Math.min(delta, 0.05);
    if (!points.current) return;
    for (let i = 0; i < 180; i++) {
      const age = (elapsed.current * 0.23 + i * 0.618) % 1;
      const side = i % 2 ? 1 : -1;
      positions[i * 3] = side * (11 + Math.sin(i * 2.4) * age * 4);
      positions[i * 3 + 1] = 0.2 + age * 13;
      positions[i * 3 + 2] = -14 + Math.cos(i * 3.1) * age * 3;
    }
    points.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.24} transparent opacity={0.42} depthWrite={false} />
    </points>
  );
}

export function WorldDetails({ mission, snapshot }: WorldProps) {
  const { style, accent, rock } = mission.environment;
  const icy = ['ice', 'plumes', 'frost', 'glacier'].includes(style);
  return (
    <group>
      {mission.id === 'mars' && <Rover snapshot={snapshot} />}
      {style === 'mining' &&
        [-9, 9].map((x) => (
          <group key={x} position={[x, 0, -11]}>
            <mesh position={[0, 2.6, 0]} castShadow>
              <boxGeometry args={[0.45, 5.2, 0.45]} />
              <meshStandardMaterial color="#7c817d" metalness={0.65} roughness={0.6} />
            </mesh>
            <mesh position={[1.5, 4.9, 0]} castShadow>
              <boxGeometry args={[4, 0.38, 0.45]} />
              <meshStandardMaterial color="#b9a069" metalness={0.5} />
            </mesh>
            <mesh position={[3, 2.9, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 3.8, 6]} />
              <meshStandardMaterial color="#6d7f90" />
            </mesh>
            <mesh position={[2.4, 0.6, 0]} castShadow>
              <boxGeometry args={[2.4, 1.2, 1.8]} />
              <meshStandardMaterial color="#83796a" roughness={0.9} />
            </mesh>
          </group>
        ))}
      {(style === 'ridges' || mission.id === 'callisto') &&
        [-10, 10, 16].map((x, i) => (
          <group key={x} position={[x, 0, -12 - i * 9]}>
            <mesh position={[0, 3.5, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.42, 7, 8]} />
              <meshStandardMaterial color="#677b90" metalness={0.65} />
            </mesh>
            <mesh position={[0, 6, 0]} rotation={[0.5, i, 0.4]}>
              <sphereGeometry args={[1.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial
                color="#aebcca"
                side={THREE.DoubleSide}
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>
            <mesh position={[0, 7.1, 0]}>
              <sphereGeometry args={[0.12, 8, 6]} />
              <meshBasicMaterial color={accent} />
            </mesh>
          </group>
        ))}
      {icy &&
        Array.from({ length: 14 }, (_, i) => (
          <mesh
            key={i}
            position={[(i % 2 ? 1 : -1) * (6 + ((i * 7) % 15)), 0.6, 13 - i * 3.4]}
            scale={[0.6 + (i % 3) * 0.2, 1 + (i % 4) * 0.8, 0.7]}
            rotation={[0.1, i, 0.1]}
            castShadow
          >
            <coneGeometry args={[0.65, 2.2, 5]} />
            <meshStandardMaterial
              color={accent}
              metalness={0.2}
              roughness={0.3}
              transparent
              opacity={0.88}
            />
          </mesh>
        ))}
      {(style === 'plumes' || style === 'frost') && (
        <IcePlumes snapshot={snapshot} color={style === 'frost' ? '#657992' : '#d8f5ff'} />
      )}
      {style === 'lava' && (
        <>
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[side * 13, -0.12, -6]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[2.5, 58]} />
                <meshStandardMaterial
                  color="#b84623"
                  emissive="#ee712b"
                  emissiveIntensity={1.1}
                  roughness={0.8}
                />
              </mesh>
              <mesh position={[side * 24, 3, -37]}>
                <cylinderGeometry args={[1.3, 8, 7, 22]} />
                <meshStandardMaterial color={rock} roughness={1} />
              </mesh>
              <mesh position={[side * 24, 6.55, -37]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[1.3, 24]} />
                <meshBasicMaterial color="#fda14e" />
              </mesh>
              <pointLight
                position={[side * 12, 1, -10]}
                color="#ff864c"
                intensity={12}
                distance={15}
                decay={2}
              />
            </group>
          ))}
        </>
      )}
      {style === 'haze' &&
        [-16, 18].map((x) => (
          <mesh
            key={x}
            position={[x, -0.1, -4]}
            rotation={[-Math.PI / 2, 0, x]}
            scale={[1, 2.4, 1]}
          >
            <circleGeometry args={[5, 40]} />
            <meshStandardMaterial color="#252823" metalness={0.65} roughness={0.14} />
          </mesh>
        ))}
      {style === 'canyon' &&
        [-7, 7].map((x) => (
          <group key={x} position={[x, 0, -11]}>
            <mesh position={[0, 2.3, 0]} castShadow>
              <boxGeometry args={[0.3, 4.6, 0.4]} />
              <meshStandardMaterial color="#5b6576" metalness={0.6} />
            </mesh>
            <mesh position={[0, 4.7, 0]}>
              <sphereGeometry args={[0.12, 8, 6]} />
              <meshBasicMaterial color={accent} />
            </mesh>
          </group>
        ))}
    </group>
  );
}
