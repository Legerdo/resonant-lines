// B08 무언의 왕관 — an empty crown floating over a trailing void veil. Silhouette: open ring with five tall prongs
// (negative space in the middle), no body. The gem under the band is the socket; the prong tips are the riders' perch.
import { P } from '../../src/presentation/art/palette.ts';
import { Mask } from '../lib/mask.ts';
import { sculpt, accents, outline, type Material, type Grid, type Legend } from '../lib/pixel.ts';
import type { FrameDef, SheetDef } from '../lib/sheet.ts';

const MATS: Record<string, Material> = {
  g: { ramp: [P.rust, P.clay, P.ochre, P.sand, P.wheat], round: 0.8, spec: 0.75 },
  v: { ramp: [P.ink, P.voidD, P.voidL], round: 0.5 },
  j: { ramp: [P.resoDeep, P.reso, P.resoLite], round: 1 },
};
const AL: Legend = { k: P.ink, V: P.voidL, e: P.reso, E: P.resoLite, f: P.flare, W: P.waveLite, b: P.bone };

function crown(prongSpread: number, tilt: number, veil: number, blade: boolean, gemCol: string): Grid {
  const W = 56;
  const H = 60;
  const m = new Mask(W, H);
  const cx = 28;
  const by = 26 + tilt;
  // void veil trailing below
  m.poly('v', [[cx - 12, by + 4], [cx + 12, by + 4], [cx + 8 + veil, by + 26], [cx + 2, by + 32 - veil], [cx - 4, by + 28], [cx - 10 - veil, by + 22]]);
  // band (open ring seen at an angle)
  m.ellipse('g', cx, by, 16, 6);
  m.ellipse('v', cx, by - 1, 11, 3, 'g');
  // prongs
  const spread = [-14, -7, 0, 7, 14];
  spread.forEach((dx, i) => {
    const h = i === 2 ? 20 : i % 2 === 1 ? 15 : 12;
    const x = cx + dx * (1 + prongSpread * 0.08);
    m.stroke('g', [[cx + dx, by - 3, 2.4], [x, by - 3 - h, 1.2]]);
    m.ellipse('g', x, by - 4 - h, 1.8, 1.8);
  });
  if (blade) m.stroke('v', [[cx + 16, by, 2], [cx + 27, by + 6, 1.4], [cx + 27, by + 12, 0.8]]);
  // gem socket under the band
  m.ellipse('j', cx, by + 7, 4, 3.5);
  let g = sculpt(m.rows(), MATS);
  const acc = new Mask(W, H);
  acc.put(cx - 1, by + 6, gemCol);
  acc.put(cx, by + 6, 'b');
  for (const dx of [-11, 11]) acc.put(cx + dx, by + 1, 'k');
  g = accents(g, acc.rows(), AL);
  return outline(g);
}

export function crownSheets(): SheetDef[] {
  const f: FrameDef[] = [];
  const add = (name: string, g: Grid) => f.push({ name, grid: g });
  add('idle0', crown(0, 0, 0, false, 'e'));
  add('idle1', crown(0, 1, 2, false, 'e'));
  add('tell_cut0', crown(1, 0, 1, true, 'V'));
  add('tell_cut1', crown(2, -1, 3, true, 'V'));
  add('tell_press0', crown(-1, 3, 0, false, 'f'));
  add('tell_press1', crown(-2, 5, 1, false, 'f'));
  add('tell_eject0', crown(4, -1, 2, false, 'W'));
  add('tell_eject1', crown(6, -2, 3, false, 'W'));
  add('tell_shards0', crown(1, 0, 1, false, 'e'));
  add('tell_shards1', crown(2, 0, 2, false, 'e'));
  add('open0', crown(2, 0, 1, false, 'E'));
  add('open1', crown(3, 0, 3, false, 'b'));
  add('defeat0', crown(-3, 6, 4, false, 'k'));
  add('defeat1', crown(-5, 12, 6, false, 'k'));
  return [{ key: 'boss_crown', dir: 'sprites', cw: 56, ch: 60, cols: 14, pivot: { x: 28, y: 33 }, align: 'center', frames: f }];
}
