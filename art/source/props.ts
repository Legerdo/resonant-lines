// Area props. Masks are hand-authored per pixel; `sculpt` quantises directional light onto each material ramp,
// accents (runes, cracks, glints, flames) are placed by hand on top. Every prop ends with the 1px sel-out outline.
import { P } from '../../src/presentation/art/palette.ts';
import { grid, parse, blit, outline, sculpt, accents, remap, flipX, set, type Grid, type Legend, type Material } from '../lib/pixel.ts';
import type { FrameDef, SheetDef } from '../lib/sheet.ts';

const STONE: Material = { ramp: [P.dusk, P.slate, P.stone, P.ash, P.mist], round: 0.45 };
const DARKSTONE: Material = { ramp: [P.night, P.dusk, P.slate, P.stone], round: 0.5 };
const SAND: Material = { ramp: [P.rust, P.clay, P.ochre, P.sand, P.wheat], round: 0.45 };
const BRONZE: Material = { ramp: [P.umber, P.rust, P.clay, P.ochre, P.sand], round: 0.7, spec: 0.8 };
const MOSS: Material = { ramp: [P.pine, P.moss, P.leaf, P.sprout], round: 0.9 };
const GLASS: Material = { ramp: [P.deep, P.tide, P.lake, P.foam], round: 0.3, spec: 0.55 };
const WOOD: Material = { ramp: [P.umber, P.rust, P.clay, P.ochre], round: 0.35 };
const BARK: Material = { ramp: [P.umber, P.rust, P.clay], round: 0.6 };

const A: Legend = {
  k: P.ink, n: P.night, d: P.dusk, s: P.slate, t: P.stone, a: P.ash, m: P.mist, p: P.pale, b: P.bone,
  u: P.umber, r: P.rust, c: P.clay, o: P.ochre, y: P.sand, w: P.wheat,
  e: P.reso, E: P.resoLite, q: P.resoDeep, f: P.flare, F: P.ember, h: P.heat, H: P.heatLite,
  g: P.moss, l: P.leaf, z: P.sprout, L: P.lime, i: P.pine, x: P.forest,
  D: P.deep, T: P.tide, K: P.lake, O: P.foam, v: P.voidD, V: P.voidL, W: P.wave, X: P.waveLite,
};

const fin = (g: Grid): Grid => outline(g);

// ---------------------------------------------------------------- B01 seal monoliths (faces: S, E, N)
const MONO_MASK = [
  '.....sssssss......',
  '....sssssssss.....',
  '...sssssssssss....',
  '...sssssssssss....',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '..ssssssssssssss..',
  '.ssssssssssssssss.',
  '.ssssssssssssssss.',
  'bbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbb',
  '.bbbbbbbbbbbbbbbb.',
];
const MONO_MATS = { s: SAND, b: { ramp: [P.umber, P.rust, P.clay, P.ochre], round: 0.2 } as Material };

// carved faces (hand accents): glowing groove on the face side, strata lines everywhere
const STRATA = [
  '..................', '..................', '..................', '..................', '..................',
  '...rrr.......rr...', '..................', '..................', '..........rrr.....', '..................',
  '..................', '....rr............', '..................', '..................', '...........rr.....',
  '..................', '..................', '.....rrr..........',
];
const FACE_S = [
  '..................', '..................', '..................', '..................', '..................',
  '..................', '......kqqk........', '.....kqeeqk.......', '.....qeEEeq.......', '.....qeEEeq.......',
  '.....kqeeqk.......', '......kqqk........', '.......qq.........', '.......qq.........', '......q..q........',
  '.....q....q.......', '....q......q......',
];
const FACE_E = [
  '..................', '..................', '..................', '..................', '..................',
  '..................', '.............kq...', '............kqek..', '............qeEq..', '............qeEq..',
  '............kqek..', '.............kq...', '..........qqq.....', '.........q........', '........q.........',
];
const FACE_N = [
  '..................', '.......kqqk.......', '......kqeeqk......', '......qeEEeq......', '......kqeeqk......',
  '.......kqqk.......', '........q.........', '........q.........', '.........q........',
];

