import type { BossViewFn } from './types.ts';

export const BOSS_VIEWS: Record<string, BossViewFn> = {};

export function registerBossView(id: string, fn: BossViewFn): void {
  BOSS_VIEWS[id] = fn;
}
