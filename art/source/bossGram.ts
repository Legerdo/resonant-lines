// B01 벽쇄자 그람 — stone-mantled ram. Silhouette language: massive shoulder boulder + forward horn curl, small rump,
// four thick legs. Three rune plates on the back = the three arena seals (they fall off as seals break); the amber
// core crack under them is the only anchorable part and it is shaped/lit differently from the armour.
import { P } from '../../src/presentation/art/palette.ts';
import { Mask } from '../lib/mask.ts';
import { sculpt, accents, outline, flipX, grid, blit, type Material, type Grid, type Legend } from '../lib/pixel.ts';
import type { FrameDef, SheetDef } from '../lib/sheet.ts';

const MATS: Record<string, Material> = {
  h: { ramp: [P.umber, P.rust, P.clay, P.ochre], round: 0.7 },
  H: { ramp: [P.ink, P.umber, P.rust, P.clay], round: 0.7 },
  f: { ramp: [P.rust, P.clay, P.ochre, P.sand], round: 0.8 },
  m: { ramp: [P.dusk, P.slate, P.stone, P.ash, P.mist], round: 0.55, crevice: true },
  n: { ramp: [P.stone, P.ash, P.mist, P.pale, P.bone], round: 0.9, spec: 0.75 },
  p: { ramp: [P.night, P.dusk, P.slate, P.stone, P.ash], round: 0.4, crevice: true },
  c: { ramp: [P.rust, P.ember, P.flare], round: 1.0 },
  k: { ramp: [P.ink, P.night, P.dusk], round: 0.2 },
  s: { ramp: [P.slate, P.stone, P.ash], round: 0.4 },
};

const AL: Legend = { k: P.ink, n: P.night, f: P.flare, F: P.ember, b: P.bone, e: P.reso, E: P.resoLite, q: P.resoDeep, r: P.rust, d: P.dusk };

type Leg = [number, number, number]; // hip x, hoof x, hoof y
interface Pose {
  body: number; // torso dy
  front: number; // shoulders dy
  hx: number; // head dx
  hy: number; // head dy
  legs: [Leg, Leg, Leg, Leg]; // farBack, nearBack, farFront, nearFront
  dust?: boolean;
}

const STAND: Pose['legs'] = [[12, 11, 48], [18, 18, 48], [40, 39, 48], [46, 46, 48]];
const POSES: Record<string, Pose[]> = {
  idle: [
    { body: 0, front: 0, hx: 0, hy: 0, legs: STAND },
    { body: 1, front: 1, hx: 0, hy: 1, legs: STAND },
  ],
  windup: [
    { body: 1, front: 3, hx: -1, hy: 5, legs: [[12, 10, 48], [18, 16, 48], [40, 40, 48], [46, 42, 44]] },
    { body: 1, front: 3, hx: -1, hy: 6, legs: [[12, 10, 48], [18, 16, 48], [40, 40, 48], [46, 49, 48]], dust: true },
  ],
  charge: [
    { body: 0, front: 2, hx: 1, hy: 4, legs: [[12, 5, 47], [18, 12, 48], [40, 47, 46], [46, 53, 48]] },
    { body: -1, front: 1, hx: 1, hy: 3, legs: [[12, 9, 48], [18, 17, 45], [40, 43, 48], [46, 49, 45]] },
    { body: 0, front: 2, hx: 1, hy: 4, legs: [[12, 15, 48], [18, 23, 47], [40, 35, 48], [46, 41, 47]] },
    { body: -1, front: 1, hx: 1, hy: 3, legs: [[12, 11, 45], [18, 19, 48], [40, 39, 45], [46, 47, 48]] },
  ],
  crash: [
    { body: 2, front: 4, hx: -3, hy: 8, legs: [[12, 8, 48], [18, 14, 48], [40, 45, 48], [46, 53, 48]] },
    { body: 2, front: 3, hx: -2, hy: 7, legs: [[12, 8, 48], [18, 14, 48], [40, 45, 48], [46, 52, 48]] },
  ],
  rear: [{ body: -2, front: -8, hx: -2, hy: -10, legs: [[12, 11, 48], [18, 17, 48], [40, 45, 38], [46, 51, 36]] }],
  stomp: [{ body: 2, front: 4, hx: 0, hy: 5, legs: [[12, 10, 48], [18, 17, 48], [40, 41, 48], [46, 48, 48]], dust: true }],
  pinned: [
    { body: 2, front: 2, hx: 0, hy: -2, legs: [[12, 5, 48], [18, 12, 48], [40, 47, 48], [46, 54, 48]] },
    { body: 3, front: 3, hx: 1, hy: 0, legs: [[12, 5, 48], [18, 12, 48], [40, 47, 48], [46, 54, 48]] },
  ],
  defeat: [
    { body: 4, front: 5, hx: -1, hy: 8, legs: [[12, 9, 48], [18, 15, 48], [40, 43, 48], [46, 50, 48]] },
    { body: 8, front: 9, hx: -2, hy: 11, legs: [[12, 7, 48], [18, 13, 48], [40, 45, 48], [46, 52, 48]] },
    { body: 11, front: 12, hx: -3, hy: 13, legs: [[12, 5, 48], [18, 11, 48], [40, 47, 48], [46, 55, 48]] },
  ],
};

