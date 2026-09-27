import type { Grid } from './pixel.ts';

export interface FrameDef {
  name: string;
  grid: Grid;
}

export interface AnimDef {
  key: string;
  frames: string[];
  /** per-frame duration in ms (same length as frames) */
  durations: number[];
  repeat: number; // -1 loop, 0 once
}

export interface SheetDef {
  key: string;
  dir: 'sprites' | 'tiles' | 'fx' | 'ui';
  cw: number;
  ch: number;
  cols?: number;
  /** pivot inside a cell, in pixels (feet / anchor point) */
  pivot?: { x: number; y: number };
  /** how frames smaller than the cell are placed (default bottom-centre) */
  align?: 'bottom' | 'center';
  frames: FrameDef[];
  anims?: AnimDef[];
}

export function anim(key: string, frames: string[], ms: number | number[], repeat = -1): AnimDef {
  const durations = Array.isArray(ms) ? ms : frames.map(() => ms);
  if (durations.length !== frames.length) throw new Error(`anim ${key}: durations mismatch`);
  return { key, frames, durations, repeat };
}
