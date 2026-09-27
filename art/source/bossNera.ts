// B03 거울비늘 네라 — an upright mirror-scaled serpent coiled in the pool. Silhouette: vertical S-coil with a crest
// fan and a long narrow head (very different mass from Gram's boulder and the Humming's dome). All four figures
// share one sprite on purpose; only resonance geometry tells the true body apart.
import { P } from '../../src/presentation/art/palette.ts';
import { Mask } from '../lib/mask.ts';
import { sculpt, accents, outline, flipX, grid, remap, type Material, type Grid, type Legend } from '../lib/pixel.ts';
import type { FrameDef, SheetDef } from '../lib/sheet.ts';

const MATS: Record<string, Material> = {
  s: { ramp: [P.abyss, P.deep, P.tide, P.lake, P.foam], round: 0.9, spec: 0.72 },
  S: { ramp: [P.abyss, P.deep, P.tide, P.lake], round: 0.8 },
  f: { ramp: [P.deep, P.tide, P.lake, P.foam, P.bone], round: 0.4, spec: 0.6 },
  h: { ramp: [P.deep, P.tide, P.lake, P.foam], round: 0.9, spec: 0.7 },
  w: { ramp: [P.deep, P.tide], round: 0.2 },
};
const AL: Legend = { b: P.bone, k: P.ink, O: P.foam, W: P.waveLite, h: P.heatLite, H: P.heat, p: P.pale };

interface Pose {
  sway: number;
  sink: number; // how far into the water
  head: number; // head dy
  swim: boolean;
}

function nera(p: Pose): Grid {
  const W = 48;
  const H = 52;
  const m = new Mask(W, H);
  const base = 46;
  if (p.swim) {
    // horizontal swimming coil
    m.stroke('S', [[6, 40, 3], [14, 37, 4.5], [24, 41, 5.5], [34, 37, 5]]);
    m.stroke('s', [[16, 34, 3.5], [26, 38, 4.5], [34, 33, 4.5], [39, 28, 3.8]]);
    m.ellipse('h', 42, 25, 5.5, 4);
    m.poly('f', [[30, 30], [26, 20], [34, 26]]);
    m.poly('f', [[20, 34], [15, 26], [24, 31]]);
  } else {
    const sw = p.sway;
    const sk = p.sink;
    // lower coil in the water, upright S body, crest fan, narrow head
    m.ellipse('S', 24, base - 2 + sk, 14, 4.5);
    m.stroke('s', [[24 + sw, base - 4 + sk, 6], [18 + sw, base - 14 + sk, 5.5], [26 + sw, base - 23 + sk, 5], [21 + sw, base - 31 + sk, 4.2]]);
    m.poly('f', [[16 + sw, base - 30 + sk], [8 + sw, base - 40 + sk], [13 + sw, base - 26 + sk]]);
    m.poly('f', [[27 + sw, base - 34 + sk], [33 + sw, base - 44 + sk], [30 + sw, base - 30 + sk]]);
    m.poly('f', [[21 + sw, base - 37 + sk], [22 + sw, base - 47 + sk], [25 + sw, base - 36 + sk]]);
    m.ellipse('h', 25 + sw, base - 36 + sk + p.head, 6, 4);
    m.ellipse('h', 30 + sw, base - 35 + sk + p.head, 4, 2.5);
    m.rect('w', 8, base + 1, 32, 2);
  }
  let g = sculpt(m.rows(), MATS);
  const acc = new Mask(W, H);
  if (p.swim) {
    acc.put(44, 24, 'h');
    acc.put(45, 24, 'H');
    for (const [x, y] of [[18, 34], [24, 37], [30, 35], [12, 38]] as const) acc.put(x, y, 'b');
  } else {
    const hx = 27 + p.sway;
    const hy = base - 37 + p.sink + p.head;
    acc.put(hx, hy, 'h');
    acc.put(hx + 1, hy, 'H');
    // mirror-scale glints (clusters, not noise)
    for (const [x, y] of [[20, 30], [21, 30], [26, 22], [18, 14], [19, 14], [25, 8]] as const) acc.put(x + p.sway, base - y + p.sink, 'b');
    for (let x = 10; x < 38; x += 5) acc.put(x, base + 1, 'O');
  }
  g = accents(g, acc.rows(), AL);
  return outline(g);
}

/** vertically mirrored, darkened, checker-dithered water reflection */
function reflection(src: Grid): Grid {
  const r = grid(src.w, 20);
  const dark = remap(src, { [P.bone]: P.lake, [P.foam]: P.tide, [P.lake]: P.deep, [P.tide]: P.deep, [P.pale]: P.tide, [P.heatLite]: P.deep, [P.heat]: P.deep });
  for (let y = 0; y < 20; y++) {
    const sy = src.h - 8 - y * 2;
    if (sy < 0) break;
    for (let x = 0; x < src.w; x++) {
      if ((x + y) % 2 === 1) continue;
      const c = dark.px[sy * src.w + x]!;
      if (c >= 0) r.px[y * src.w + x] = c === P.ink ? P.abyss : c;
    }
  }
  return r;
}

export function neraSheets(): SheetDef[] {
  const f: FrameDef[] = [];
  const add = (name: string, g: Grid) => {
    f.push({ name: `${name}_r`, grid: g });
    f.push({ name: `${name}_l`, grid: flipX(g) });
  };
  const idle0 = nera({ sway: 0, sink: 0, head: 0, swim: false });
  add('idle0', idle0);
  add('idle1', nera({ sway: 1, sink: 0, head: 1, swim: false }));
  add('dive0', nera({ sway: 0, sink: 8, head: 2, swim: false }));
  add('dive1', nera({ sway: -1, sink: 18, head: 3, swim: false }));
  add('swim0', nera({ sway: 0, sink: 0, head: 0, swim: true }));
  add('swim1', nera({ sway: 0, sink: 1, head: 0, swim: true }));
  add('defeat0', nera({ sway: 2, sink: 6, head: 4, swim: false }));
  add('defeat1', nera({ sway: 3, sink: 16, head: 6, swim: false }));
  add('refl', reflection(idle0));
  // mirror shards for a shattered reflection
  const shard = (k: number): Grid => {
    const g = grid(24, 24);
    const pts = [[4, 6], [18, 4], [11, 12], [3, 18], [20, 17], [12, 20]];
    pts.forEach(([x, y], i) => {
      const d = k * 2;
      const px = x! + Math.round((x! - 12) * d * 0.15);
      const py = y! + Math.round((y! - 12) * d * 0.15) + k;
      g.px[py * 24 + px] = i % 2 ? P.foam : P.bone;
      if (k < 2) g.px[py * 24 + px + 1] = P.lake;
    });
    return g;
  };
  for (let k = 0; k < 3; k++) f.push({ name: `shard${k}`, grid: shard(k) });
  return [{ key: 'boss_nera', dir: 'sprites', cw: 48, ch: 52, cols: 12, pivot: { x: 24, y: 48 }, frames: f }];
}
