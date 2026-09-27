// Runtime view of public/assets/manifest.json (written by `npm run art`).
export interface ManifestAnim {
  key: string;
  frames: string[];
  durations: number[];
  repeat: number;
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
  anims: ManifestAnim[];
}
export interface Manifest {
  hash: string;
  sheets: ManifestSheet[];
}

export interface ResolvedAnim {
  sheet: string;
  frames: number[];
  durations: number[];
  total: number;
  repeat: number;
}

export class AssetIndex {
  private sheets = new Map<string, ManifestSheet>();
  private anims = new Map<string, ResolvedAnim>();
  readonly missing = new Set<string>();
  readonly manifest: Manifest;

  constructor(manifest: Manifest) {
    this.manifest = manifest;
    for (const s of manifest.sheets) {
      this.sheets.set(s.key, s);
      for (const a of s.anims) {
        const frames = a.frames.map((f) => s.frames[f] ?? 0);
        this.anims.set(a.key, { sheet: s.key, frames, durations: a.durations, total: a.durations.reduce((x, y) => x + y, 0), repeat: a.repeat });
      }
    }
  }

  sheet(key: string): ManifestSheet | undefined {
    return this.sheets.get(key);
  }

  has(sheet: string, frame: string): boolean {
    return this.sheets.get(sheet)?.frames[frame] !== undefined;
  }

  frame(sheet: string, frame: string): number {
    const idx = this.sheets.get(sheet)?.frames[frame];
    if (idx === undefined) {
      this.missing.add(`${sheet}/${frame}`);
      return 0;
    }
    return idx;
  }

  anim(key: string): ResolvedAnim | undefined {
    return this.anims.get(key);
  }

  /** frame index of an animation after `ms` milliseconds (loops if repeat = -1, otherwise holds the last frame) */
  animFrame(key: string, ms: number): { sheet: string; frame: number; done: boolean } {
    const a = this.anims.get(key);
    if (!a) {
      this.missing.add(`anim:${key}`);
      return { sheet: 'fx', frame: 0, done: true };
    }
    let t = ms;
    let done = false;
    if (a.repeat === -1) t = ((ms % a.total) + a.total) % a.total;
    else if (ms >= a.total) {
      done = true;
      return { sheet: a.sheet, frame: a.frames[a.frames.length - 1]!, done };
    }
    for (let i = 0; i < a.frames.length; i++) {
      if (t < a.durations[i]!) return { sheet: a.sheet, frame: a.frames[i]!, done };
      t -= a.durations[i]!;
    }
    return { sheet: a.sheet, frame: a.frames[a.frames.length - 1]!, done };
  }
}