function monolith(face: string[], state: 'intact' | 'flash' | 'broken'): Grid {
  let g = sculpt(MONO_MASK, MONO_MATS);
  g = accents(g, STRATA, A);
  if (state === 'broken') {
    const crack = [
      '..................', '.......k..........', '.......kk.........', '........k.........', '........kk........', '.........k........',
      '........kk........', '........k.........', '.......kk.........', '.......k..........', '......kk..........', '.......k..........',
      '.......kk.........', '........k.........', '........kk........', '.........k........', '.........k........', '........kk........',
      '........k.........',
    ];
    g = accents(g, crack, A);
    g = remap(g, { [P.wheat]: P.sand, [P.sand]: P.ochre });
    g = accents(g, face.map((r) => r.replace(/[eE]/g, 's').replace(/q/g, 'd')), A);
  } else if (state === 'flash') {
    g = accents(g, face.map((r) => r.replace(/[eq]/g, 'E').replace(/k/g, 'e')), A);
  } else g = accents(g, face, A);
  const out = grid(20, 26);
  blit(out, g, 1, 1);
  return fin(out);
}

// ---------------------------------------------------------------- generic posts per region (anchorable)
const POST_MASK = ['..sssss..', '.sssssss.', '.sssssss.', '.sssssss.', '.sssssss.', '.sssssss.', '.sssssss.', '.sssssss.', '.sssssss.', '.sssssss.', '.sssssss.', '.sssssss.', '.sssssss.', 'bbbbbbbbb', '.bbbbbbb.'];
const POST_RUNE = ['.........', '.........', '...kqk...', '...qeq...', '...qEq...', '...qeq...', '...kqk...', '.........'];
function post(mat: Material, base: Material, extra?: string[]): Grid {
  let g = sculpt(POST_MASK, { s: mat, b: base });
  g = accents(g, POST_RUNE, A);
  if (extra) g = accents(g, extra, A);
  const out = grid(11, 17);
  blit(out, g, 1, 1);
  return fin(out);
}

// ---------------------------------------------------------------- hub props
const PILLAR_MASK = [
  '..bbbbbbbbbb..', '.bbbbbbbbbbbb.', '..ssssssssss..', '..ssssssssss..', '..ssssssssss..', '..ssssssssss..', '..ssssssssss..',
  '..ssssssssss..', '..ssssssssss..', '..ssssssssss..', '..ssssssssss..', '..ssssssssss..', '..ssssssssss..', '..ssssssssss..',
  '..ssssssssss..', '..ssssssssss..', '..ssssssssss..', '..ssssssssss..', '..ssssssssss..', '..ssssssssss..', '..ssssssssss..',
  '..ssssssssss..', '..ssssssssss..', '.bbbbbbbbbbbb.', 'bbbbbbbbbbbbbb', 'bbbbbbbbbbbbbb',
];
const PILLAR_ACC = [
  '..............', '..............', '..............', '..............', '...k..k..k....', '...k..k..k....', '...k..k..k....',
  '...k..k..k....', '..qqqqqqqqqq..', '..qeeeeeeeeq..', '..qqqqqqqqqq..', '...k..k..k....', '...k..k..k....', '...k..k..k....',
  '...k..k..k....', '...k..k..k....', '...k..k..k....', '...k..k..k....', '...k..k..k....', '...k..k..k....',
];

const LAMP = (flame: string[]): Grid => {
  const body = [
    '...kddk...', '...dsad...', '..kdsadk..', '...dssd...', '...ksak...', '....dd....', '....ds....', '....ds....', '....ds....',
    '....ds....', '...dssd...', '..dssssd..', '..kddddk..',
  ];
  const g = grid(12, 22);
  blit(g, parse(flame, A), 1, 0);
  blit(g, parse(body, A), 1, 8);
  return fin(g);
};
const FLAMES = [
  ['....E.....', '...EeE....', '...eEe....', '..qeEeq...', '..qeEEq...', '...qeq....', '....q.....', '..........'],
  ['...E......', '...EE.....', '..eEeE....', '..qeEeq...', '..qeEEq...', '...qeq....', '....q.....', '..........'],
  ['.....E....', '....EE....', '...eEee...', '..qeEEq...', '..qeEeq...', '...qeq....', '....q.....', '..........'],
  ['....E.....', '....E.....', '...eEe....', '..qeEEq...', '..qEEeq...', '...qeq....', '....q.....', '..........'],
];

