import type { MissionResult, MissionStep, MissionThreatKind } from './mission';

export type WorldStyle =
  | 'craters'
  | 'dunes'
  | 'mining'
  | 'ridges'
  | 'ice'
  | 'lava'
  | 'haze'
  | 'plumes'
  | 'canyon'
  | 'frost'
  | 'glacier';
export type MissionEnvironment = {
  style: WorldStyle;
  ground: string;
  rock: string;
  sky: string;
  fog: string;
  accent: string;
  sun: string;
  parent: 'earth' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'sun' | 'charon';
};
export type MissionDefinition = {
  id: string;
  missionId: string;
  level: number;
  chapter: number;
  name: string;
  system: string;
  title: string;
  description: string;
  location: string;
  version: number;
  locale: string;
  steps: MissionStep[];
  environment: MissionEnvironment;
  threatPattern: MissionThreatKind[];
  minWordLength: number;
  maxWordLength: number;
  pressure: number;
  durationMs: number;
  surfaceRisk: 'low' | 'moderate' | 'high' | 'extreme';
  successTitle: string;
  successText: string;
};

// Narrative/practice content is versioned separately from interface translations.
const moonTemplate = {
  id: 'moon-selene',
  version: 5,
  locale: 'en',
  title: 'Lunar lifeline',
  destination: 'Moon',
  location: 'Selene outpost',
  steps: [
    {
      id: 'ignition',
      phase: 'prime',
      title: 'Ignition',
      objective: 'Type ignite to bring your engines online.',
      radio:
        'FLIGHT CONTROL / A distress beacon is transmitting from Selene. One astronaut is still down there.',
      prompt: 'ignite',
      from: 16,
      to: 16,
    },
    {
      id: 'launch',
      phase: 'launch',
      title: 'Leaving the carrier',
      objective: 'Engines online. Your rescue flight is underway.',
      radio: 'FLIGHT CONTROL / You are clear to launch. Bring our explorer home.',
      durationMs: 600,
      from: 16,
      to: 16,
    },
    {
      id: 'landing',
      phase: 'landing',
      title: 'Descent to Selene',
      objective: 'Landing near the outpost. Prepare to go on foot.',
      radio:
        'FLIGHT CONTROL / Unidentified security drones ahead. Your pulse tool can disable them.',
      durationMs: 800,
      from: 16,
      to: 16,
    },
    {
      id: 'approach',
      phase: 'walk',
      title: 'Follow the signal',
      objective: 'Approaching the damaged relay.',
      radio:
        'FLIGHT CONTROL / The beacon is losing power. Restore the link before you enter the outpost.',
      durationMs: 650,
      from: 16,
      to: 8,
    },
    {
      id: 'beacon',
      phase: 'repair',
      title: 'Restore the beacon',
      objective: 'Complete the repair command to reconnect the outpost.',
      radio: 'SELENE / If anyone can hear this, the outer door is sealed. I am still inside.',
      prompt: 'restore the relay signal',
      from: 8,
      to: 8,
    },
    {
      id: 'first-contact',
      phase: 'combat',
      title: 'Unfriendly company',
      objective: 'Type a target’s word to destroy it.',
      radio:
        'FLIGHT CONTROL / Drones and loose debris inbound. Keep firing until the route is clear.',
      waves: [1, 2, 2, 2, 3, 3, 3, 3],
      from: 8,
      to: 8,
    },
    {
      id: 'to-airlock',
      phase: 'walk',
      title: 'Reach the shelter',
      objective: 'The path is clear. Moving to the outer airlock.',
      radio: 'SELENE / I can see your lights. The airlock panel is on the outside.',
      durationMs: 700,
      from: 8,
      to: -8,
    },
    {
      id: 'airlock',
      phase: 'repair',
      title: 'Open the airlock',
      objective: 'Enter the override command to open the shelter.',
      radio: 'FLIGHT CONTROL / Take your time with the override. Every character must match.',
      prompt: 'release the airlock seal',
      from: -8,
      to: -8,
    },
    {
      id: 'hold-position',
      phase: 'combat',
      title: 'Hold the entrance',
      objective: 'Hold off the threats while the astronaut suits up.',
      radio: 'SELENE / My suit is ready. Clear a path and I will follow you.',
      waves: [2, 2, 3, 3, 3, 3, 3, 3, 3],
      from: -8,
      to: -8,
    },
    {
      id: 'survivor',
      phase: 'rescue',
      title: 'Make contact',
      objective: 'Send the all-clear and help the astronaut out.',
      radio: 'SELENE / You made it. I knew someone would find the signal.',
      prompt: 'stay close and follow my light',
      from: -8,
      to: -8,
    },
    {
      id: 'escort',
      phase: 'walk',
      title: 'Nobody left behind',
      objective: 'Escort the astronaut to the landing zone.',
      radio: 'FLIGHT CONTROL / One survivor located. The ship is ready for extraction.',
      durationMs: 800,
      from: -8,
      to: 7,
    },
    {
      id: 'last-wave',
      phase: 'combat',
      title: 'Protect the extraction',
      objective: 'Keep the landing zone clear until extraction.',
      radio: 'SELENE / Almost there. I will get aboard while you cover the ramp.',
      waves: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      from: 7,
      to: 7,
    },
    {
      id: 'extraction',
      phase: 'extract',
      title: 'Bring them home',
      objective: 'Complete the departure checklist.',
      radio: 'SELENE / Passenger secure. Thank you for coming back for me.',
      prompt: 'crew secure ready for departure',
      from: 7,
      to: 7,
    },
    {
      id: 'departure',
      phase: 'departure',
      title: 'Homeward bound',
      objective: 'Rescue complete. Leaving the lunar surface.',
      radio: 'FLIGHT CONTROL / We have you on approach. Welcome home, both of you.',
      durationMs: 700,
      from: 7,
      to: 7,
    },
  ] satisfies MissionStep[],
};

