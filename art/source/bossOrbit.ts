// B07 쌍궤도 아르/오르 — two celestial bodies instead of one creature: a rayed sun (Ar) and a cratered moon (Or) with a
// wave halo. Silhouettes are round but differ in size, halo type (rays vs ring) and surface language.
import { P } from '../../src/presentation/art/palette.ts';
import { Mask } from '../lib/mask.ts';
import { sculpt, accents, outline, grid, set, type Material, type Grid, type Legend } from '../lib/pixel.ts';
import type { FrameDef, SheetDef } from '../lib/sheet.ts';

const MATS: Record<string, Material> = {
  s: { ramp: [P.rust, P.ember, P.flare, P.wheat], round: 1.0, spec: 0.8 },
  m: { ramp: [P.slate, P.stone, P.mist, P.pale, P.bone], round: 1.0, spec: 0.85 },
  b: { ramp: [P.umber, P.rust, P.clay, P.ochre, P.sand], round: 0.6, spec: 0.8 },
  p: { ramp: [P.night, P.dusk, P.slate, P.stone], round: 0.4 },
};
const AL: Legend = { k: P.ink, d: P.dusk, s: P.stone, W: P.waveLite, w: P.wave, f: P.flare, b: P.bone, e: P.reso, E: P.resoLite };

function sun(f: number, dim: boolean): Grid {
  const g = grid(32, 32);
  const m = new Mask(32, 32);
  m.ellipse('s', 16, 16, 9, 9);
  const core = sculpt(m.rows(), MATS);
  for (let i = 0; i < core.px.length; i++) if (core.px[i]! >= 0) g.px[i] = dim ? P.clay : core.px[i]!;
  // rays: 8 spokes, alternating lengths, rotating per frame (motion channel)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + f * 0.2;
    const len = k % 2 === 0 ? 5 : 3;
    for (let r = 11; r < 11 + len; r++) set(g, Math.round(16 + Math.cos(a) * r), Math.round(16 + Math.sin(a) * r), r < 13 ? P.flare : P.ember);
  }
  return outline(g);
}

function moon(f: number): Grid {
  const g = grid(28, 28);
  const m = new Mask(28, 28);
  m.ellipse('m', 14, 14, 8, 8);
  let body = sculpt(m.rows(), MATS);
  body = accents(body, ['', '', '', '', '', '', '', '', '...........s.s', '..........s...', '.............s', '', '.........s..', '........s.s'], AL);
  for (let i = 0; i < body.px.length; i++) if (body.px[i]! >= 0) g.px[i] = body.px[i]!;
  // wave halo ring (dashed, rotates)
  const r = 11;
  for (let k = 0; k < 28; k++) {
    if ((k + f) % 4 >= 2) continue;
    const a = (k / 28) * Math.PI * 2;
    set(g, Math.round(14 + Math.cos(a) * r), Math.round(14 + Math.sin(a) * r * 0.85), P.waveLite);
  }
  return outline(g);
}

function pedestal(lit: boolean): Grid {
  const m = new Mask(34, 26);
  m.ellipse('p', 17, 20, 14, 5);
  m.rect('p', 13, 8, 8, 12);
  m.ellipse('b', 17, 8, 9, 3);
  let g = sculpt(m.rows(), MATS);
  const acc = new Mask(34, 26);
  // armillary rings
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    acc.put(Math.round(17 + Math.cos(a) * 12), Math.round(7 + Math.sin(a) * 4), 'd');
  }
  acc.put(17, 7, lit ? 'E' : 'e');
  acc.put(16, 7, 'e');
  acc.put(18, 7, 'e');
  g = accents(g, acc.rows(), AL);
  return outline(g);
}

export function orbitSheets(): SheetDef[] {
  const f: FrameDef[] = [];
  for (let k = 0; k < 4; k++) f.push({ name: `ar${k}`, grid: sun(k, false) });
  f.push({ name: 'arDim', grid: sun(0, true) });
  for (let k = 0; k < 4; k++) f.push({ name: `or${k}`, grid: moon(k) });
  f.push({ name: 'pedestal', grid: pedestal(false) });
  f.push({ name: 'pedestalLit', grid: pedestal(true) });
  return [{ key: 'boss_orbit', dir: 'sprites', cw: 34, ch: 32, cols: 11, pivot: { x: 17, y: 16 }, align: 'center', frames: f }];
}
