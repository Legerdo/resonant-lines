// B06 재굴착자 브락 — a stocky digger with a spiral-grooved drill snout and shovel claws. Silhouette: a wedge (drill)
// leading a low hunched hump; underground only a cracked mound shows.
import { P } from '../../src/presentation/art/palette.ts';
import { Mask } from '../lib/mask.ts';
import { sculpt, accents, outline, flipX, type Material, type Grid, type Legend } from '../lib/pixel.ts';
import type { FrameDef, SheetDef } from '../lib/sheet.ts';

const MATS: Record<string, Material> = {
  f: { ramp: [P.umber, P.rust, P.clay, P.ochre], round: 0.9 },
  d: { ramp: [P.dusk, P.slate, P.stone, P.ash, P.mist, P.pale], round: 0.7, spec: 0.7 },
  c: { ramp: [P.night, P.dusk, P.slate, P.stone], round: 0.6 },
  m: { ramp: [P.rust, P.clay, P.ochre, P.sand], round: 0.7 },
  k: { ramp: [P.rust, P.ember, P.flare], round: 1 },
};
const AL: Legend = { k: P.ink, f: P.flare, F: P.ember, b: P.bone, d: P.dusk, e: P.reso };

function brak(spin: number, jam: boolean, sink: number): Grid {
  const W = 60;
  const H = 48;
  const m = new Mask(W, H);
  const gy = 42 + sink;
  // hunched body + belly
  m.ellipse('f', 24, gy - 14, 18, 13);
  m.ellipse('f', 14, gy - 10, 10, 9);
  // shovel claws
  m.poly('c', [[30, gy - 6], [40, gy - 2], [34, gy + 1], [26, gy - 2]]);
  m.poly('c', [[12, gy - 4], [20, gy], [14, gy + 2], [7, gy - 1]]);
  // drill cone (points right)
  m.poly('d', [[36, gy - 26], [58, gy - 15], [36, gy - 5]]);
  m.ellipse('d', 37, gy - 15, 4, 11);
  if (jam) m.ellipse('k', 30, gy - 24, 4, 3);
  let g = sculpt(m.rows(), MATS);
  const acc = new Mask(W, H);
  // spiral grooves shift with spin (motion read without colour)
  for (let k = 0; k < 4; k++) {
    const x0 = 39 + ((k * 5 + spin * 2) % 18);
    const t = (x0 - 36) / 22;
    const half = Math.round(10 * (1 - t));
    for (let y = -half; y <= half; y += 2) acc.put(x0 + Math.round((y / (half || 1)) * 1.5), gy - 15 + y, 'd');
  }
  // tiny eyes (it barely needs them)
  acc.put(33, gy - 21, 'k');
  acc.put(32, gy - 21, 'f');
  if (jam) {
    acc.put(30, gy - 24, 'b');
    acc.put(29, gy - 25, 'f');
  }
  // fur tufts
  for (const [x, y] of [[12, gy - 22], [18, gy - 26], [24, gy - 27]] as const) acc.put(x, y, 'F');
  g = accents(g, acc.rows(), AL);
  return outline(g);
}

function mound(f: number): Grid {
  const m = new Mask(28, 14);
  m.ellipse('m', 14, 9, 11 + (f % 2), 4.5);
  let g = sculpt(m.rows(), MATS);
  const acc = new Mask(28, 14);
  const cracks: [number, number][] = [[8, 7], [9, 8], [10, 8], [18, 6], [19, 7], [14, 5], [14, 6], [20, 9], [7, 10]];
  cracks.slice(0, 5 + (f % 3) * 2).forEach(([x, y]) => acc.put(x, y, 'k'));
  g = accents(g, acc.rows(), AL);
  return outline(g);
}

export function brakSheets(): SheetDef[] {
  const f: FrameDef[] = [];
  const add = (name: string, g: Grid) => {
    f.push({ name: `${name}_r`, grid: g });
    f.push({ name: `${name}_l`, grid: flipX(g) });
  };
  for (let s = 0; s < 3; s++) add(`surface${s}`, brak(s, false, 0));
  add('jam0', brak(0, true, 0));
  add('jam1', brak(1, true, 1));
  add('defeat0', brak(0, true, 4));
  add('defeat1', brak(0, true, 9));
  for (let k = 0; k < 3; k++) f.push({ name: `mound${k}`, grid: mound(k) });
  return [{ key: 'boss_brak', dir: 'sprites', cw: 60, ch: 48, cols: 12, pivot: { x: 30, y: 44 }, frames: f }];
}
