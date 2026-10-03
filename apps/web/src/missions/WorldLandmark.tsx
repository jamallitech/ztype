import type { MissionDefinition } from '@ztype/core';
import * as THREE from 'three';

type Vector = [number, number, number];
function Block({
  at,
  size,
  color = '#586b79',
  rotation = [0, 0, 0],
  glow = false,
}: {
  at: Vector;
  size: Vector;
  color?: string;
  rotation?: Vector;
  glow?: boolean;
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.65}
        metalness={0.35}
        emissive={color}
        emissiveIntensity={glow ? 1.4 : 0}
      />
    </mesh>
  );
}
function Ring({
  at,
  radius,
  color,
  rotation = [0, 0, 0],
}: {
  at: Vector;
  radius: number;
  color: string;
  rotation?: Vector;
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow>
      <torusGeometry args={[radius, 0.22, 8, 40]} />
      <meshStandardMaterial color={color} metalness={0.55} roughness={0.45} />
    </mesh>
  );
}
function Dome({ at, size, color }: { at: Vector; size: Vector; color: string }) {
  return (
    <mesh position={at} scale={size} castShadow receiveShadow>
      <sphereGeometry args={[1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial
        color={color}
        side={THREE.DoubleSide}
        metalness={0.35}
        roughness={0.5}
      />
    </mesh>
  );
}
function Dish({ at, size = 1, color }: { at: Vector; size?: number; color: string }) {
  return (
    <group position={at} scale={size}>
      <Block at={[0, 2.5, 0]} size={[0.5, 5, 0.6]} />
      <group position={[0, 5, 0]} rotation={[0.8, 0.3, 0]}>
        <mesh rotation={[Math.PI, 0, 0]} castShadow>
          <sphereGeometry args={[2.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={color}
            side={THREE.DoubleSide}
            metalness={0.7}
            roughness={0.45}
          />
        </mesh>
        <Block at={[0, 0.6, 0]} size={[0.15, 2, 0.15]} color={color} />
      </group>
    </group>
  );
}
function Gantry({
  z,
  width,
  height,
  color,
}: {
  z: number;
  width: number;
  height: number;
  color: string;
}) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <Block
          key={side}
          at={[(side * width) / 2, height / 2, z]}
          size={[0.5, height, 0.65]}
          color={color}
        />
      ))}
      <Block at={[0, height, z]} size={[width + 0.5, 0.65, 0.65]} color={color} />
    </group>
  );
}

