import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Snapshot, TypingEvent } from '@ztype/core';

export type SceneSignal = { event: TypingEvent | 'best'; sequence: number };
type Props = {
  snapshot: Snapshot;
  signal: SceneSignal | null;
  hidden: boolean;
  onFailure: () => void;
};

class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Stars({ active, celebration }: { active: boolean; celebration: boolean }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    let seed = 17;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    return new Float32Array(
      Array.from(
        { length: 210 * 3 },
        (_, i) => (random() - 0.5) * (i % 3 === 0 ? 24 : i % 3 === 1 ? 10 : 9),
      ),
    );
  }, []);
  useFrame((_state, delta) => {
    if (points.current && active)
      points.current.rotation.z += Math.min(delta, 0.04) * (celebration ? 0.025 : 0.002);
  });
  return (
    <points ref={points} position={[0, 0, -5]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={celebration ? 0.052 : 0.022}
        color={celebration ? '#f7c39a' : '#c6d5ed'}
        transparent
        opacity={0.65}
        sizeAttenuation
      />
    </points>
  );
}

function Planet({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#d6926d';
    ctx.fillRect(0, 0, 512, 256);
    const colors = ['#dca782', '#e3b691', '#b86a51', '#d58c63', '#9f614b', '#efc6a2'];
    for (let y = 0; y < 256; y += 3) {
      ctx.fillStyle = colors[Math.floor((Math.sin(y * 0.095) + 1) * 2.5)];
      ctx.globalAlpha = 0.25 + Math.sin(y * 0.31) * 0.15;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 4) ctx.lineTo(x, y + Math.sin(x * 0.025 + y * 0.08) * 5);
      ctx.lineTo(512, y + 5);
      ctx.lineTo(0, y + 5);
      ctx.fill();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame((_state, delta) => {
    if (group.current && active) group.current.rotation.y += Math.min(delta, 0.04) * 0.025;
  });
  return (
    <group position={[3.5, 0.55, -1.1]} rotation={[0, 0, -0.32]}>
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[1.57, 64, 48]} />
          <meshStandardMaterial map={texture} roughness={1} />
        </mesh>
      </group>
      <mesh>
        <sphereGeometry args={[1.63, 48, 32]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          vertexShader={`varying vec3 viewNormal; varying vec3 viewPosition;
            void main() {
              vec4 positionInView = modelViewMatrix * vec4(position, 1.0);
              viewNormal = normalize(normalMatrix * normal);
              viewPosition = positionInView.xyz;
              gl_Position = projectionMatrix * positionInView;
            }`}
          fragmentShader={`varying vec3 viewNormal; varying vec3 viewPosition;
            void main() {
              float rim = pow(1.0 - abs(dot(normalize(viewNormal), normalize(-viewPosition))), 3.0);
              gl_FragColor = vec4(0.88, 0.57, 0.40, rim * 0.32);
            }`}
        />
      </mesh>
      <mesh rotation={[1.13, 0.12, 0]}>
        <ringGeometry args={[1.96, 2.52, 100]} />
        <meshBasicMaterial
          color="#d6ac8d"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[1.13, 0.12, 0]}>
        <ringGeometry args={[2.6, 2.63, 100]} />
        <meshBasicMaterial
          color="#e3bb99"
          transparent
          opacity={0.26}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {[2.08, 2.23, 2.43].map((radius) => (
        <mesh key={radius} rotation={[1.13, 0.12, 0]}>
          <ringGeometry args={[radius, radius + 0.025, 100]} />
          <meshBasicMaterial
            color="#f4d3ab"
            transparent
            opacity={0.23}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Ship({ snapshot, signal }: { snapshot: Snapshot; signal: SceneSignal | null }) {
  const group = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const pulse = useRef(0);
  const mistake = useRef(0);
  const wake = useRef(0);
  const { invalidate } = useThree();
  useEffect(() => {
    if (signal?.event === 'word') pulse.current = 1;
    if (signal?.event === 'correct') pulse.current = Math.max(pulse.current, 0.35);
    if (signal?.event === 'mistake') mistake.current = 1;
    invalidate();
  }, [signal, invalidate]);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.04);
    pulse.current = Math.max(0, pulse.current - dt * 1.8);
    mistake.current = Math.max(0, mistake.current - dt * 1.5);
    wake.current += snapshot.status === 'running' ? dt : 0;
    if (group.current) {
      const target = snapshot.status === 'finished' ? 1.8 : -0.4 + snapshot.progress * 0.65;
      group.current.position.x = THREE.MathUtils.damp(group.current.position.x, target, 2, dt);
      group.current.position.y = Math.sin(wake.current * 0.7) * 0.06 - 0.16;
      group.current.rotation.z = -1.14 + Math.sin(wake.current * 0.55) * 0.025;
    }
    if (flame.current) {
      flame.current.scale.y = 1 + pulse.current * 0.75;
      (flame.current.material as THREE.MeshBasicMaterial).color.set(
        mistake.current > 0 ? '#e8969b' : '#94e3d4',
      );
    }
    if (
      snapshot.status === 'finished' &&
      group.current &&
      Math.abs(group.current.position.x - 1.8) > 0.01
    )
      state.invalidate();
  });
  return (
    <group ref={group} position={[-0.4, -0.16, 1.3]} rotation={[0.2, -0.5, -1.14]} scale={1.04}>
      <mesh position={[0, -1.05, 0]} ref={flame} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.17, 0.95, 24]} />
        <meshBasicMaterial color="#94e3d4" transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, -0.97, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.09, 0.57, 16]} />
        <meshBasicMaterial color="#d5fcf1" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, -0.57, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.2, 24]} />
        <meshStandardMaterial color="#758997" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh>
        <capsuleGeometry args={[0.29, 0.9, 12, 24]} />
        <meshStandardMaterial color="#e6e7df" roughness={0.28} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <coneGeometry args={[0.275, 0.52, 24]} />
        <meshStandardMaterial color="#eea576" roughness={0.32} metalness={0.22} />
      </mesh>
      <mesh position={[0, 0.18, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.155, 0.155, 0.07, 24]} />
        <meshStandardMaterial color="#dba47d" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.18, 0.325]}>
        <sphereGeometry args={[0.119, 24, 16]} />
        <meshStandardMaterial
          color="#497e9b"
          metalness={0.65}
          roughness={0.15}
          emissive="#235664"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0, -0.43, 0]}>
        <cylinderGeometry args={[0.291, 0.291, 0.065, 24]} />
        <meshStandardMaterial color="#8ea2ae" metalness={0.7} roughness={0.3} />
      </mesh>
      {[-0.12, 0, 0.12].map((x) => (
        <mesh key={x} position={[x, -0.22, 0.279]}>
          <boxGeometry args={[0.025, 0.12, 0.015]} />
          <meshStandardMaterial color="#718395" roughness={0.45} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.32, -0.38, 0]} rotation={[0, 0, side * -0.5]}>
          <coneGeometry args={[0.18, 0.55, 3]} />
          <meshStandardMaterial color="#e89c70" roughness={0.4} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function PerformanceGuard({ active }: { active: boolean }) {
  const { setDpr } = useThree();
  const frames = useRef({ time: 0, count: 0, downgraded: false });
  useFrame((_state, delta) => {
    if (!active || frames.current.downgraded || delta > 0.2) return;
    frames.current.time += delta;
    frames.current.count++;
    if (frames.current.time > 4) {
      if (frames.current.count / frames.current.time < 40) {
        setDpr(1);
        frames.current.downgraded = true;
      } else frames.current = { time: 0, count: 0, downgraded: false };
    }
  });
  return null;
}

export default function SpaceScene({ snapshot, signal, hidden, onFailure }: Props) {
  const [celebration, setCelebration] = useState(false);
  useEffect(() => {
    if (signal?.event !== 'best') return;
    setCelebration(true);
    const timer = setTimeout(() => setCelebration(false), 1800);
    return () => clearTimeout(timer);
  }, [signal]);
  return (
    <SceneBoundary onFailure={onFailure}>
      <Canvas
        aria-hidden="true"
        tabIndex={-1}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.15, 9], fov: 38 }}
        frameloop={
          hidden ? 'never' : snapshot.status === 'running' || celebration ? 'always' : 'demand'
        }
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        onCreated={({ gl }) => {
          gl.setClearColor('#000000', 0);
        }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[-4, 5, 5]} intensity={3.6} color="#fff0db" />
        <directionalLight position={[3, -2, -3]} intensity={1.2} color="#779bc7" />
        <Stars active={snapshot.status === 'running'} celebration={celebration} />
        <mesh position={[1, -0.1, -2]} rotation={[1.17, 0.18, -0.3]} scale={[1, 0.75, 1]}>
          <ringGeometry args={[4.35, 4.36, 128]} />
          <meshBasicMaterial
            color="#8badbf"
            transparent
            opacity={0.24}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <Planet active={snapshot.status === 'running'} />
        <Ship snapshot={snapshot} signal={signal} />
        <PerformanceGuard active={snapshot.status === 'running'} />
      </Canvas>
    </SceneBoundary>
  );
}
