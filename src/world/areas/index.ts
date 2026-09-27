import type { AreaDef } from '../areaTypes.ts';
import { HUB } from './hub.ts';
import { SANDBOX } from './sandbox.ts';
import { QUARRY, GARDEN, BELFRY, MARSH } from './regions.ts';
import * as ARENAS from './arenas.ts';

export const AREAS: Record<string, AreaDef> = {};

export function registerArea(a: AreaDef): void {
  AREAS[a.id] = a;
}

for (const a of [HUB, SANDBOX, QUARRY, GARDEN, BELFRY, MARSH]) registerArea(a);
for (const a of Object.values(ARENAS)) if (a && typeof a === 'object' && 'tiles' in a) registerArea(a as AreaDef);

export const areaById = (id: string): AreaDef | undefined => AREAS[id];
