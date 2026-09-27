import type { Vec } from '../core/math/vec.ts';
import type { SurfaceTag } from '../core/sim/types.ts';

export type AreaKind = 'hub' | 'region' | 'arena' | 'sandbox';
export type RegionId = 'hub' | 'garden' | 'belfry' | 'quarry' | 'marsh' | 'heart';

export interface PropDef {
  id: string;
  /** visual kind, resolved by presentation (e.g. 'pillar', 'sealStone', 'lamp', 'mural') */
  kind: string;
  pos: Vec;
  /** collider radius; omitted = purely visual */
  r?: number;
  tag?: SurfaceTag;
  blocksLink?: boolean;
  blocksMove?: boolean;
  blocksNeedle?: boolean;
  receiver?: string;
  variant?: number;
  /** only present when this flag is set / not set */
  ifFlag?: string;
  unlessFlag?: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExitDef {
  id: string;
  rect: Rect;
  to: string;
  spawn: string;
  /** progression flag required to pass; otherwise the exit is sealed (solid) */
  requires?: string;
  lockedKey?: string;
}

export type InteractKind = 'altar' | 'records' | 'replay' | 'mural';

export interface InteractDef {
  id: string;
  kind: InteractKind;
  pos: Vec;
  r: number;
  textKey?: string;
}

/** Non-combat resonance mechanisms (tutorial device, region puzzles). */
export type MechDef =
  | {
      id: string;
      kind: 'emitter';
      pos: Vec;
      sig: 'Impact' | 'Wave' | 'Heat' | 'Void' | 'Rotational';
      /** 'ring' expanding wave, 'drop' falling rock zone at pos, 'beam' sweeping ray */
      shape: 'ring' | 'drop' | 'beam';
      period: number;
      range: number;
      tone?: number;
      angle?: number;
      unlessFlag?: string;
    }
  | {
      id: string;
      kind: 'barrier';
      /** solid rect (world px) removed when opened */
      rect: Rect;
      /** anchorable socket that must receive the pulse */
      socket: Vec;
      sig: 'Impact' | 'Wave' | 'Heat' | 'Void' | 'Rotational';
      tone?: number;
      flag: string;
      visual: string;
    };

export interface AreaDef {
  id: string;
  kind: AreaKind;
  region: RegionId;
  nameKey: string;
  /** 16px tiles. solid: '#' rock, 'A' anchor panel, ' ' void. floor: '.', ',' */
  tiles: readonly string[];
  spawns: Record<string, Vec>;
  props: PropDef[];
  exits: ExitDef[];
  interactables: InteractDef[];
  mechs?: MechDef[];
  decor?: { x: number; y: number; frame: 'decal_0' | 'decal_1' | 'decal_2' }[];
  bossId?: string;
  music: string;
}

export const TILE = 16;
export const SOLID_TILES = new Set(['#', 'A', ' ', 'W', 'H']);
export const isSolidTile = (ch: string | undefined): boolean => ch === undefined || SOLID_TILES.has(ch);
export const tileTag = (ch: string): SurfaceTag => (ch === 'A' ? 'Anchorable' : ch === 'H' ? 'HazardAnchor' : 'NonAnchorable');