function altar(): Grid {
  const mask = [
    '....ssssssssssssssss....', '..ssssssssssssssssssss..', '.ssssssssssssssssssssss.', '.ssssssssssssssssssssss.', '..bbbbbbbbbbbbbbbbbbbb..',
    '....bbbbbbbbbbbbbbbb....', '....bbbbbbbbbbbbbbbb....', '....bbbbbbbbbbbbbbbb....', '....bbbbbbbbbbbbbbbb....', '...bbbbbbbbbbbbbbbbbb...',
    '..bbbbbbbbbbbbbbbbbbbb..', '..bbbbbbbbbbbbbbbbbbbb..',
  ];
  let g = sculpt(mask, { s: STONE, b: DARKSTONE });
  g = accents(g, [
    '........................', '.......qqqqqqqqqq.......', '......qe..e..e..eq......', '.......qqqqqqqqqq.......', '........................',
    '.......k....kk....k.....', '........qq......qq......', '.......qeeq....qeeq.....', '........qq......qq......', '.......k....kk....k.....',
  ], A);
  const out = grid(26, 24);
  blit(out, g, 1, 10);
  // three floating needle sigils above the altar
  blit(out, parse(['..E', '.e.', 'q..'], A), 6, 3);
  blit(out, parse(['.E.', '.e.', '.q.'], A), 11, 1);
  blit(out, parse(['E..', '.e.', '..q'], A), 16, 3);
  return fin(out);
}

function stele(): Grid {
  const mask = [
    '..ssssssssss..', '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.',
    '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.',
    '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.', '.ssssssssssss.', 'bbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbb',
  ];
  let g = sculpt(mask, { s: DARKSTONE, b: STONE });
  g = accents(g, [
    '..............', '..............', '...qq....qq...', '...qe....eq...', '..............', '...k.k.k.k....', '..............',
    '...k.k..k.k...', '..............', '...qqqqqqqq...', '..............', '...k.k.k.k....', '..............', '...k..k.k.k...',
    '..............', '...qqqqqqqq...', '..............', '....k.k.k.....',
  ], A);
  const out = grid(16, 24);
  blit(out, g, 1, 1);
  return fin(out);
}

function emitter(on: boolean): Grid {
  const bell = [
    '....kmmk....', '...kppmak...', '..kpmmmmak..', '..kpmmmaak..', '..kmmmaaak..', '.kpmmmaaatk.', '.kkkkkkkkkk.', '.....kk.....',
  ];
  const stand = ['....kssk....', '....ksdk....', '....ksdk....', '...kssddk...', '..kssssddk..', '..kkkkkkkk..'];
  const g = grid(14, 22);
  blit(g, parse(bell, A), 1, 3);
  blit(g, parse(stand, A), 1, 14);
  if (on) blit(g, parse(['..X.....X..', '.X.......X.', 'X.........X'], A), 1, 0);
  return fin(g);
}

function sealDoor(open: boolean): Grid {
  // 64x28 door filling the 4-tile opening in the antechamber wall (drawn from the bottom edge)
  const g = grid(64, 30);
  if (!open) {
    const mask: string[] = [];
    for (let y = 0; y < 26; y++) mask.push(y < 2 ? '..' + 's'.repeat(60) + '..' : 's'.repeat(64));
    let d = sculpt(mask, { s: { ramp: [P.dusk, P.slate, P.stone, P.ash], round: 0.15 } });
    const acc: string[] = [];
    for (let y = 0; y < 26; y++) {
      let r = '';
      for (let x = 0; x < 64; x++) {
        const cx = x - 31.5;
        const cy = y - 13;
        const rr = Math.sqrt(cx * cx * 0.35 + cy * cy);
        if (x === 31 || x === 32) r += y > 2 && y < 24 ? 'k' : '.';
        else if (Math.abs(rr - 9) < 0.6) r += 'q';
        else if (Math.abs(rr - 5) < 0.6) r += 'e';
        else if (y === 3 || y === 22) r += x > 3 && x < 60 && x % 4 === 0 ? 'k' : '.';
        else r += '.';
      }
      acc.push(r);
    }
    d = accents(d, acc, A);
    blit(g, d, 0, 2);
  } else {
    // retracted: only the frame stubs at both sides + a floor groove
    const stub = sculpt(['sss', 'sss', 'sss', 'sss', 'sss', 'sss'], { s: STONE });
    blit(g, stub, 0, 22);
    blit(g, stub, 61, 22);
    for (let x = 4; x < 60; x += 2) set(g, x, 28, P.resoDeep);
  }
  return fin(g);
}

