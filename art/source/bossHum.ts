// B02 종루의 허밍 — a hovering bronze bell with organ-pipe crown, hollow singing mouth and trailing cloth ribbons.
// Silhouette: tall bell dome (no legs, floating), radial negative space at the mouth. Pitch is read from the
// waveform glyph + which bell trembles + sound; colour is never the only channel.
import { P } from '../../src/presentation/art/palette.ts';
import { Mask } from '../lib/mask.ts';
import { sculpt, accents, outline, grid, type Material, type Grid, type Legend } from '../lib/pixel.ts';
import type { FrameDef, SheetDef } from '../lib/sheet.ts';

const MATS: Record<string, Material> = {
  b: { ramp: [P.umber, P.rust, P.clay, P.ochre, P.sand, P.wheat], round: 0.85, spec: 0.8 },
  B: { ramp: [P.umber, P.rust, P.clay, P.ochre], round: 0.6, crevice: true },
  m: { ramp: [P.ink, P.night, P.dusk], round: 0.4 },
  p: { ramp: [P.rust, P.clay, P.ochre, P.sand, P.wheat], round: 1.0, spec: 0.7 },
  r: { ramp: [P.voidD, P.voidL], round: 0.3 },
  w: { ramp: [P.dusk, P.slate, P.stone], round: 0.5 },
  c: { ramp: [P.umber, P.rust, P.clay, P.ochre, P.sand], round: 0.9, spec: 0.7 },
};
const AL: Legend = { k: P.ink, W: P.waveLite, v: P.wave, b: P.bone, n: P.night, q: P.resoDeep, e: P.reso, E: P.resoLite, d: P.dusk, h: P.heat };

interface Pose {
  swell: number; // lip widening
  dy: number;
  jit: number; // x jitter (vibration)
  mouth: number; // mouth opening
  open: boolean; // exposed: cracked, clapper gone
  tilt: number; // defeat tilt (shear)
}

function hum(p: Pose): Grid {
  const W = 64;
  const H = 62;
  const m = new Mask(W, H);
  const cx = 32 + p.jit;
  const top = 12 + p.dy;
  // ribbons behind the bell (cloth)
  m.stroke('r', [[cx - 14, top + 30, 1.6], [cx - 20, top + 38, 1.4], [cx - 18, top + 46, 1.2], [cx - 23, top + 52, 1.0]]);
  m.stroke('r', [[cx + 14, top + 30, 1.6], [cx + 21, top + 37, 1.4], [cx + 19, top + 45, 1.2], [cx + 24, top + 50, 1.0]]);
  // organ-pipe crown
  for (const [dx, h] of [[-7, 9], [0, 12], [7, 9]] as const) m.rect('p', cx + dx - 2, top - h + 3, 4, h);
  // bell dome: narrow shoulder, flaring lip
  const pts: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = top + t * 34;
    const hw = 9 + Math.pow(t, 1.8) * (14 + p.swell);
    pts.push([cx + hw, y]);
  }
  for (let i = 12; i >= 0; i--) {
    const t = i / 12;
    const y = top + t * 34;
    const hw = 9 + Math.pow(t, 1.8) * (14 + p.swell);
    pts.push([cx - hw, y]);
  }
  m.poly('b', pts);
  m.ellipse('b', cx, top + 2, 9, 5);
  // lip band + mouth
  m.ellipse('B', cx, top + 34, 23 + p.swell, 4);
  m.ellipse('m', cx, top + 35, 17 + p.swell * 0.7, 2 + p.mouth);
  // clapper inside the mouth (hidden when exposed)
  if (!p.open) {
    m.rect('w', cx - 1, top + 30, 2, 5 + p.mouth);
    m.ellipse('c', cx, top + 37 + p.mouth, 3.5, 3.5);
  }
  let g = sculpt(m.rows(), MATS);
  const acc = new Mask(W, H);
  // eyes (wave-light slits) and rune band
  const eyeY = top + 12;
  for (const ex of [cx - 6, cx + 5]) {
    acc.put(ex, eyeY, p.mouth > 1 ? 'b' : 'W');
    acc.put(ex + 1, eyeY, 'W');
    acc.put(ex, eyeY + 1, 'v');
  }
  for (let x = cx - 14; x <= cx + 14; x += 4) acc.put(x, top + 24, 'd');
  if (p.mouth > 0) for (let x = cx - 12; x <= cx + 12; x += 3) acc.put(x, top + 35, 'W');
  if (p.open) {
    // cracked dome: void light leaking through
    const cr: [number, number][] = [[cx - 3, top + 4], [cx - 2, top + 6], [cx - 3, top + 8], [cx - 1, top + 10], [cx - 2, top + 13], [cx, top + 16], [cx + 4, top + 9], [cx + 5, top + 11], [cx + 4, top + 14]];
    for (const [x, y] of cr) acc.put(x, y, 'W');
    for (let x = cx - 10; x <= cx + 10; x += 2) acc.put(x, top + 36, 'v');
  }
  g = accents(g, acc.rows(), AL);
  if (p.tilt !== 0) {
    // defeat: shear rows (exact pixel shifts, no resampling)
    const s = grid(W, H);
    for (let y = 0; y < H; y++) {
      const off = Math.round(((y - 40) / 40) * p.tilt);
      for (let x = 0; x < W; x++) {
        const c = g.px[y * W + x]!;
        if (c >= 0 && x + off >= 0 && x + off < W) s.px[y * W + x + off] = c;
      }
    }
    g = s;
  }
  return outline(g);
}

