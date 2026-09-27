// Boss catalogue: id -> region, arena, tuning unlock, controller factory.
import type { BossController } from './framework/boss.ts';
import type { TuningId } from '../progression/tunings.ts';
import { GramBoss } from './definitions/b01Gram.ts';
import { HummingBoss } from './definitions/b02Humming.ts';
import { NeraBoss } from './definitions/b03Nera.ts';
import { MoraBoss } from './definitions/b04Mora.ts';

export interface BossEntry {
  id: string;
  nameKey: string;
  region: 'garden' | 'belfry' | 'quarry' | 'marsh' | 'heart';
  areaId: string;
  tuning: TuningId | null;
  music: string;
  create: () => BossController;
}

const factories: Record<string, () => BossController> = {
  B01: () => new GramBoss(),
  B02: () => new HummingBoss(),
  B03: () => new NeraBoss(),
  B04: () => new MoraBoss(),
};

export function registerBoss(id: string, f: () => BossController): void {
  factories[id] = f;
}

const def = (id: string, region: BossEntry['region'], tuning: TuningId | null, music: string): BossEntry => ({
  id,
  nameKey: `boss.${id}`,
  region,
  areaId: `arena_${id}`,
  tuning,
  music,
  create: () => {
    const f = factories[id];
    if (!f) throw new Error(`boss ${id} not implemented`);
    return f();
  },
});

export const BOSS_ENTRIES: readonly BossEntry[] = [
  def('B01', 'quarry', 'elasticNeedle', 'boss_gram'),
  def('B02', 'belfry', 'echo', 'boss_hum'),
  def('B03', 'marsh', 'wideCapture', 'boss_nera'),
  def('B04', 'garden', 'stableNet', 'boss_mora'),
  def('B05', 'marsh', 'longLine', 'boss_eye'),
  def('B06', 'quarry', 'swiftNeedle', 'boss_brak'),
  def('B07', 'garden', 'threadWeaver', 'boss_orbit'),
  def('B08', 'belfry', 'rapidTune', 'boss_crown'),
  def('FINAL', 'heart', null, 'boss_star'),
];

export const STORY_BOSSES: readonly string[] = ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08'];

export const bossEntry = (id: string): BossEntry | undefined => BOSS_ENTRIES.find((b) => b.id === id);
export const isBossImplemented = (id: string): boolean => !!factories[id];