function heartDoor(lit: number, open: boolean): Grid {
  const W = 72;
  const H = 44;
  const g = grid(W, H);
  const mask: string[] = [];
  for (let y = 0; y < H - 2; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      const cx = x - 35.5;
      const cy = y - 30;
      const inArch = cx * cx / (34 * 34) + cy * cy / (30 * 30) <= 1 && y <= 41;
      const inDoor = cx * cx / (26 * 26) + cy * cy / (24 * 24) <= 1;
      r += inDoor ? (open ? '.' : 'd') : inArch ? 's' : '.';
    }
    mask.push(r);
  }
  let s = sculpt(mask, { s: DARKSTONE, d: { ramp: [P.night, P.dusk, P.slate], round: 0.3 } });
  if (!open) {
    // heart sigil: five sockets on a ring; lit ones glow amber
    const acc: string[] = [];
    for (let y = 0; y < H - 2; y++) acc.push('.'.repeat(W));
    const put = (x: number, y: number, ch: string) => {
      const row = acc[y];
      if (!row || x < 0 || x >= W) return;
      acc[y] = row.slice(0, x) + ch + row.slice(x + 1);
    };
    for (let a = 0; a < 360; a += 3) {
      const r = (a * Math.PI) / 180;
      put(Math.round(35.5 + Math.cos(r) * 14), Math.round(26 + Math.sin(r) * 10), 'q');
    }
    for (let i = 0; i < 5; i++) {
      const r = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      const x = Math.round(35.5 + Math.cos(r) * 14);
      const y = Math.round(26 + Math.sin(r) * 10);
      const c = i < lit ? 'f' : 'k';
      put(x, y, c); put(x + 1, y, c); put(x, y + 1, c); put(x + 1, y + 1, i < lit ? 'F' : 'n');
    }
    for (let y = 20; y <= 32; y++) put(35, y, 'k');
    for (let y = 20; y <= 32; y++) put(36, y, 'k');
    put(35, 26, 'F'); put(36, 26, 'F');
    s = accents(s, acc, A);
  } else {
    s = accents(s, [], A);
  }
  blit(g, s, 0, 0);
  return fin(g);
}

function banner(color: [number, number, number]): Grid {
  const [dark, mid, lite] = color;
  const L2: Legend = { ...A, '1': dark, '2': mid, '3': lite };
  return fin(parse([
    'kssssssssk', '.k322222k.', '.k322222k.', '.k322e22k.', '.k32eEe2k.', '.k322e22k.', '.k322222k.', '.k322222k.', '.k322221k.',
    '.k322221k.', '.k22221k..', '..k2221k..', '..k221k...', '...k21k...', '...k1k....', '....k.....',
  ], L2));
}

function bossDoor(glyph: number): Grid {
  const g = grid(52, 36);
  const mask: string[] = [];
  for (let y = 0; y < 34; y++) {
    let r = '';
    for (let x = 0; x < 52; x++) {
      const cx = x - 25.5;
      const arch = y >= 10 || cx * cx / (25 * 25) + ((y - 10) * (y - 10)) / (10 * 10) <= 1;
      const inner = Math.abs(cx) < 17 && (y >= 12 || cx * cx / (17 * 17) + ((y - 12) * (y - 12)) / (8 * 8) <= 1);
      r += inner ? 'd' : arch ? 's' : '.';
    }
    mask.push(r);
  }
  let s = sculpt(mask, { s: STONE, d: { ramp: [P.ink, P.night, P.dusk], round: 0.2 } });
  const glyphs = [
    ['.kk..kk.', 'kffkkffk', '.kffffk.', '..kffk..', '...kk...'], // B01 horns
    ['..kkkk..', '.keWWek.', '.kWkkWk.', '.kWkkWk.', '..kWWk..'], // B02 bell
    ['...kk...', '..kXXk..', '.kXkkXk.', '..kXXk..', '...kk...'], // B03 mirror
    ['.k.kk.k.', 'kLkLLkLk', '.kLLLLk.', '..kLLk..', '...kk...'], // B04 roots
    ['.kkkkkk.', 'kOOkkOOk', 'kOkEEkOk', 'kOOkkOOk', '.kkkkkk.'], // B05 eye
    ['..kkkk..', '.kFFFFk.', 'kFkFFkFk', '.kFFFFk.', '..kFFk..'], // B06 drill
    ['kk....kk', 'kEk..kVk', '.kEkkVk.', '..kEVk..', '...kk...'], // B07 twin
    ['k.k..k.k', 'kVkkkkVk', 'kVVVVVVk', 'kkkkkkkk', '........'], // B08 crown
    ['...kk...', '..kffk..', 'kkffffkk', '..kffk..', '...kk...'], // FINAL star
  ];
  const gl = glyphs[glyph] ?? glyphs[0]!;
  s = accents(s, gl, A, 22, 2);
  blit(g, s, 0, 1);
  return fin(g);
}