type DestinationContent = Omit<
  MissionDefinition,
  | 'steps'
  | 'version'
  | 'locale'
  | 'threatPattern'
  | 'minWordLength'
  | 'maxWordLength'
  | 'pressure'
  | 'durationMs'
  | 'surfaceRisk'
> & {
  pattern: MissionThreatKind[];
  commands: string[];
  objectives: string[];
  battles: string[];
};
const destinations: DestinationContent[] = [
  {
    id: 'moon',
    name: 'Moon',
    missionId: 'moon-selene',
    system: 'Earth system',
    title: 'Lunar lifeline',
    description: 'Fight through the lunar storm. Bring one astronaut home.',
    location: 'Selene outpost',
    chapter: 0,
    pattern: ['drone', 'rock', 'debris'],
    commands: [
      'restore the relay signal',
      'release the airlock seal',
      'stay close and follow my light',
      'crew secure ready for departure',
    ],
    objectives: ['Restore the beacon', 'Open the airlock', 'Make contact'],
    battles: ['Unfriendly company', 'Hold the entrance', 'Protect the extraction'],
    successTitle: 'One more person made it home.',
    successText: 'The beacon is back online. Your passenger is safe aboard.',
    level: 1,
    environment: {
      style: 'craters',
      ground: '#8c969e',
      rock: '#777d86',
      sky: '#080e18',
      fog: '#172232',
      accent: '#a6e3dc',
      sun: '#ffe1b8',
      parent: 'earth',
    },
  },
  {
    id: 'mars',
    name: 'Mars',
    missionId: 'mars-ares',
    system: 'Inner solar system',
    title: 'Red horizon',
    description: 'Clear a canyon route for a stranded rover crew.',
    location: 'Ares canyon',
    chapter: 0,
    pattern: ['rock', 'drone', 'debris', 'rock'],
    commands: [
      'locate the rover beacon',
      'repair the rover guidance',
      'crew aboard follow the canyon route',
      'rover secure prepare for liftoff',
    ],
    objectives: ['Find the stranded rover', 'Repair rover guidance', 'Escort the rover crew'],
    battles: ['Clear the red canyon', 'Defend the rover', 'Guard the launch site'],
    successTitle: 'The rover crew is safe.',
    successText: 'You cleared the canyon and brought the stranded crew back to orbit.',
    level: 2,
    environment: {
      style: 'dunes',
      ground: '#c48362',
      rock: '#995747',
      sky: '#322019',
      fog: '#654336',
      accent: '#f0ad80',
      sun: '#ffca98',
      parent: 'sun',
    },
  },
  {
    id: 'ceres',
    name: 'Ceres',
    missionId: 'ceres-occator',
    system: 'Asteroid belt',
    title: 'Deep extraction',
    description: 'Reach the mining crew through a field of tumbling rock.',
    location: 'Occator mining station',
    chapter: 0,
    pattern: ['rock', 'rock', 'debris', 'drone'],
    commands: [
      'scan the collapsed mining shaft',
      'restore the excavation lift',
      'miners follow the safety lights',
      'all miners aboard seal the cargo bay',
    ],
    objectives: ['Locate the mining team', 'Power the excavation lift', 'Recover the miners'],
    battles: ['Break through the rockfall', 'Protect the lift', 'Clear the cargo ramp'],
    successTitle: 'Everyone is out of the mine.',
    successText: 'The excavation lift is working. The mining team is safely aboard.',
    level: 3,
    environment: {
      style: 'mining',
      ground: '#99908a',
      rock: '#605955',
      sky: '#0d0d19',
      fog: '#292638',
      accent: '#e1c997',
      sun: '#fff0c4',
      parent: 'sun',
    },
  },
  {
    id: 'callisto',
    name: 'Callisto',
    missionId: 'callisto-valhalla',
    system: 'Jupiter system',
    title: 'Crater watch',
    description: 'Hold a remote research base against a drone siege.',
    location: 'Valhalla research base',
    chapter: 1,
    pattern: ['drone', 'drone', 'rock', 'debris'],
    commands: [
      'reconnect the perimeter sensors',
      'open the research vault',
      'scientists move to the emergency shelter',
      'research team secure initiate extraction',
    ],
    objectives: ['Restore perimeter sensors', 'Open the research vault', 'Evacuate the scientists'],
    battles: ['Hold the crater rim', 'Defend the research vault', 'Break the siege'],
    successTitle: 'The research team is home.',
    successText: 'The siege is over. The crew and their research escaped together.',
    level: 4,
    environment: {
      style: 'craters',
      ground: '#68625d',
      rock: '#494847',
      sky: '#090e1c',
      fog: '#262732',
      accent: '#d8bf9e',
      sun: '#eacba5',
      parent: 'jupiter',
    },
  },
  {
    id: 'ganymede',
    name: 'Ganymede',
    missionId: 'ganymede-galileo',
    system: 'Jupiter system',
    title: 'The distant watch',
    description: 'Reconnect the relay towers and find a missing survey team.',
    location: 'Galileo relay ridge',
    chapter: 1,
    pattern: ['drone', 'debris', 'drone', 'rock'],
    commands: [
      'align the long range antenna',
      'bridge the damaged relay circuit',
      'survey team follow the rescue signal',
      'relay stable survey crew ready to depart',
    ],
    objectives: ['Align the relay tower', 'Bridge the relay circuit', 'Recover the survey team'],
    battles: ['Cross the broken ridges', 'Hold the relay line', 'Defend the survey crew'],
    successTitle: 'The distant signal is answered.',
    successText: 'The towers are connected and the missing survey team is safely aboard.',
    level: 5,
    environment: {
      style: 'ridges',
      ground: '#a5adaf',
      rock: '#69677b',
      sky: '#131a29',
      fog: '#334251',
      accent: '#9bbcdf',
      sun: '#d8e8ff',
      parent: 'jupiter',
    },
  },
  {
    id: 'europa',
    name: 'Europa',
    missionId: 'europa-thalassa',
    system: 'Jupiter system',
    title: 'Beneath the ice',
    description: 'Protect an ocean research station on the fractured ice.',
    location: 'Thalassa ice station',
    chapter: 1,
    pattern: ['rock', 'debris', 'drone', 'rock', 'drone'],
    commands: [
      'trace the station heat signature',
      'stabilize the ice station airlock',
      'research crew stay on the marked ice',
      'ocean samples secure crew ready to leave',
    ],
    objectives: ['Find the ice station', 'Stabilize the airlock', 'Guide the research crew'],
    battles: ['Cross the fractured ice', 'Hold the ice station', 'Protect the ice crossing'],
    successTitle: 'The ice station crew is safe.',
    successText: 'The research crew and their ocean samples made it off the fractured ice.',
    level: 6,
    environment: {
      style: 'ice',
      ground: '#b8dce4',
      rock: '#6cabc2',
      sky: '#0b1c31',
      fog: '#3b6d88',
      accent: '#91e7f2',
      sun: '#d7efff',
      parent: 'jupiter',
    },
  },
  {
    id: 'io',
    name: 'Io',
    missionId: 'io-prometheus',
    system: 'Jupiter system',
    title: 'Firebreak',
    description: 'Escape a volcanic facility before the next eruption.',
    location: 'Prometheus observatory',
    chapter: 1,
    pattern: ['rock', 'rock', 'drone', 'debris', 'rock'],
    commands: [
      'reroute the facility cooling system',
      'release the emergency blast doors',
      'observatory crew follow the evacuation lights',
      'thermal shields active initiate emergency launch',
    ],
    objectives: [
      'Reroute the cooling system',
      'Release the blast doors',
      'Evacuate the observatory',
    ],
    battles: ['Survive the first eruption', 'Hold the firebreak', 'Cover the emergency launch'],
    successTitle: 'Clear of the eruption.',
    successText: 'The observatory crew is in orbit. The facility evacuation is complete.',
    level: 7,
    environment: {
      style: 'lava',
      ground: '#66523a',
      rock: '#3d3230',
      sky: '#251619',
      fog: '#6f382a',
      accent: '#ffb06b',
      sun: '#ffc384',
      parent: 'jupiter',
    },
  },
  {
    id: 'titan',
    name: 'Titan',
    missionId: 'titan-huygens',
    system: 'Saturn system',
    title: 'Through the amber veil',
    description: 'Follow rescue beacons across dunes beneath the orange haze.',
    location: 'Huygens dune camp',
    chapter: 2,
    pattern: ['drone', 'debris', 'rock', 'drone', 'debris'],
    commands: [
      'calibrate the low visibility scanner',
      'activate the dune camp guidance lights',
      'expedition crew follow the amber beacons',
      'navigation confirmed all passengers aboard',
    ],
    objectives: [
      'Calibrate the scanner',
      'Activate the guidance lights',
      'Lead the expedition home',
    ],
    battles: ['Follow the amber beacons', 'Defend the dune camp', 'Hold the last beacon'],
    successTitle: 'Home through the haze.',
    successText: 'Your beacons led the expedition safely across the dunes and back to the ship.',
    level: 8,
    environment: {
      style: 'haze',
      ground: '#a87843',
      rock: '#715334',
      sky: '#493120',
      fog: '#8e6237',
      accent: '#ebca85',
      sun: '#ffe0ab',
      parent: 'saturn',
    },
  },
  {
    id: 'enceladus',
    name: 'Enceladus',
    missionId: 'enceladus-tiger',
    system: 'Saturn system',
    title: 'Whiteout rescue',
    description: 'Hold an extraction site beside towering ice plumes.',
    location: 'Tiger stripe outpost',
    chapter: 2,
    pattern: ['rock', 'debris', 'rock', 'drone', 'debris'],
    commands: [
      'track the outpost thermal beacon',
      'anchor the extraction platform',
      'field team cross to the landing platform',
      'landing clamps secure prepare for departure',
    ],
    objectives: [
      'Track the thermal beacon',
      'Anchor the extraction platform',
      'Recover the field team',
    ],
    battles: ['Pass the ice plumes', 'Hold the extraction platform', 'Clear the whiteout'],
    successTitle: 'Out of the whiteout.',
    successText: 'The field team crossed safely. Your extraction platform held against the ice.',
    level: 9,
    environment: {
      style: 'plumes',
      ground: '#cedfe7',
      rock: '#92b3c7',
      sky: '#0d2032',
      fog: '#51718a',
      accent: '#bcf4ff',
      sun: '#f0f6ff',
      parent: 'saturn',
    },
  },
  {
    id: 'titania',
    name: 'Titania',
    missionId: 'titania-messina',
    system: 'Uranus system',
    title: 'Canyon runners',
    description: 'Reach a stranded team through a winding canyon approach.',
    location: 'Messina canyon relay',
    chapter: 2,
    pattern: ['debris', 'drone', 'rock', 'drone', 'rock'],
    commands: [
      'map the canyon evacuation corridor',
      'restore the canyon bridge controls',
      'relay team stay together through the pass',
      'canyon crossing complete ready for extraction',
    ],
    objectives: ['Map the canyon corridor', 'Restore the bridge controls', 'Guide the relay team'],
    battles: ['Clear the canyon approach', 'Protect the bridge', 'Defend the canyon exit'],
    successTitle: 'Everyone crossed the canyon.',
    successText: 'The relay team reached the landing zone together. The route home is clear.',
    level: 10,
    environment: {
      style: 'canyon',
      ground: '#9c8992',
      rock: '#625561',
      sky: '#121c2b',
      fog: '#3b3b56',
      accent: '#d2b4e9',
      sun: '#d9daed',
      parent: 'uranus',
    },
  },
  {
    id: 'triton',
    name: 'Triton',
    missionId: 'triton-nereid',
    system: 'Neptune system',
    title: 'The cold watch',
    description: 'Recover an isolated expedition beneath Neptune’s blue light.',
    location: 'Nereid frost station',
    chapter: 2,
    pattern: ['drone', 'rock', 'debris', 'debris', 'drone', 'rock'],
    commands: [
      'amplify the expedition distress channel',
      'restore the frozen station power',
      'expedition team follow the blue rescue lights',
      'life support stable all crew ready to leave',
    ],
    objectives: ['Amplify the distress channel', 'Restore station power', 'Recover the expedition'],
    battles: ['Cross the frozen plain', 'Defend the frost station', 'Hold the blue horizon'],
    successTitle: 'No one left in the cold.',
    successText: 'The isolated expedition is warm and safe aboard your rescue ship.',
    level: 11,
    environment: {
      style: 'frost',
      ground: '#bac3d6',
      rock: '#6c798d',
      sky: '#080e24',
      fog: '#293953',
      accent: '#a5b8fa',
      sun: '#b8ceff',
      parent: 'neptune',
    },
  },
  {
    id: 'pluto',
    name: 'Pluto',
    missionId: 'pluto-sputnik',
    system: 'Kuiper Belt',
    title: 'The last light',
    description: 'Bring the final expedition home in the campaign’s ultimate rescue.',
    location: 'Sputnik frontier station',
    chapter: 2,
    pattern: ['drone', 'rock', 'debris', 'rock', 'drone', 'debris'],
    commands: [
      'reconnect the frontier emergency network',
      'activate the final evacuation protocol',
      'all expedition teams follow the rescue beacon',
      'every passenger secure plot the long course home',
    ],
    objectives: [
      'Reconnect the frontier network',
      'Activate final evacuation',
      'Bring the expedition together',
    ],
    battles: ['Hold the frontier', 'Protect the last shelter', 'Defend the final extraction'],
    successTitle: 'Twelve worlds. Everyone home.',
    successText:
      'The final expedition is safe. Your rescue campaign across the solar system is complete.',
    level: 12,
    environment: {
      style: 'glacier',
      ground: '#b5a9a1',
      rock: '#867b80',
      sky: '#070917',
      fog: '#292c46',
      accent: '#e7bdcf',
      sun: '#e5cadf',
      parent: 'charon',
    },
  },
];

