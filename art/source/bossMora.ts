// B04 뿌리기계 모라 — a squat bronze engine swallowed by roots: wide low mass, iris-shuttered heart, two root arms
// built from separate segments (so they can reach anywhere), claw tips that turn into glowing anchors.
import { P } from '../../src/presentation/art/palette.ts';
import { Mask } from '../lib/mask.ts';
import { sculpt, accents, outline, grid, type Material, type Grid, type Legend } from '../lib/pixel.ts';
import type { FrameDef, SheetDef } from '../lib/sheet.ts';

const MATS: Record<string, Material> = {
  b: { ramp: [P.umber, P.rust, P.clay, P.ochre, P.sand], round: 0.6, spec: 0.8 },
  s: { ramp: [P.night, P.dusk, P.slate, P.stone], round: 0.35, crevice: true },
  r: { ramp: [P.umber, P.rust, P.clay], round: 0.9 },
  g: { ramp: [P.pine, P.moss, P.leaf, P.sprout], round: 0.9 },
  i: { ramp: [P.night, P.dusk, P.slate, P.stone, P.ash], round: 0.5, crevice: true },
  c: { ramp: [P.rust, P.ember, P.flare, P.wheat], round: 1.0 },
  t: { ramp: [P.umber, P.rust, P.clay, P.ochre], round: 0.8, spec: 0.85 },
};
const AL: Legend = { e: P.reso, E: P.resoLite, q: P.resoDeep, L: P.lime, z: P.sprout, k: P.ink, f: P.flare, b: P.bone };

function mora(open: boolean, strain: number, pulse: boolean, wither: boolean): Grid {
  const W = 104;
  const H = 72;
  const m = new Mask(W, H);
  const cx = 52;
  const by = 50 - strain;
  // roots anchoring into the floor
  for (const [x0, x1] of [[18, 6], [30, 22], [74, 82], [86, 98]] as const) m.stroke('r', [[x0 + 10, by + 6, 3.5], [x1, 68, 2.2]]);
  // stone plinth + bronze housing
  m.ellipse('s', cx, by + 8, 40, 10);
  m.ellipse('b', cx, by - 10, 34, 22);
  m.ellipse('b', cx - 22, by - 4, 14, 14);
  m.ellipse('b', cx + 22, by - 4, 14, 14);
  // exhaust pipes
  m.rect('t', cx - 26, by - 38, 6, 16);
  m.rect('t', cx + 20, by - 36, 6, 14);
  // wrapping roots
  m.stroke('r', [[cx - 36, by - 18, 3], [cx - 20, by - 30, 3.2], [cx - 2, by - 31, 3], [cx + 14, by - 26, 2.6]]);
  m.stroke('r', [[cx + 36, by - 12, 3], [cx + 24, by - 22, 2.8], [cx + 30, by - 32, 2.2]]);
  m.stroke('r', [[cx - 40, by + 2, 3], [cx - 30, by - 8, 2.6]]);
  // moss clumps
  for (const [x, y, r] of [[cx - 16, by - 30, 5], [cx + 26, by - 28, 4], [cx - 36, by - 6, 4], [cx + 38, by - 2, 4], [cx + 6, by - 33, 3]] as const) m.ellipse('g', x, y, r, r * 0.8);
  // heart iris (closed) or exposed heart
  if (open) {
    m.ellipse('i', cx, by - 4, 12, 11);
    m.ellipse('c', cx, by - 3, 7, 7 + (pulse ? 1 : 0));
  } else {
    m.ellipse('i', cx, by - 4, 12, 11);
  }
  let g = sculpt(m.rows(), MATS);
  const acc = new Mask(W, H);
  // lens eyes
  for (const ex of [cx - 12, cx + 11]) {
    acc.put(ex, by - 20, wither ? 'k' : 'E');
    acc.put(ex + 1, by - 20, wither ? 'k' : 'e');
    acc.put(ex, by - 19, 'q');
  }
  if (!open) {
    // iris blades (radial crevices)
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      for (let r = 3; r <= 10; r++) acc.put(Math.round(cx + Math.cos(ang + r * 0.08) * r), Math.round(by - 4 + Math.sin(ang + r * 0.08) * r * 0.9), 'k');
    }
  } else {
    acc.put(cx - 1, by - 4, 'b');
    acc.put(cx, by - 5, 'b');
    acc.put(cx + 1, by - 3, 'f');
  }
  // vein channels on the housing (lit by the view toward the wanted conduit)
  if (!wither) for (const [x, y] of [[cx - 28, by - 12], [cx - 30, by - 10], [cx + 28, by - 12], [cx + 30, by - 10], [cx, by - 26]] as const) acc.put(x, y, 'z');
  g = accents(g, acc.rows(), AL);
  return outline(g);
}

