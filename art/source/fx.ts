// Needles (16 discrete directions — never rotated at runtime) and hand-timed pixel VFX frames.
import { P } from '../../src/presentation/art/palette.ts';
import { grid, set, line, ring, parse, outline, type Grid, type Legend } from '../lib/pixel.ts';
import { anim, type FrameDef, type SheetDef } from '../lib/sheet.ts';

const DIRS = 16;

function needleFlying(i: number): Grid {
  const g = grid(15, 15);
  const a = (i / DIRS) * Math.PI * 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const pt = (t: number) => [Math.round(7 + dx * t), Math.round(7 + dy * t)] as const;
  // shaft
  const [x0, y0] = pt(-5);
  const [x1, y1] = pt(3);
  line(g, x0, y0, x1, y1, P.mist);
  const [xm, ym] = pt(-1);
  line(g, xm, ym, x1, y1, P.pale);
  // tip (bright) and resonance tail
  const [tx, ty] = pt(4);
  const [tx2, ty2] = pt(5);
  set(g, tx, ty, P.resoLite);
  set(g, tx2, ty2, P.bone);
  set(g, x0, y0, P.resoDeep);
  const [xt, yt] = pt(-6);
  set(g, xt, yt, P.reso);
  return g;
}

function needleEmbedded(i: number, lit: boolean): Grid {
  // i = direction the visible part points to (surface normal). base at the cell centre.
  const g = grid(15, 15);
  const a = (i / DIRS) * Math.PI * 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const pt = (t: number) => [Math.round(7 + dx * t), Math.round(7 + dy * t)] as const;
  const [x0, y0] = pt(0);
  const [x1, y1] = pt(5);
  line(g, x0, y0, x1, y1, P.mist);
  const [xa, ya] = pt(2);
  line(g, xa, ya, x1, y1, P.pale);
  const [xe, ye] = pt(6);
  set(g, xe, ye, lit ? P.resoLite : P.pale);
  set(g, x0, y0, lit ? P.reso : P.resoDeep);
  return g;
}

function needleDisabled(i: number): Grid {
  const g = grid(15, 15);
  const a = (i / DIRS) * Math.PI * 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const [x0, y0] = [Math.round(7 - dx * 4), Math.round(7 - dy * 4)];
  const [x1, y1] = [Math.round(7 + dx * 4), Math.round(7 + dy * 4)];
  line(g, x0, y0, x1, y1, P.stone);
  set(g, x1, y1, P.ash);
  return g;
}

// 3x5 glyphs used as needle tags above embedded needles
const LETTERS: Record<string, string[]> = {
  A: ['.b.', 'b.b', 'bbb', 'b.b', 'b.b'],
  B: ['bb.', 'b.b', 'bb.', 'b.b', 'bb.'],
  C: ['.bb', 'b..', 'b..', 'b..', '.bb'],
};

function letter(ch: string, sel: boolean): Grid {
  const g = grid(5, 7);
  const rows = LETTERS[ch]!;
  const legend: Legend = { b: sel ? P.resoLite : P.pale };
  const src = parse(rows, legend);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
    const c = src.px[y * 3 + x]!;
    if (c >= 0) set(g, x + 1, y + 1, c);
  }
  return outline(g, { force: sel ? P.resoDeep : P.ink });
}

function burst(r: number, c1: number, c2: number, spokes: number): Grid {
  const g = grid(17, 17);
  ring(g, 8, 8, r, c1);
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2 + 0.3;
    const x = Math.round(8 + Math.cos(a) * (r + 2));
    const y = Math.round(8 + Math.sin(a) * (r + 2));
    set(g, x, y, c2);
  }
  return g;
}

function spark(f: number): Grid {
  const g = grid(9, 9);
  const L = [
    ['....b....', '....b....', '.........', 'bb.....bb', '.........', '....b....', '....b....'],
    ['....E....', '.........', '..E...E..', '.........', '..E...E..', '.........', '....E....'],
    ['.........', '...e.e...', '.........', '...e.e...', '.........'],
  ][f]!;
  const src = parse(L, { b: P.bone, E: P.resoLite, e: P.reso });
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const c = src.px[y * src.w + x]!;
    if (c >= 0) set(g, x, y + Math.floor((9 - src.h) / 2), c);
  }
  return g;
}