function build(p: Pose, plates: number, glow: boolean): Grid {
  const W = 72;
  const H = 52;
  const m = new Mask(W, H);
  const by = 26 + p.body;
  const fy = by + p.front - p.body;
  // far legs (behind the torso, darker hide)
  const legY = (hip: number, front: boolean) => (front ? fy : by) + 8 + (hip > 30 ? 0 : 0);
  const leg = (ch: string, [hip, hx, hyy]: Leg, front: boolean) => {
    const top = legY(hip, front);
    m.stroke(ch, [[hip, top, 3.6], [(hip + hx) / 2, (top + hyy) / 2, 3.0], [hx, hyy - 1, 2.6]]);
    m.rect('k', Math.round(hx) - 3, hyy - 1, 6, 2);
  };
  leg('H', p.legs[0], false);
  leg('H', p.legs[2], true);
  // torso barrel + rump
  m.ellipse('h', 30, by, 20, 11);
  m.ellipse('h', 14, by + 1, 10, 10);
  m.ellipse('h', 40, (by + fy) / 2 + 1, 13, 11);
  // shoulder boulder: the mantle that gives Gram its wall-breaker silhouette
  m.ellipse('m', 39, fy - 9, 14, 9);
  m.ellipse('m', 31, fy - 11, 8, 5);
  m.ellipse('m', 46, fy - 4, 7, 6);
  // head (low, forward) + snout + brow plate
  const hx = 56 + p.hx;
  const hy = fy + 4 + p.hy;
  m.ellipse('f', hx, hy, 8, 7);
  m.ellipse('f', hx + 5, hy + 4, 5, 3.5);
  m.ellipse('m', hx - 1, hy - 5, 7, 3.5);
  // forward horn curl
  m.stroke('n', [[hx - 4, hy - 7, 3.0], [hx + 3, hy - 11, 3.6], [hx + 10, hy - 7, 3.4], [hx + 12, hy + 1, 2.8], [hx + 9, hy + 6, 2.0], [hx + 6, hy + 7, 1.4]]);
  // back rune plates (seal armour) — the core sits under the middle plate
  const plateAt = [[15, by - 9], [23, by - 11], [31, fy - 15]] as const;
  if (plates < 3 || glow) m.ellipse('c', 23, by - 9, 3.5, 2.5);
  for (let k = 0; k < plates; k++) {
    const [px, py] = plateAt[k]!;
    m.ellipse('p', px, py, 4.5, 3.2);
  }
  // near legs over the torso
  leg('h', p.legs[1], false);
  leg('h', p.legs[3], true);
  // stone tail tuft
  m.stroke('m', [[5, by - 3, 2.2], [2, by, 1.6], [2, by + 3, 1.2]]);
  let g = sculpt(m.rows(), MATS);
  // accents: eye, nostril, plate runes, core cracks, boulder fissures
  const acc = new Mask(W, H);
  acc.put(hx + 2, hy - 1, 'f');
  acc.put(hx + 3, hy - 1, 'F');
  acc.put(hx + 9, hy + 4, 'k');
  for (let k = 0; k < plates; k++) {
    const [px, py] = plateAt[k]!;
    acc.put(px - 1, py, 'q');
    acc.put(px, py, glow ? 'E' : 'e');
    acc.put(px + 1, py, 'q');
    acc.put(px, py - 1, 'q');
  }
  if (plates === 0) {
    // exposed core: bright heart crack
    acc.put(22, by - 9, 'b');
    acc.put(23, by - 9, glow ? 'b' : 'f');
    acc.put(24, by - 10, 'f');
    acc.put(21, by - 8, 'f');
  } else if (plates < 3) {
    acc.put(23, by - 9, 'F');
  }
  const fis: [number, number][] = [[36, fy - 13], [37, fy - 12], [37, fy - 11], [44, fy - 8], [45, fy - 7], [30, fy - 12]];
  for (const [x, y] of fis) acc.put(x, y, 'd');
  g = accents(g, acc.rows(), { ...AL, '.': -1 } as Legend);
  if (p.dust) {
    const d = grid(W, H);
    for (const [x, y] of [[50, 47], [53, 46], [55, 48], [48, 49], [57, 47]] as const) d.px[y * W + x] = P.sand;
    blit(g, d, 0, 0);
  }
  return outline(g);
}

export function gramSheets(): SheetDef[] {
  const frames: FrameDef[] = [];
  for (const [pose, list] of Object.entries(POSES)) {
    list.forEach((p, i) => {
      for (let plates = 0; plates <= 3; plates++) {
        const glow = pose === 'pinned' && plates === 0;
        const g = build(p, plates, glow || (plates === 0 && i % 2 === 1));
        frames.push({ name: `${pose}${i}_${plates}_r`, grid: g });
        frames.push({ name: `${pose}${i}_${plates}_l`, grid: flipX(g) });
      }
    });
  }
  // dizzy stars over the head
  const star = (f: number): Grid => {
    const g = grid(20, 8);
    const pts = [[2, 3], [9, 1], [16, 4]];
    pts.forEach(([x, y], i) => {
      const ox = Math.round(Math.sin((f + i * 2) * 1.2) * 2);
      g.px[(y! + 1) * 20 + x! + ox] = P.flare;
      g.px[y! * 20 + x! + ox] = i === f % 3 ? P.bone : P.sand;
    });
    return g;
  };
  for (let i = 0; i < 4; i++) frames.push({ name: `stars_${i}`, grid: star(i) });
  // falling plate fragment
  const frag = sculpt(['..ppp..', '.ppppp.', 'ppppppp', '.ppppp.'], { p: MATS.p! });
  frames.push({ name: 'plate', grid: outline(frag) });
  return [{ key: 'boss_gram', dir: 'sprites', cw: 72, ch: 52, cols: 16, pivot: { x: 36, y: 49 }, frames }];
}