function segment(k: number): Grid {
  const m = new Mask(12, 12);
  m.ellipse('r', 6, 6, 4.5 - (k % 2) * 0.5, 4);
  if (k % 3 === 0) m.ellipse('g', 4, 4, 2, 1.6);
  return outline(sculpt(m.rows(), MATS));
}

function tip(lit: boolean, open: boolean): Grid {
  const m = new Mask(18, 18);
  m.ellipse('t', 9, 8, 5, 4.5);
  const spread = open ? 3 : 1;
  m.stroke('t', [[6, 11, 1.8], [4 - spread, 16, 1]]);
  m.stroke('t', [[9, 12, 1.8], [9, 17, 1]]);
  m.stroke('t', [[12, 11, 1.8], [14 + spread, 16, 1]]);
  let g = sculpt(m.rows(), MATS);
  if (lit) g = accents(g, ['', '', '', '', '', '', '.......EE', '......EeeE', '.......EE'], AL);
  return outline(g, lit ? { force: P.reso } : {});
}

function terminal(state: 'dead' | 'lit', farEnd: boolean): Grid {
  const m = new Mask(16, 14);
  m.ellipse('s', 8, 9, 7, 4);
  m.rect('t', 6, 2, 4, 7);
  m.ellipse('t', 8, 2, 3, 2);
  let g = sculpt(m.rows(), MATS);
  const acc = new Mask(16, 14);
  if (state === 'lit') {
    acc.put(8, 2, 'E');
    acc.put(7, 5, 'e');
    acc.put(8, 6, 'e');
    for (const [x, y] of [[3, 9], [13, 9], [8, 12]] as const) acc.put(x, y, 'L');
  } else {
    acc.put(8, 2, 'k');
  }
  // machine-side terminals carry an arrow notch (shape channel for flow direction)
  if (!farEnd) {
    acc.put(7, 9, 'k');
    acc.put(8, 10, 'k');
    acc.put(9, 9, 'k');
  }
  g = accents(g, acc.rows(), AL);
  return outline(g);
}

export function moraSheets(): SheetDef[] {
  const f: FrameDef[] = [];
  f.push({ name: 'idle0', grid: mora(false, 0, false, false) });
  f.push({ name: 'idle1', grid: mora(false, 1, false, false) });
  f.push({ name: 'strain0', grid: mora(false, 2, false, false) });
  f.push({ name: 'strain1', grid: mora(false, 3, false, false) });
  f.push({ name: 'open0', grid: mora(true, 0, false, false) });
  f.push({ name: 'open1', grid: mora(true, 1, true, false) });
  f.push({ name: 'defeat0', grid: mora(true, -1, false, true) });
  f.push({ name: 'defeat1', grid: mora(true, -3, false, true) });
  const small: FrameDef[] = [];
  for (let k = 0; k < 3; k++) small.push({ name: `seg${k}`, grid: segment(k) });
  small.push({ name: 'tip', grid: tip(false, false) });
  small.push({ name: 'tipOpen', grid: tip(false, true) });
  small.push({ name: 'tipLit', grid: tip(true, false) });
  small.push({ name: 'tipLitOpen', grid: tip(true, true) });
  for (const st of ['dead', 'lit'] as const) {
    small.push({ name: `term0_${st}`, grid: terminal(st, false) });
    small.push({ name: `term1_${st}`, grid: terminal(st, true) });
  }
  const blank = grid(1, 1);
  small.push({ name: 'blank', grid: blank });
  return [
    { key: 'boss_mora', dir: 'sprites', cw: 104, ch: 72, cols: 8, pivot: { x: 52, y: 66 }, frames: f },
    { key: 'mora_parts', dir: 'sprites', cw: 18, ch: 18, cols: 16, pivot: { x: 9, y: 9 }, align: 'center', frames: small },
  ];
}