function rubble(v: number): Grid {
  const masks = [
    ['...sss.......', '..sssss..ss..', '.ssssssssss..', 'sssssssssssss', '.ssssssssss..'],
    ['.....ss....', '..ssssss...', '.sssssssss.', 'sssssssssss', '..sssssss..'],
  ];
  return fin(sculpt(masks[v % 2]!, { s: SAND }));
}

function mural(region: number): Grid {
  const inks = ['q', 'q', 'q', 'q'];
  const scenes = [
    ['........................', '..e.....e.....e.........', '...q...q.q...q.q.......', '....q.q...q.q...q......', '.....e.....e.....e.....', '........................'],
    ['........................', '...kkk.......kkk........', '..kEEEk.....kVVVk.......', '...kkk...q...kkk........', '.......qqqqq............', '........................'],
    ['........................', '....kk...ee...kk........', '...kffk.eEEe.kffk.......', '....kk...ee...kk........', '......q.....q...........', '........................'],
    ['........................', '....XXXX................', '...X....X...WWWW........', '....XXXX...W....W.......', '............WWWW........', '........................'],
  ];
  const mask: string[] = [];
  for (let y = 0; y < 14; y++) mask.push('s'.repeat(26));
  let g = sculpt(mask, { s: { ramp: [P.dusk, P.slate, P.stone], round: 0.1 } });
  g = accents(g, scenes[region % 4]!.map((r) => r.replace(/q/g, inks[region % 4]!)), A, 1, 4);
  return fin(g);
}

function tree(): Grid {
  const canopy = [
    '.....gggggg.....', '...gglllllgg....', '..glllzllllgg...', '.gllzLzlllllgg..', '.glllzllllzllg..', 'glllllllllzLlgg.', 'gllzllllllllllg.',
    'ggllllllzlllllg.', '.gglllllllllgg..', '..ggglllllggg...', '....gggggggg....',
  ];
  const trunk = ['......bbb.......', '......bbb.......', '......bbbb......', '.....bbbbb......', '....bb.bbbb.....'];
  const g = grid(18, 22);
  blit(g, sculpt(trunk, { b: BARK }), 1, 15);
  blit(g, sculpt(canopy, { g: MOSS, l: MOSS, z: MOSS, L: MOSS }), 1, 4);
  return fin(g);
}

function simple(rows: string[], w: number, h: number): Grid {
  const g = grid(w, h);
  blit(g, parse(rows, A), 0, h - rows.length);
  return fin(g);
}