/** Each destination has a different silhouette, route enclosure and rescue landmark. */
export function WorldLandmark({ mission }: { mission: MissionDefinition }) {
  const { accent, rock } = mission.environment;
  return (
    <group position={[0, 0, -22]}>
      {mission.id === 'mars' && (
        <>
          {/* A broken transport lies across a dune, with its detached wing in the foreground. */}
          <group position={[5, 1.6, 0]} rotation={[0.12, -0.45, -0.28]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[1.9, 2.6, 14, 12, 1, true]} />
              <meshStandardMaterial
                color="#b4a08d"
                side={THREE.DoubleSide}
                roughness={0.8}
                metalness={0.4}
              />
            </mesh>
            <Block at={[0, -0.6, 0]} size={[14, 0.3, 4]} color="#7c5b48" />
            <Ring at={[0, 0, 7]} radius={1.9} color={accent} />
          </group>
          <Block
            at={[-7, 0.5, 9]}
            size={[7, 0.25, 3]}
            rotation={[0.1, 0.5, -0.12]}
            color="#94735a"
          />
          <Block at={[-2, 0.8, 1]} size={[2.5, 1.6, 3]} color="#ba7750" />
        </>
      )}
      {mission.id === 'ceres' && (
        <>
          {/* Open excavation, overhead crane and a massive drill at the pit edge. */}
          {[0, -8, -16].map((z) => (
            <Gantry key={z} z={z} width={15} height={9} color="#c09b54" />
          ))}
          <Block at={[-7.5, 9, -8]} size={[0.6, 0.6, 21]} color="#c09b54" />
          <Block at={[7.5, 9, -8]} size={[0.6, 0.6, 21]} color="#c09b54" />
          <mesh position={[5, 4, -3]} castShadow>
            <cylinderGeometry args={[1.2, 0.15, 8, 10]} />
            <meshStandardMaterial color="#64747b" metalness={0.85} roughness={0.5} />
          </mesh>
          {[1, 3, 5, 7].map((y) => (
            <Ring
              key={y}
              at={[5, y, -3]}
              radius={0.5 + y * 0.1}
              color="#c4a667"
              rotation={[Math.PI / 2, 0, 0]}
            />
          ))}
          <Block at={[-5, 1.1, 5]} size={[4, 2.2, 3]} color="#8c7d54" />
        </>
      )}
      {mission.id === 'callisto' && (
        <>
          {/* A circular impact basin and a broken ring-shaped survey station. */}
          {[6, 10, 15].map((radius) => (
            <Ring
              key={radius}
              at={[0, 0.05, -3]}
              radius={radius}
              color={rock}
              rotation={[Math.PI / 2, 0, 0]}
            />
          ))}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 7, 0, -4]}>
              <Dome at={[0, 0, 0]} size={[3.5, 2.6, 5]} color="#9d9e96" />
              <Block at={[0, 2.4, 1]} size={[2, 0.1, 2]} color={accent} glow />
            </group>
          ))}
          <Ring at={[0, 3.5, -8]} radius={4} color="#b4ada0" rotation={[0, 0.25, 0]} />
          <Dish at={[-12, 0, 7]} color={accent} size={0.7} />
        </>
      )}
      {mission.id === 'ganymede' && (
        <>
          {/* A relay forest, solar sails and a tall central receiver. */}
          {[-10, 9, -6, 13].map((x, i) => (
            <group key={x} position={[x, 0, -i * 6]}>
              <Block at={[0, 6, 0]} size={[0.6, 12, 0.6]} />
              <Block
                at={[0, 8, 0]}
                size={[5, 6, 0.2]}
                color="#284960"
                rotation={[0, i * 0.3, 0.2]}
              />
              <Block at={[0, 12.2, 0]} size={[0.7, 0.15, 0.7]} color={accent} glow />
            </group>
          ))}
          <Dish at={[0, 0, -15]} size={2.2} color="#b6cbd8" />
          <Block at={[-4, 1.4, 6]} size={[4, 2.8, 5]} color="#526e87" />
        </>
      )}
      {mission.id === 'europa' && (
        <>
          {/* Sheltered ice vault with a pressure tunnel disappearing into the glacier. */}
          {[5, 0, -5, -10].map((z, i) => (
            <group key={z}>
              <Ring at={[0, 0.4, z]} radius={6 - i * 0.5} color="#7daab8" />
              {[-1, 1].map((side) => (
                <Block
                  key={side}
                  at={[side * 6, 3, z]}
                  size={[2.5, 7 + i, 4]}
                  color="#8aa8b3"
                  rotation={[0, side * 0.2, side * 0.2]}
                />
              ))}
            </group>
          ))}
          <Dome at={[0, 0, -16]} size={[7, 7, 4]} color="#618997" />
          <Ring at={[0, 2, -12]} radius={2} color={accent} />
          <Block at={[0, 0.03, -2]} size={[0.15, 0.1, 26]} color={accent} glow />
        </>
      )}
      {mission.id === 'io' && (
        <>
          {/* A narrow industrial causeway between molten channels. */}
          <Block at={[0, -0.1, -1]} size={[7, 0.4, 48]} color="#45434a" />
          {[-3.4, 3.4].map((x) => (
            <group key={x}>
              <Block at={[x, 1.1, -1]} size={[0.12, 0.14, 48]} color="#d3a354" />
              {[16, 8, 0, -8, -16].map((z) => (
                <Block key={z} at={[x, 0.5, z]} size={[0.18, 1.1, 0.18]} color="#d3a354" />
              ))}
            </group>
          ))}
          <Gantry z={-12} width={8} height={7} color="#6c5c50" />
          <Block at={[0, 5, -12]} size={[6, 1.3, 3]} color="#99815c" />
          <Block at={[0, 4.5, -10.4]} size={[4, 0.1, 0.1]} color={accent} glow />
        </>
      )}
      {mission.id === 'titan' && (
        <>
          {/* A methane dock and capsule habitats held above the dark lake on stilts. */}
          <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[50, 80]} />
            <meshStandardMaterial color="#1d221c" metalness={0.6} roughness={0.14} />
          </mesh>
          <Block at={[0, -0.05, 0]} size={[5, 0.3, 70]} color="#5e5847" />
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 8, 0, -3]}>
              {[-2, 2].map((x) => (
                <Block key={x} at={[x, 2.5, 0]} size={[0.35, 5, 0.4]} color="#817255" />
              ))}
              <Block at={[0, 4.5, 0]} size={[6, 0.4, 7]} color="#90806c" />
              <Dome at={[0, 4.7, 0]} size={[3, 3.5, 3.5]} color="#b99561" />
              <Block at={[0, 5.8, 3.4]} size={[3.5, 0.7, 0.1]} color={accent} glow />
            </group>
          ))}
          <Block at={[0, 0, -8]} size={[19, 0.3, 3]} color="#72644c" />
        </>
      )}
      {mission.id === 'enceladus' && (
        <>
          {/* A fissure research rig surrounded by huge translucent ice spires. */}
          {[-9, 8, -12, 13].map((x, i) => (
            <mesh key={x} position={[x, 4 + i, -i * 5]} rotation={[0, i, x * 0.015]} castShadow>
              <coneGeometry args={[2.8, 14 + i * 2, 5]} />
              <meshStandardMaterial color="#a5d8df" metalness={0.3} roughness={0.24} />
            </mesh>
          ))}
          <Gantry z={-6} width={13} height={11} color="#8ca9b0" />
          <Block at={[0, 8, -6]} size={[2.5, 5, 2.5]} color="#547887" />
          <Ring at={[0, 5.4, -6]} radius={1.3} color={accent} rotation={[Math.PI / 2, 0, 0]} />
        </>
      )}
      {mission.id === 'titania' && (
        <>
          {/* Suspension cables frame a long crossing through the canyon. */}
          <Block at={[0, -0.05, -1]} size={[6, 0.35, 50]} color="#726774" />
          {[-10, 12].map((z) => (
            <Gantry key={z} z={z} width={9} height={10} color="#9b889a" />
          ))}
          {[-1, 1].map((side) => (
            <group key={side}>
              <Block
                at={[side * 4.5, 6.5, 1]}
                size={[0.14, 0.14, 28]}
                rotation={[-side * 0.23, 0, 0]}
                color={accent}
              />
              {[-8, -4, 0, 4, 8].map((z) => (
                <Block key={z} at={[side * 4.5, 3.1, z]} size={[0.07, 6.2, 0.07]} color="#d7bacf" />
              ))}
            </group>
          ))}
        </>
      )}
      {mission.id === 'triton' && (
        <>
          {/* A frost-buried observatory and an offset telescope tower. */}
          <Dome at={[-3, 0, -6]} size={[8, 7, 8]} color="#8295b1" />
          <Block at={[-3, 4.6, -6]} size={[0.8, 6, 14]} color="#384860" rotation={[0.35, 0, 0]} />
          <Dish at={[10, 0, -2]} size={1.8} color="#adbfd6" />
          <Ring at={[-3, 1.9, 1.8]} radius={2} color={accent} />
          {[-12, 14].map((x) => (
            <Block
              key={x}
              at={[x, 0.7, 10]}
              size={[5, 1.4, 8]}
              color="#cad4e0"
              rotation={[0, x * 0.05, 0]}
            />
          ))}
        </>
      )}
      {mission.id === 'pluto' && (
        <>
          {/* The final beacon stands inside the skeletal ribs of a ruined colony ship. */}
          {[10, 3, -4, -11].map((z, i) => (
            <Ring
              key={z}
              at={[0, 0.3, z]}
              radius={8 + i * 0.6}
              color="#988592"
              rotation={[0.1, 0, i * 0.08]}
            />
          ))}
          <Block at={[-7, 2, -1]} size={[1.5, 3, 30]} color="#6e6478" rotation={[0, 0, 0.3]} />
          <Block at={[7, 1, -3]} size={[3, 1.5, 33]} color="#92808b" />
          <Block at={[0, 7, -19]} size={[1.5, 14, 1.5]} color="#a196a2" />
          <Ring at={[0, 11, -18]} radius={3} color={accent} />
          <Block at={[0, 7, -18]} size={[0.12, 14, 0.12]} color={accent} glow />
        </>
      )}
    </group>
  );
}
