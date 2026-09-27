// Pure sheet builder shared by the exporter script and the asset freshness test.
import { rgbaOf } from '../../src/presentation/art/palette.ts';
import type { SheetDef } from './sheet.ts';

export interface BuiltSheet {
  def: SheetDef;
  width: number;
  height: number;
  cols: number;
  rgba: Uint8Array;
  frameIndex: Record<string, number>;
  colors: number;
}

export interface ManifestSheet {
  key: string;
  url: string;
  cw: number;
  ch: number;
  cols: number;
  count: number;
  pivot: { x: number; y: number };
  frames: Record<string, number>;
  anims: { key: string; frames: string[]; durations: number[]; repeat: number }[];
}

export interface Manifest {
  hash: string;
  sheets: ManifestSheet[];
}

export function buildSheet(def: SheetDef): BuiltSheet {
  const count = def.frames.length;
  if (count === 0) throw new Error(`sheet ${def.key} has no frames`);
  const cols = def.cols ?? Math.max(1, Math.min(count, Math.floor(2048 / def.cw)));
  const rows = Math.ceil(count / cols);
  const width = cols * def.cw;
  const height = rows * def.ch;
  const rgba = new Uint8Array(width * height * 4);
  const frameIndex: Record<string, number> = {};
  const used = new Set<number>();
  def.frames.forEach((f, i) => {
    if (frameIndex[f.name] !== undefined) throw new Error(`duplicate frame ${f.name} in ${def.key}`);
    frameIndex[f.name] = i;
    if (f.grid.w > def.cw || f.grid.h > def.ch) {
      throw new Error(`frame ${def.key}/${f.name} is ${f.grid.w}x${f.grid.h}, cell is ${def.cw}x${def.ch}`);
    }
    const cx = (i % cols) * def.cw + Math.floor((def.cw - f.grid.w) / 2);
    const cy = Math.floor(i / cols) * def.ch + (def.align === 'center' ? Math.floor((def.ch - f.grid.h) / 2) : def.ch - f.grid.h);
    for (let y = 0; y < f.grid.h; y++) {
      for (let x = 0; x < f.grid.w; x++) {
        const c = f.grid.px[y * f.grid.w + x]!;
        if (c < 0) continue;
        used.add(c);
        const [r, g, b] = rgbaOf(c);
        const o = ((cy + y) * width + (cx + x)) * 4;
        rgba[o] = r;
        rgba[o + 1] = g;
        rgba[o + 2] = b;
        rgba[o + 3] = 255;
      }
    }
  });
  for (const a of def.anims ?? []) {
    for (const fr of a.frames) if (frameIndex[fr] === undefined) throw new Error(`anim ${a.key} references missing frame ${fr}`);
  }
  return { def, width, height, cols, rgba, frameIndex, colors: used.size };
}

function fnv(hash: number, bytes: Uint8Array | string): number {
  let h = hash >>> 0;
  if (typeof bytes === 'string') {
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
  } else {
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i]!;
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  return h;
}

export function buildManifest(built: BuiltSheet[]): Manifest {
  let h = 2166136261;
  const sheets: ManifestSheet[] = built.map((b) => {
    h = fnv(h, b.def.key);
    h = fnv(h, b.rgba);
    return {
      key: b.def.key,
      url: `assets/${b.def.dir}/${b.def.key}.png`,
      cw: b.def.cw,
      ch: b.def.ch,
      cols: b.cols,
      count: b.def.frames.length,
      pivot: b.def.pivot ?? { x: Math.floor(b.def.cw / 2), y: b.def.ch - 1 },
      frames: b.frameIndex,
      anims: (b.def.anims ?? []).map((a) => ({ key: a.key, frames: a.frames, durations: a.durations, repeat: a.repeat })),
    };
  });
  return { hash: h.toString(16).padStart(8, '0'), sheets };
}
