import { getMission, isMissionUnlocked, type CampaignProgress } from '@ztype/core';

// Preview every destination without manufacturing completion records or stars.
const unlockAllLevels = import.meta.env.VITE_UNLOCK_ALL_LEVELS === 'true';

export function canPlayMission(id: string, progress: CampaignProgress): boolean {
  return Boolean(getMission(id)) && (unlockAllLevels || isMissionUnlocked(id, progress));
}