export const campaignChapters = ['First expeditions', 'Jupiter’s moons', 'Outer worlds'] as const;
// Rescue windows reflect the fictional operation's exposure and terrain hazards.
// They are not claims about real astronaut survival times on these worlds.
const surfaceProfiles: Record<
  string,
  { seconds: number; risk: MissionDefinition['surfaceRisk']; waves: number }
> = {
  moon: { seconds: 300, risk: 'low', waves: 27 },
  mars: { seconds: 270, risk: 'low', waves: 23 },
  ceres: { seconds: 240, risk: 'moderate', waves: 20 },
  callisto: { seconds: 270, risk: 'low', waves: 23 },
  ganymede: { seconds: 240, risk: 'moderate', waves: 19 },
  europa: { seconds: 210, risk: 'high', waves: 16 },
  io: { seconds: 120, risk: 'extreme', waves: 6 },
  titan: { seconds: 180, risk: 'high', waves: 12 },
  enceladus: { seconds: 150, risk: 'extreme', waves: 9 },
  titania: { seconds: 165, risk: 'high', waves: 10 },
  triton: { seconds: 135, risk: 'extreme', waves: 7 },
  pluto: { seconds: 120, risk: 'extreme', waves: 6 },
};
export const missionDestinations: MissionDefinition[] = destinations.map((content, index) => {
  const surface = surfaceProfiles[content.id];
  const { commands, objectives, battles, pattern, ...destination } = content;
  const steps: MissionStep[] = moonTemplate.steps.map((step) => ({
    ...step,
    waves: step.waves && [...step.waves],
  }));
  if (index > 0) {
    const words = [4, 7, 9, 12];
    words.forEach((position, i) => {
      steps[position].prompt = commands[i];
    });
    [4, 7, 9].forEach((position, i) => {
      steps[position].title = objectives[i];
      steps[position].objective = objectives[i] + '.';
    });
    steps[2].title = `Descent to ${content.name}`;
    steps[3].title = `Approach ${content.location}`;
    steps[6].title = `Reach ${content.location}`;
    steps[10].title = 'Escort to the landing zone';
    steps[13].objective = `Rescue complete. Leaving ${content.name}.`;
    [5, 8, 11].forEach((position, encounter) => {
      steps[position].title = battles[encounter];
      steps[position].objective = 'Type a target’s word to clear the route.';
      // Short hazardous operations use fewer waves and harder commands.
      // Keep all three rescue encounters, with no more than three labels at once.
      steps[position].waves = Array.from(
        { length: Math.floor(surface.waves / 3) + (encounter < surface.waves % 3 ? 1 : 0) },
        (_, wave) =>
          encounter === 0 && wave === 0 ? (index < 4 ? 1 : 2) : index < 3 && wave < 3 ? 2 : 3,
      );
    });
    steps.forEach((step) => {
      step.radio = `FLIGHT CONTROL / ${content.location}. ${step.objective}`;
    });
  }
  return {
    ...destination,
    version: index === 0 ? moonTemplate.version : 2,
    durationMs: surface.seconds * 1000,
    surfaceRisk: surface.risk,
    locale: 'en',
    steps,
    threatPattern: pattern,
    minWordLength: index < 4 ? 3 : index < 8 ? 4 : 5,
    maxWordLength: index === 0 ? 9 : Math.min(12, 8 + Math.floor(index / 3)),
    pressure: Math.max(0.92, 1 - index * 0.008),
  };
});
// Compatibility for the original Moon engine and existing result records.
export const lunarMission = { ...moonTemplate, steps: missionDestinations[0].steps };
export function getMission(id: string): MissionDefinition | undefined {
  return missionDestinations.find((mission) => mission.id === id || mission.missionId === id);
}
export function missionWaveCount(mission: MissionDefinition) {
  return mission.steps.reduce((n, step) => n + (step.waves?.length ?? 0), 0);
}

