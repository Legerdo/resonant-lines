// Progression rules (unlocks, final gate, records). Pure functions over SaveData.
import type { SaveData } from '../save/save.ts';
import { BOSS_ENTRIES, STORY_BOSSES, bossEntry } from '../bosses/registry.ts';
import type { TuningId } from './tunings.ts';

export const FINAL_GATE_REQUIRED = 5;
export const REGIONS = ['garden', 'belfry', 'quarry', 'marsh'] as const;

export function flagsOf(save: SaveData): Set<string> {
  const f = new Set(save.flags);
  for (const id of save.completedBossIds) f.add(`boss:${id}`);
  for (const id of save.discoveredBossIds) f.add(`seen:${id}`);
  for (const r of REGIONS) {
    const ids = BOSS_ENTRIES.filter((b) => b.region === r).map((b) => b.id);
    if (ids.length && ids.every((id) => save.completedBossIds.includes(id))) f.add(`cleared:${r}`);
  }
  if (save.finalGateUnlocked) f.add('finalGate');
  if (save.endingSeen) f.add('ending');
  if (f.has('tutorialDone')) for (const r of REGIONS) f.add(`region:${r}`);
  return f;
}

export function storyBossesDone(save: SaveData): number {
  return save.completedBossIds.filter((id) => STORY_BOSSES.includes(id)).length;
}

export interface CompletionResult {
  firstClear: boolean;
  tuning: TuningId | null;
  newBest: boolean;
  gateOpened: boolean;
}

export function completeBoss(save: SaveData, bossId: string, time: number): CompletionResult {
  const entry = bossEntry(bossId);
  const firstClear = !save.completedBossIds.includes(bossId);
  if (firstClear) save.completedBossIds.push(bossId);
  if (!save.discoveredBossIds.includes(bossId)) save.discoveredBossIds.push(bossId);
  let tuning: TuningId | null = null;
  if (entry?.tuning && !save.unlockedTunings.includes(entry.tuning)) {
    save.unlockedTunings.push(entry.tuning);
    tuning = entry.tuning;
  }
  const prev = save.bossBestTimes[bossId];
  const newBest = prev === undefined || time < prev;
  if (newBest) save.bossBestTimes[bossId] = Math.round(time * 100) / 100;
  let gateOpened = false;
  if (!save.finalGateUnlocked && storyBossesDone(save) >= FINAL_GATE_REQUIRED) {
    save.finalGateUnlocked = true;
    gateOpened = true;
  }
  return { firstClear, tuning, newBest, gateOpened };
}

export function discoverBoss(save: SaveData, bossId: string): boolean {
  if (save.discoveredBossIds.includes(bossId)) return false;
  save.discoveredBossIds.push(bossId);
  return true;
}

export function recordDeath(save: SaveData, bossId: string): void {
  save.bossDeathCounts[bossId] = (save.bossDeathCounts[bossId] ?? 0) + 1;
}

export function setFlag(save: SaveData, flag: string): boolean {
  if (save.flags.includes(flag)) return false;
  save.flags.push(flag);
  return true;
}