function dust(f: number): Grid {
  const rows = [
    ['..........', '...yy.....', '..yyyo....', '..yooo.yy.', '...oo.yoo.', '.......o..'],
    ['...yy.....', '..yyyo..y.', '.yyooo.yyo', '.yoooo.yoo', '..ooo...o.', '..........'],
    ['..y....y..', '.y.o..y.o.', '..........', '.o....o...', '...o.....o', '..........'],
    ['..........', '.o......o.', '..........', '....o.....', '..........', '..........'],
  ][f]!;
  const g = grid(12, 8);
  const src = parse(rows, { y: P.sand, o: P.ochre });
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const c = src.px[y * src.w + x]!;
    if (c >= 0) set(g, x + 1, y + 1, c);
  }
  return g;
}

function shieldShards(f: number): Grid {
  const g = grid(25, 25);
  const n = 7;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + 0.4;
    const d = 3 + f * 3;
    const x = Math.round(12 + Math.cos(a) * d);
    const y = Math.round(12 + Math.sin(a) * d - f);
    const c = f < 2 ? P.resoLite : f < 3 ? P.reso : P.resoDeep;
    set(g, x, y, c);
    if (f < 3) set(g, x + (k % 2 === 0 ? 1 : 0), y + (k % 2 === 0 ? 0 : 1), f < 1 ? P.bone : P.reso);
  }
  return g;
}

export function fxSheets(): SheetDef[] {
  const nf: FrameDef[] = [];
  for (let i = 0; i < DIRS; i++) nf.push({ name: `fly_${i}`, grid: needleFlying(i) });
  for (let i = 0; i < DIRS; i++) nf.push({ name: `emb_${i}`, grid: needleEmbedded(i, false) });
  for (let i = 0; i < DIRS; i++) nf.push({ name: `embLit_${i}`, grid: needleEmbedded(i, true) });
  for (let i = 0; i < DIRS; i++) nf.push({ name: `dis_${i}`, grid: needleDisabled(i) });

  const fx: FrameDef[] = [];
  for (const ch of ['A', 'B', 'C']) {
    fx.push({ name: `tag_${ch}`, grid: letter(ch, false) });
    fx.push({ name: `tagSel_${ch}`, grid: letter(ch, true) });
  }
  [2, 4, 6, 7].forEach((r, i) => fx.push({ name: `embed_${i}`, grid: burst(r, i < 2 ? P.resoLite : P.reso, P.resoDeep, i < 2 ? 0 : 4) }));
  [3, 5, 7, 8].forEach((r, i) => fx.push({ name: `impact_${i}`, grid: burst(r, i < 2 ? P.flare : P.ember, P.rust, 6) }));
  [2, 5, 7, 8].forEach((r, i) => fx.push({ name: `deliver_${i}`, grid: burst(r, i === 0 ? P.bone : i < 3 ? P.resoLite : P.reso, P.reso, 8) }));
  [2, 4, 6, 7].forEach((r, i) => fx.push({ name: `fizzle_${i}`, grid: burst(r, i < 2 ? P.ash : P.slate, P.stone, 3) }));
  for (let i = 0; i < 3; i++) fx.push({ name: `spark_${i}`, grid: spark(i) });
  for (let i = 0; i < 4; i++) fx.push({ name: `dust_${i}`, grid: dust(i) });
  for (let i = 0; i < 5; i++) fx.push({ name: `shards_${i}`, grid: shieldShards(i) });
  const fxAnims = [
    anim('fx_embed', ['embed_0', 'embed_1', 'embed_2', 'embed_3'], [40, 50, 60, 60], 0),
    anim('fx_impact', ['impact_0', 'impact_1', 'impact_2', 'impact_3'], [40, 60, 70, 70], 0),
    anim('fx_deliver', ['deliver_0', 'deliver_1', 'deliver_2', 'deliver_3'], [40, 60, 70, 90], 0),
    anim('fx_fizzle', ['fizzle_0', 'fizzle_1', 'fizzle_2', 'fizzle_3'], [50, 60, 70, 80], 0),
    anim('fx_spark', ['spark_0', 'spark_1', 'spark_2'], [40, 60, 70], 0),
    anim('fx_dust', ['dust_0', 'dust_1', 'dust_2', 'dust_3'], [70, 90, 110, 120], 0),
    anim('fx_shards', ['shards_0', 'shards_1', 'shards_2', 'shards_3', 'shards_4'], [50, 60, 70, 80, 90], 0),
  ];
  return [
    { key: 'needle', dir: 'sprites', cw: 15, ch: 15, cols: 16, pivot: { x: 7, y: 7 }, align: 'center', frames: nf },
    { key: 'fx', dir: 'fx', cw: 25, ch: 25, cols: 12, pivot: { x: 12, y: 12 }, align: 'center', frames: fx, anims: fxAnims },
  ];
}
