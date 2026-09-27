import type Phaser from 'phaser';
import type { AssetIndex } from '../assets.ts';
import type { SpritePool } from '../spritePool.ts';
import type { PixelLayer } from '../pixelLayer.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { LinkDrawOptions } from '../links.ts';

export interface ViewCtx {
  scene: Phaser.Scene;
  assets: AssetIndex;
  pool: SpritePool;
  under: PixelLayer;
  over: PixelLayer;
  sim: Sim;
  time: number;
  frame: number;
  opts: LinkDrawOptions;
}

/** depth for y-sorted world sprites */
export const ySort = (y: number): number => 1000 + Math.round(y);

export type BossViewFn = (ctx: ViewCtx) => void;