export type CampaignProgress = Record<string, { stars: number; completedAt: string }>;
export function campaignProgress(
  runs: readonly MissionResult[],
  saved: CampaignProgress = {},
): CampaignProgress {
  const progress: CampaignProgress = {};
  for (const mission of missionDestinations) {
    const completed = saved[mission.missionId];
    if (completed && completed.stars >= 1)
      progress[mission.missionId] = { ...completed, stars: Math.min(3, completed.stars) };
  }
  for (const run of runs) {
    if (run.outcome !== 'won' || !getMission(run.missionId)) continue;
    const previous = progress[run.missionId];
    progress[run.missionId] = {
      stars: Math.max(previous?.stars ?? 1, Math.min(3, Math.max(1, run.stars))),
      completedAt:
        previous?.completedAt && previous.completedAt > run.completedAt
          ? previous.completedAt
          : run.completedAt,
    };
  }
  return progress;
}
export function campaignFrontier(progress: CampaignProgress): number {
  let index = 0;
  while (index < missionDestinations.length - 1 && progress[missionDestinations[index].missionId])
    index++;
  return index;
}
export function isMissionUnlocked(id: string, progress: CampaignProgress): boolean {
  const mission = getMission(id);
  return Boolean(mission && mission.level <= campaignFrontier(progress) + 1);
}
