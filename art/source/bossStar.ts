// FINAL 닫힌 별 — an eight-pointed iron star clamped shut around the world's heart. Phase A: closed plates;
// B: plates split by anti-phase fissures; C: plates gone, a raw heart held by four bent spikes.
import { P } from '../../src/presentation/art/palette.ts';
import { Mask } from '../lib/mask.ts';
import { sculpt, accents, outline, type Material, type Grid, type Legend } from '../lib/pixel.ts';
import type { FrameDef, SheetDef } from '../lib/sheet.ts';

const MATS: Record<string, Material> = {
  i: { ramp: [P.ink, P.night, P.dusk, P.slate, P.stone, P.ash], round: 0.55, spec: 0.8, crevice: true },
  h: { ramp: [P.rust, P.ember, P.flare, P.wheat, P.bone], round: 1.0 },
  t: { ramp: [P.resoDeep, P.reso, P.resoLite], round: 0.8 },
  d: { ramp: [P.dusk, P.slate, P.stone, P.mist], round: 0.6, spec: 0.7 },
};
const AL: Legend = { k: P.ink, V: P.voidL, v: P.voidD, f: P.flare, b: P.bone, e: P.reso };

function star(stage: number, pulse: boolean): Grid {
  const W = 80;
  const H = 80;
  const m = new Mask(W, H);
  const c = 40;
  const pts = stage === 2 ? 4 : 8;
  for (let k = 0; k < pts; k++) {
    const a = (k / pts) * Math.PI * 2 - Math.PI / 2 + (stage === 2 ? Math.PI / 4 : 0);
    const len = stage === 2 ? 26 : k % 2 === 0 ? 36 : 26;
    const tip: [number, number, number] = [c + Math.cos(a) * len, c + Math.sin(a) * len, 1.2];
    m.stroke('i', [[c + Math.cos(a) * 10, c + Math.sin(a) * 10, stage === 2 ? 3.5 : 6], tip]);
  }
  if (stage < 2) m.ellipse('i', c, c, 16, 16);
  m.ellipse('h', c, c, stage === 2 ? 11 + (pulse ? 1 : 0) : 6, stage === 2 ? 11 + (pulse ? 1 : 0) : 6);
  let g = sculpt(m.rows(), MATS);
  const acc = new Mask(W, H);
  if (stage === 0) {
    // clamped plates: radial seams
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      for (let r = 7; r <= 15; r++) acc.put(Math.round(c + Math.cos(a) * r), Math.round(c + Math.sin(a) * r), 'k');
    }
    acc.put(c, c, 'f');
  } else if (stage === 1) {
    // anti-phase fissures: zigzags across the plates
    for (let x = -14; x <= 14; x++) acc.put(c + x, c + (x % 4 < 2 ? -3 : 3), 'V');
    for (let y = -14; y <= 14; y++) acc.put(c + (y % 4 < 2 ? 3 : -3), c + y, 'v');
  } else {
    acc.put(c - 2, c - 3, 'b');
    acc.put(c - 1, c - 3, 'b');
    acc.put(c - 3, c - 2, 'b');
  }
  g = accents(g, acc.rows(), AL);
  return outline(g);
}

function terminal(lit: boolean): Grid {
  const m = new Mask(16, 16);
  m.ellipse('d', 8, 9, 6, 5);
  m.ellipse('t', 8, 8, 2.5, 2.5);
  let g = sculpt(m.rows(), MATS);
  if (!lit) g = accents(g, ['', '', '', '', '', '', '', '........k', '.......k.k', '........k'], AL);
  return outline(g);
}

function debris(glow: boolean, k: number): Grid {
  const m = new Mask(16, 16);
  m.poly('d', [[3 + k, 5], [12, 2 + k], [14, 10], [6, 14 - k]]);
  let g = sculpt(m.rows(), MATS);
  if (glow) g = accents(g, ['', '', '', '', '', '', '.......e', '......eee', '.......e'], AL);
  return outline(g, glow ? { force: P.reso } : {});
}

export function starSheets(): SheetDef[] {
  const f: FrameDef[] = [];
  for (let s = 0; s < 3; s++) {
    f.push({ name: `star${s}_0`, grid: star(s, false) });
    f.push({ name: `star${s}_1`, grid: star(s, true) });
  }
  const small: FrameDef[] = [
    { name: 'term', grid: terminal(false) },
    { name: 'termLit', grid: terminal(true) },
  ];
  for (let k = 0; k < 3; k++) {
    small.push({ name: `deb${k}`, grid: debris(false, k) });
    small.push({ name: `debLit${k}`, grid: debris(true, k) });
  }
  return [
    { key: 'boss_star', dir: 'sprites', cw: 80, ch: 80, cols: 6, pivot: { x: 40, y: 40 }, align: 'center', frames: f },
    { key: 'star_parts', dir: 'sprites', cw: 16, ch: 16, cols: 8, pivot: { x: 8, y: 8 }, align: 'center', frames: small },
  ];
}
