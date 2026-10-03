import { useId } from 'react';
import type { MissionDefinition } from '@ztype/core';

/** Lightweight, distinct landscape artwork; level browsing never waits for WebGL. */
export function DestinationArt({ mission }: { mission: MissionDefinition }) {
  const uid = useId().replace(/:/g, '');
  const { environment: world, level } = mission;
  const icy = ['ice', 'plumes', 'frost', 'glacier'].includes(world.style);
  const gas = ['jupiter', 'saturn', 'uranus', 'neptune'].includes(world.parent);
  const landmarkPaths: Record<string, string> = {
    mars: 'M-60 8-45-13-19-25 23-19 55-3 61 12 20 9 0-3-18 11ZM-11-6-58-44-71-41-41-1M-38-17-35 4M21-17 18 7',
    ceres:
      'M-53 12V-70H53V12M-53-58H53M-47 12V-58M47 12V-58M-30-70V-86H28V-70M14-58V-27L26-14 14 5 2-14 14-27M-42 12V-8H-15V12',
    callisto:
      'M-61 12A22 23 0 0 1-17 12ZM17 12A22 23 0 0 1 61 12ZM-20 4A25 32 0 1 1 20 4M-53-7H-26M26-7H53',
    ganymede:
      'M-49 12V-81M-66-65H-32V-25H-66ZM49 12V-65M33-53H64V-14H33ZM0 12V-52M-28-58Q0-19 28-58ZM0-42V-74',
    europa:
      'M-58 12Q-59-61-39-75L-23-47Q0-85 24-47L40-80Q60-58 58 12ZM-31 12Q-38-45 0-51Q38-45 31 12M-15 12V-13A15 15 0 0 1 15-13V12',
    io: 'M-50 12-21-37H21L50 12M-59 0H59M-42-17H42M-31-36H31V-67H-31ZM-22-58H22V-46H-22ZM-54 12V-8M54 12V-8',
    titan:
      'M-60 12V-34Q-60-64-39-64Q-18-64-18-34V12M18 12V-34Q18-64 39-64Q60-64 60-34V12M-64-30H-14M14-30H64M-39 12V-20M39 12V-20M-18 2H18',
    enceladus:
      'M-63 12-54-80-29 12M28 12 48-87 66 12M-27 12V-60H27V12M-27-49H27M-9-60V-19H9V-60M-11-19H11',
    titania:
      'M-62 12-25-31H25L62 12M-38 5V-77H38V5M-38-72H38M-62-16Q0-49 62-16M-24-28V4M0-32V-7M24-28V4',
    triton:
      'M-63 12V-4A42 42 0 0 1 84-4V12ZM-24-45V-13M-17-45V-13M29 12V-59M8-65Q29-29 50-65ZM29-51V-78M-37 12V-5H-13V12',
    pluto:
      'M-66 12A67 65 0 0 1 66 12M-53 12A54 51 0 0 1 53 12M-40 12A41 37 0 0 1 40 12M-4 12V-84H4V12M-14-67A14 14 0 1 1 14-67A14 14 0 1 1-14-67',
  };
  const planet = {
    earth: '#598a9c',
    jupiter: '#c9aa8f',
    saturn: '#d7c395',
    uranus: '#91cbd3',
    neptune: '#427bc6',
    sun: '#fae3b2',
    charon: '#ab9dac',
  }[world.parent];
  const ridge = (base: number, amplitude: number, offset: number) =>
    `M0 360V${base} ` +
    Array.from({ length: 25 }, (_, i) => {
      const x = i * 28;
      const y =
        base -
        Math.abs(Math.sin(i * 0.47 + level * 0.73 + offset)) * amplitude -
        Math.sin(i * 1.3 + offset) * 9;
      return `L${x} ${y}`;
    }).join(' ') +
    ' V360Z';
  return (
    <svg
      viewBox="0 0 640 360"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x2="0" y2="1">
          <stop stopColor={world.sky} />
          <stop offset="1" stopColor={world.fog} />
        </linearGradient>
        <radialGradient id={`${uid}-orb`} cx="30%" cy="25%">
          <stop stopColor={planet} />
          <stop offset="0.55" stopColor={planet} />
          <stop offset="1" stopColor="#101923" />
        </radialGradient>
        <linearGradient id={`${uid}-ground`} x2="0" y2="1">
          <stop stopColor={world.ground} />
          <stop offset="1" stopColor={world.sky} />
        </linearGradient>
        <linearGradient id={`${uid}-glow`} x2="0" y2="1">
          <stop stopColor={world.accent} stopOpacity="0" />
          <stop offset="1" stopColor={world.accent} stopOpacity="0.65" />
        </linearGradient>
        <clipPath id={`${uid}-disc`}>
          <circle cx="466" cy="102" r={gas ? 81 : 60} />
        </clipPath>
      </defs>
      <path d="M0 0H640V360H0Z" fill={`url(#${uid}-sky)`} />
      {Array.from({ length: 60 }, (_, i) => (
        <circle
          key={i}
          cx={(i * 113 + level * 7) % 640}
          cy={(i * 73) % 235}
          r={i % 7 === 0 ? 1.25 : 0.6}
          fill="#edf1f0"
          opacity={world.style === 'haze' ? 0.13 : 0.3 + (i % 4) * 0.13}
        />
      ))}
      {world.parent !== 'sun' && (
        <>
          {world.parent === 'saturn' && (
            <ellipse
              cx="466"
              cy="102"
              rx="138"
              ry="35"
              transform="rotate(-22 466 102)"
              fill="none"
              stroke="#d5cbb6"
              strokeWidth="13"
              opacity="0.55"
            />
          )}
          <circle cx="466" cy="102" r={gas ? 81 : 60} fill={`url(#${uid}-orb)`} />
          <g clipPath={`url(#${uid}-disc)`}>
            {gas && (
              <g opacity="0.24" fill="none" stroke="#f6dfb8">
                {[0, 1, 2, 3, 4].map((i) => (
                  <path
                    key={i}
                    d={`M370 ${54 + i * 23} Q455 ${90 + i * 17} 560 ${40 + i * 27}`}
                    strokeWidth={world.parent === 'jupiter' ? 12 : 4}
                  />
                ))}
              </g>
            )}
            {world.parent === 'earth' && (
              <g fill="#8da996" opacity="0.65">
                <path d="M417 62l27 -10 16 9 -8 15 -13 3 -7 17 -13 -5 -9 -16Z" />
                <path d="M443 96l18 5 9 15 -13 18 -6 22 -8 -17 4 -19 -10 -12Z" />
                <path d="M490 61l22 8 11 24 -21 5 -5 14 -13 -10 -10 -14 10 -9Z" />
                <path d="M480 105l18 5 -1 17 -11 10 -7 -17Z" />
              </g>
            )}
            {world.parent === 'charon' && (
              <g fill="#504552" opacity="0.35">
                <ellipse cx="453" cy="55" rx="44" ry="23" />
                <circle cx="433" cy="110" r="12" />
                <circle cx="484" cy="137" r="8" />
                <path d="M427 88l28 10 12 -7 33 12 -29 -6 -12 6Z" />
              </g>
            )}
          </g>
        </>
      )}
      {world.parent === 'sun' && <circle cx="475" cy="90" r="14" fill="#ffedd4" opacity="0.75" />}
      <path
        d={ridge(251, world.style === 'canyon' ? 150 : 70, 0)}
        fill={world.rock}
        opacity="0.55"
      />
      <path d={ridge(301, 84, 2)} fill={`url(#${uid}-ground)`} />
      <path d={ridge(356, 43, 4)} fill={world.rock} opacity="0.82" />
      {icy &&
        Array.from({ length: 7 }, (_, i) => (
          <path
            key={i}
            d={`M${70 + i * 75} 360l${20 - i * 9} -49 23 -18 -8 -20`}
            fill="none"
            stroke={world.accent}
            opacity="0.45"
            strokeWidth="2"
          />
        ))}
      {world.style === 'lava' && (
        <>
          <path
            d="M620 361 463 296 470 275 406 250 416 239"
            fill="none"
            stroke="#ef6c3f"
            strokeWidth="15"
          />
          <path
            d="M620 361 463 296 470 275 406 250 416 239"
            fill="none"
            stroke="#ffcf75"
            strokeWidth="4"
          />
        </>
      )}
      {world.style === 'plumes' &&
        [80, 480, 530].map((x) => (
          <path
            key={x}
            d={`M${x} 282q-70 -85 -30 -145q20 20 30 70q10 -50 32 -84q28 75 -32 159`}
            fill={`url(#${uid}-glow)`}
          />
        ))}
      {['haze', 'dunes'].includes(world.style) &&
        [205, 245, 282].map((y) => (
          <path
            key={y}
            d={`M0 ${y} Q300 ${y - 20} 640 ${y + 25}`}
            fill="none"
            stroke={world.accent}
            strokeWidth="25"
            opacity="0.055"
          />
        ))}
      <g transform={`translate(${world.style === 'canyon' ? 390 : 355} 266)`}>
        {mission.id !== 'moon' ? (
          <path
            d={landmarkPaths[mission.id]}
            fill="#14232de6"
            stroke={world.accent}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <path
              d="M-27 10V-22l9 -8h40l10 8v32Z"
              fill="#101c2b"
              stroke={world.accent}
              strokeOpacity="0.5"
            />
            <path
              d="M-7 10V-13H7V10M-21 -16h7m29 0h8"
              fill="none"
              stroke={world.accent}
              strokeWidth="2"
            />
            <path d="M31 10V-48m-9 4h18" stroke="#9cabb7" strokeWidth="2" />
            <circle cx="31" cy="-49" r="2.5" fill={world.accent} />
          </>
        )}
      </g>
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={i}
          cx={345 - i * 12}
          cy={288 + i * 15}
          r={1 + i * 0.3}
          fill={world.accent}
          opacity="0.75"
        />
      ))}
    </svg>
  );
}