export function propSheets(): SheetDef[] {
  const f: FrameDef[] = [];
  const faces = [FACE_S, FACE_E, FACE_N];
  faces.forEach((face, v) => {
    f.push({ name: `sealStone_${v}_intact`, grid: monolith(face, 'intact') });
    f.push({ name: `sealStone_${v}_flash`, grid: monolith(face, 'flash') });
    f.push({ name: `sealStone_${v}_broken`, grid: monolith(face, 'broken') });
  });
  f.push({ name: 'post_quarry', grid: post(SAND, { ramp: [P.umber, P.rust, P.clay], round: 0.2 }) });
  f.push({ name: 'post_hub', grid: post(STONE, DARKSTONE) });
  f.push({ name: 'post_garden', grid: post(STONE, MOSS, ['..g......', '.gl......', '.g.......', '.......g.', '......gl.', '.......g.', '.........', '.........', '.........', '..g......', '.glg.....']) });
  f.push({ name: 'post_belfry', grid: post(BRONZE, WOOD) });
  f.push({ name: 'post_marsh', grid: post(GLASS, { ramp: [P.abyss, P.deep, P.tide], round: 0.2 }) });
  f.push({ name: 'mirrorPost', grid: post(GLASS, { ramp: [P.abyss, P.deep, P.tide], round: 0.2 }, ['.........', '..O......', '..OO.....', '...O.....']) });
  let pil = sculpt(PILLAR_MASK, { s: DARKSTONE, b: STONE });
  pil = accents(pil, PILLAR_ACC, A);
  const pg = grid(16, 28);
  blit(pg, pil, 1, 1);
  f.push({ name: 'pillar', grid: fin(pg) });
  FLAMES.forEach((fl, i) => f.push({ name: `lamp_${i}`, grid: LAMP(fl) }));
  f.push({ name: 'altar', grid: altar() });
  f.push({ name: 'stele', grid: stele() });
  f.push({ name: 'emitter_off', grid: emitter(false) });
  f.push({ name: 'emitter_on', grid: emitter(true) });
  f.push({ name: 'sealDoor_off', grid: sealDoor(false) });
  f.push({ name: 'sealDoor_on', grid: sealDoor(true) });
  for (let i = 0; i <= 5; i++) f.push({ name: `heartDoor_${i}`, grid: heartDoor(i, false) });
  f.push({ name: 'heartDoor_open', grid: heartDoor(5, true) });
  const banners: [number, number, number][] = [[P.pine, P.moss, P.leaf], [P.rust, P.clay, P.ochre], [P.umber, P.rust, P.ember], [P.deep, P.tide, P.lake]];
  banners.forEach((c, i) => f.push({ name: `banner_${i}`, grid: banner(c) }));
  for (let i = 0; i < 9; i++) f.push({ name: `bossDoor_${i}`, grid: bossDoor(i) });
  for (let i = 0; i < 9; i++) f.push({ name: `bossDoorSide_${i}`, grid: flipX(bossDoor(i)) });
  f.push({ name: 'rubble_0', grid: rubble(0) });
  f.push({ name: 'rubble_1', grid: rubble(1) });
  for (let i = 0; i < 4; i++) f.push({ name: `mural_${i}`, grid: mural(i) });
  f.push({ name: 'tree', grid: tree() });
  f.push({ name: 'ashDrift', grid: simple(['..a.....a...', '.aaa...aaa..', 'aataa.aataa.'], 14, 6) });
  f.push({ name: 'crystalBloom', grid: simple(['...E......', '..EeE..E..', '..qeq.EeE.', '...q..qeq.', '.......q..'], 12, 8) });
  f.push({ name: 'chute', grid: simple(['..kk......kk..', '.kttk....kttk.', '..kk......kk..'], 16, 6) });
  f.push({ name: 'whirl_off', grid: simple(['....kkkk....', '...kgllgk...', '..kglkklgk..', '..klk..klk..', '..kglkklgk..', '...kgllgk...', '....kkkk....', '.....kk.....', '....kttk....'], 14, 12) });
  f.push({ name: 'whirl_on', grid: simple(['....kkkk....', '...kLzzLk...', '..kLzkkzLk..', '..kzk..kzk..', '..kLzkkzLk..', '...kLzzLk...', '....kkkk....', '.....kk.....', '....kttk....'], 14, 12) });
  f.push({ name: 'chimes_off', grid: simple(['kkkkkkkkkk', '.k..k..k..', '.o..o..o..', 'kok.kok.ko', 'kyk.kyk.ky', '.k...k...k'], 12, 8) });
  f.push({ name: 'chimes_on', grid: simple(['kkkkkkkkkk', '.k..k..k..', '.w..w..w..', 'kwk.kwk.kw', 'kyk.kyk.ky', 'X.X..X..X.'], 12, 8) });
  f.push({ name: 'sunLens_off', grid: simple(['...kkkk...', '..kOOTTk..', '.kOXOTTDk.', '.kOOTTDDk.', '..kTTDDk..', '...kkkk...', '....kk....', '...ksak...'], 12, 10) });
  f.push({ name: 'sunLens_on', grid: simple(['...kkkk...', '..kbbOOk..', '.kbbbOOTk.', '.kbOOOTTk.', '..kOOTTk..', '...kkkk...', '....kk....', '...ksak...'], 12, 10) });
  f.push({ name: 'rockfall_off', grid: simple(['..kk......kk..', '.kttk....kttk.', '..kk......kk..'], 16, 6) });
  f.push({ name: 'rockfall_on', grid: simple(['..kk..tt..kk..', '.kttk.aa.kttk.', '..kk......kk..'], 16, 6) });
  // region barrier visuals (closed = off, open = on)
  const pile: string[] = [];
  for (let y = 0; y < 16; y++) {
    let r = '';
    for (let x = 0; x < 48; x++) {
      const top = 3 + Math.round(2 * Math.sin(x * 0.7) + 1.5 * Math.sin(x * 0.31 + 1));
      const boulder = ((Math.floor(x / 7) + Math.floor(y / 5)) % 2 === 0) ? 's' : 'b';
      r += y >= top ? boulder : '.';
    }
    pile.push(r);
  }
  f.push({ name: 'rubbleGate_off', grid: fin(sculpt(pile, { s: SAND, b: { ramp: [P.rust, P.clay, P.ochre, P.sand], round: 0.6 } })) });
  f.push({ name: 'rubbleGate_on', grid: fin(sculpt(['.ss.....sss......ss....s.....ss.', 'ssss...sssss....ssss..sss...ssss'].map((r) => r + r.slice(0, 16)), { s: SAND })) });
  const vineRows: string[] = [];
  for (let y = 0; y < 48; y++) vineRows.push(y % 6 < 3 ? 'gllgglgg' + 'lzlggllg' : 'ggllzlgl' + 'lgglzllg');
  f.push({ name: 'vineGate_off', grid: fin(sculpt(vineRows, { g: MOSS, l: MOSS, z: MOSS })) });
  f.push({ name: 'vineGate_on', grid: fin(sculpt(['g..gl..g', 'lg.gg.lg', 'gl..l.gg'].map((r) => r + r), { g: MOSS, l: MOSS })) });
  f.push({ name: 'bellGate_off', grid: fin(sculpt(Array.from({ length: 16 }, (_, y) => (y % 4 === 0 ? 'b'.repeat(48) : 'bbbb' + 'd'.repeat(40) + 'bbbb')), { b: BRONZE, d: WOOD })) });
  f.push({ name: 'bellGate_on', grid: fin(sculpt(['bbbb' + '.'.repeat(40) + 'bbbb', 'bbbb' + '.'.repeat(40) + 'bbbb'], { b: BRONZE })) });
  f.push({ name: 'mirrorGate_off', grid: fin(sculpt(Array.from({ length: 48 }, () => 'gggggggggggggggg'), { g: GLASS })) });
  f.push({ name: 'mirrorGate_on', grid: fin(sculpt(['gg............gg', 'gg............gg'], { g: GLASS })) });
  // region dressing
  f.push({ name: 'vines', grid: simple(['..g....g...g..', '.gl...gl..glg.', 'gllg.glg.gllg.', '.gg...g...gg..'], 16, 6) });
  f.push({ name: 'flowers', grid: simple(['..E...w...E...', '.EeE.wyw.EeE..', '..g...g...g...', '..g...g...g...'], 16, 6) });
  f.push({ name: 'smallBell_0', grid: simple(['..kk..', '.kook.', 'kooyok', 'kkkkkk', '..kk..'], 8, 8) });
  f.push({ name: 'smallBell_1', grid: simple(['..kk..', '.kyyk.', 'kyywyk', 'kkkkkk', '..kk..'], 8, 8) });
  f.push({ name: 'crackedBeam', grid: simple(['kkkkkkkkk.kkkkkkkkkkk', 'crrcrrcr.krcrrcrrcrrk', 'kkkkkkk....kkkkkkkkkk'], 24, 5) });
  f.push({ name: 'bellBanner', grid: simple(['kkkkkkkkkkkkkkkkkkkkk', 'kqeqeqeqeqeqeqeqeqeqk', 'kkkkkkkkkkkkkkkkkkkkk'], 24, 5) });
  f.push({ name: 'reeds', grid: simple(['.l...l..l.', '.l..lg..l.', 'lg..lg.lg.', 'lg.lgg.lg.', 'ggiggiggi.'], 12, 7) });
  f.push({ name: 'fog', grid: simple(['..TT....TTT...', '.TKKT..TKKKT..', 'TKKKKTTKKKKKT.'], 16, 5) });
  f.push({ name: 'lilies', grid: simple(['..zz...E....', '.zllz.EeE...', '..zz...E..zz', '..........ll'], 14, 6) });
  f.push({ name: 'dais', grid: simple(['......qqqqqqqqqqqq......', '...qqq............qqq...', '.qq.......eEEe.......qq.', 'q........eqqqqe........q', '.qq.......eEEe.......qq.', '...qqq............qqq...', '......qqqqqqqqqqqq......'], 26, 9) });
  return [{ key: 'props', dir: 'sprites', cw: 72, ch: 48, cols: 14, pivot: { x: 36, y: 47 }, frames: f }];
}
