import type { AreaDef } from '../areaTypes.ts';
import { HUB } from './hub.ts';
import { SANDBOX } from './sandbox.ts';
import { QUARRY, GARDEN, BELFRY, MARSH } from './regions.ts';
import { ARENA_B01 } from './arenas.ts';

export const AREAS: Record<string, AreaDef> = {};

export function registerArea(a: AreaDef): void {
  AREAS[a.id] = a;
}

for (const a of [HUB, SANDBOX, QUARRY, GARDEN, BELFRY, MARSH, ARENA_B01]) registerArea(a);

export const areaById = (id: string): AreaDef | undefined => AREAS[id];