function bell(size: number, state: 'idle' | 'ring' | 'wrong' | 'lit', jit: number): Grid {
  const W = 30;
  const H = 34;
  const m = new Mask(W, H);
  const cx = 15 + jit;
  const h = 5 + size * 5;
  const top = H - 6 - h - 4;
  // stand
  m.rect('w', 13, top - 4, 4, 3);
  m.rect('w', 3, H - 4, 24, 3);
  m.rect('w', 4, top - 6, 22, 2);
  m.rect('w', 4, top - 6, 2, H - top + 3);
  m.rect('w', 24, top - 6, 2, H - top + 3);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push([cx + 2 + Math.pow(t, 1.6) * (size * 1.6 + 2), top + t * h]);
  }
  for (let i = 8; i >= 0; i--) {
    const t = i / 8;
    pts.push([cx - 2 - Math.pow(t, 1.6) * (size * 1.6 + 2), top + t * h]);
  }
  m.poly('b', pts);
  m.ellipse('B', cx, top + h, size * 1.6 + 4, 1.6);
  let g = sculpt(m.rows(), MATS);
  const acc = new Mask(W, H);
  if (state === 'lit') for (let x = cx - size - 2; x <= cx + size + 2; x += 2) acc.put(x, top + h - 2, 'E');
  if (state === 'wrong') for (let x = cx - size - 2; x <= cx + size + 2; x += 2) acc.put(x, top + Math.floor(h / 2), 'h');
  if (state === 'ring') {
    acc.put(cx - size * 1.6 - 5, top + h - 3, 'W');
    acc.put(cx + size * 1.6 + 5, top + h - 3, 'W');
    acc.put(cx - size * 1.6 - 6, top + h - 6, 'W');
    acc.put(cx + size * 1.6 + 6, top + h - 6, 'W');
  }
  // pitch marks carved in the stand: 1/2/3 notches = low/mid/high (shape channel)
  for (let k = 0; k < 3 - size; k++) acc.put(8 + k * 3, H - 3, 'k');
  g = accents(g, acc.rows(), AL);
  return outline(g);
}

function clapper(lit: boolean): Grid {
  const m = new Mask(14, 18);
  m.ellipse('w', 7, 2, 2.5, 2);
  m.rect('w', 6, 3, 2, 4);
  m.ellipse('c', 7, 11, 5, 5.5);
  let g = sculpt(m.rows(), MATS);
  if (lit) g = accents(g, ['', '', '', '', '', '', '', '', '......EE......', '.....E..E.....', '.....E..E.....', '......EE......'], AL);
  return outline(g, lit ? { force: P.reso } : {});
}

export function humSheets(): SheetDef[] {
  const f: FrameDef[] = [];
  const base: Pose = { swell: 0, dy: 0, jit: 0, mouth: 0, open: false, tilt: 0 };
  f.push({ name: 'idle0', grid: hum(base) });
  f.push({ name: 'idle1', grid: hum({ ...base, dy: 1 }) });
  f.push({ name: 'inhale0', grid: hum({ ...base, swell: 2, dy: -1 }) });
  f.push({ name: 'inhale1', grid: hum({ ...base, swell: 3, dy: -1, mouth: 1 }) });
  f.push({ name: 'sing0', grid: hum({ ...base, swell: 2, mouth: 3, jit: -1 }) });
  f.push({ name: 'sing1', grid: hum({ ...base, swell: 2, mouth: 3, jit: 1 }) });
  f.push({ name: 'open0', grid: hum({ ...base, open: true, mouth: 2 }) });
  f.push({ name: 'open1', grid: hum({ ...base, open: true, mouth: 2, dy: 1 }) });
  f.push({ name: 'defeat0', grid: hum({ ...base, open: true, mouth: 1, tilt: 3, dy: 3 }) });
  f.push({ name: 'defeat1', grid: hum({ ...base, open: true, mouth: 0, tilt: 6, dy: 7 }) });
  f.push({ name: 'clapper_lit', grid: clapper(true) });
  f.push({ name: 'clapper_dim', grid: clapper(false) });
  const bells: FrameDef[] = [];
  for (let k = 0; k < 3; k++) {
    const size = 2 - k; // bell0 = low = biggest
    bells.push({ name: `bell_${k}_idle`, grid: bell(size + 1, 'idle', 0) });
    bells.push({ name: `bell_${k}_ring`, grid: bell(size + 1, 'ring', 1) });
    bells.push({ name: `bell_${k}_ring1`, grid: bell(size + 1, 'ring', -1) });
    bells.push({ name: `bell_${k}_wrong`, grid: bell(size + 1, 'wrong', 0) });
    bells.push({ name: `bell_${k}_lit`, grid: bell(size + 1, 'lit', 0) });
  }
  return [
    { key: 'boss_hum', dir: 'sprites', cw: 64, ch: 62, cols: 12, pivot: { x: 32, y: 50 }, frames: f },
    { key: 'bells', dir: 'sprites', cw: 30, ch: 34, cols: 15, pivot: { x: 15, y: 33 }, frames: bells },
  ];
}
