// B05 역조의 눈 — a colossal eye set in the basin wall: wide horizontal almond, heavy lids with rune sockets, tear duct
// on the left. No limbs at all (unique silhouette); the pupil is a separate sprite so it can follow the player.
import { P } from '../../src/presentation/art/palette.ts';
import { Mask } from '../lib/mask.ts';
import { sculpt, accents, outline, grid, type Material, type Grid, type Legend } from '../lib/pixel.ts';
import type { FrameDef, SheetDef } from '../lib/sheet.ts';

const MATS: Record<string, Material> = {
  s: { ramp: [P.night, P.dusk, P.slate, P.stone], round: 0.4, crevice: true },
  l: { ramp: [P.abyss, P.deep, P.tide, P.lake], round: 0.9 },
  w: { ramp: [P.mist, P.pale, P.bone], round: 0.8 },
  v: { ramp: [P.deep, P.tide], round: 0.2 },
};
const AL: Legend = { e: P.reso, E: P.resoLite, q: P.resoDeep, k: P.ink, h: P.heat, r: P.heatLite, O: P.foam };

function eye(close: number, torn: number, open: boolean): Grid {
  const W = 72;
  const H = 46;
  const m = new Mask(W, H);
  const cx = 36;
  const cy = 22;
  // stone socket in the wall
  m.ellipse('s', cx, cy, 34, 20);
  // sclera almond
  m.ellipse('w', cx, cy, 24, open ? 13 : 11);
  // lids (close = 0..1)
  const lid = Math.round((open ? 0 : 11) * close);
  if (lid > 0) {
    m.ellipse('l', cx, cy - 12 + lid * 0.9, 25, lid + 2, 'w');
    m.ellipse('l', cx, cy + 12 - lid * 0.6, 25, Math.max(1, lid * 0.7), 'w');
  }
  // heavy lid rims
  m.stroke('l', [[cx - 25, cy, 2], [cx - 14, cy - 12, 3], [cx, cy - 14, 3.2], [cx + 14, cy - 12, 3], [cx + 25, cy, 2]]);
  m.stroke('l', [[cx - 25, cy, 2], [cx - 12, cy + 11, 2.6], [cx, cy + 13, 2.8], [cx + 12, cy + 11, 2.6], [cx + 25, cy, 2]]);
  // tear duct
  m.ellipse('l', cx - 26, cy + 2, 4, 3.5);
  let g = sculpt(m.rows(), MATS);
  const acc = new Mask(W, H);
  // veins in the sclera
  for (const [x, y] of [[cx - 16, cy - 3], [cx - 15, cy - 2], [cx - 14, cy - 2], [cx + 15, cy + 3], [cx + 16, cy + 2], [cx + 17, cy + 2]] as const) acc.put(x, y, 'r');
  // rune sockets (lidUp, lidLow, duct) — torn ones go dark
  const runes: [number, number][] = [[cx, cy - 14], [cx, cy + 13], [cx - 26, cy + 2]];
  runes.forEach(([x, y], i) => {
    const dead = i < torn;
    acc.put(x, y, dead ? 'k' : 'E');
    acc.put(x - 1, y, dead ? 'k' : 'q');
    acc.put(x + 1, y, dead ? 'k' : 'q');
  });
  g = accents(g, acc.rows(), AL);
  return outline(g);
}

function pupil(dilate: number, glow: boolean): Grid {
  const m = new Mask(22, 22);
  m.ellipse('v', 11, 11, 8, 8);
  let g = sculpt(m.rows(), { v: { ramp: [P.deep, P.tide, P.wave], round: 0.8 } });
  const acc = new Mask(22, 22);
  for (let y = -dilate; y <= dilate; y++) for (let x = -dilate; x <= dilate; x++) if (x * x + y * y <= dilate * dilate) acc.put(11 + x, 11 + y, 'k');
  acc.put(9, 8, glow ? 'E' : 'O');
  acc.put(8, 9, 'O');
  g = accents(g, acc.rows(), AL);
  return outline(g);
}

function raft(k: number): Grid {
  const m = new Mask(24, 16);
  m.ellipse('l', 12, 9, 10, 5.5);
  m.ellipse('v', 12, 10, 3, 2);
  let g = sculpt(m.rows(), { l: { ramp: [P.pine, P.moss, P.leaf, P.sprout], round: 0.8 }, v: { ramp: [P.abyss, P.deep], round: 0.2 } });
  const acc = new Mask(24, 16);
  // leaf veins + a carved resonance ring = anchor point
  acc.put(12, 9, 'q');
  acc.put(11, 10, 'e');
  acc.put(13, 10, 'e');
  for (let x = 4 + k; x < 20; x += 5) acc.put(x, 7, 'O');
  g = accents(g, acc.rows(), AL);
  return outline(g);
}

export function eyeSheets(): SheetDef[] {
  const f: FrameDef[] = [];
  for (let torn = 0; torn <= 3; torn++) {
    f.push({ name: `watch_${torn}`, grid: eye(0.15, torn, false) });
    f.push({ name: `blink_${torn}`, grid: eye(0.8, torn, false) });
  }
  f.push({ name: 'open_3', grid: eye(0, 3, true) });
  f.push({ name: 'defeat_3', grid: eye(1, 3, false) });
  const small: FrameDef[] = [];
  small.push({ name: 'pupil0', grid: pupil(2, false) });
  small.push({ name: 'pupil1', grid: pupil(4, false) });
  small.push({ name: 'pupilGlow', grid: pupil(5, true) });
  for (let k = 0; k < 3; k++) small.push({ name: `raft${k}`, grid: raft(k) });
  const ripple = grid(1, 1);
  small.push({ name: 'dot', grid: ripple });
  return [
    { key: 'boss_eye', dir: 'sprites', cw: 72, ch: 46, cols: 10, pivot: { x: 36, y: 22 }, align: 'center', frames: f },
    { key: 'eye_parts', dir: 'sprites', cw: 24, ch: 22, cols: 8, pivot: { x: 12, y: 11 }, align: 'center', frames: small },
  ];
}
