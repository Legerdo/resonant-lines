// The nameless Tuner (조율자). Modular authoring: hand-drawn body per facing + hand-drawn feet/gloves/tassel/needle
// overlays, composed per animation frame with integer offsets, then one unified sel-out outline over the composite.
import { P } from '../../src/presentation/art/palette.ts';
import { grid, parse, blit, outline, flipX, solidFill, type Grid, type Legend } from '../lib/pixel.ts';
import { anim, type FrameDef, type SheetDef, type AnimDef } from '../lib/sheet.ts';

const L: Legend = {
  k: P.ink, n: P.night, d: P.dusk, s: P.slate, t: P.stone, a: P.ash, m: P.mist, p: P.pale, b: P.bone,
  u: P.umber, r: P.rust, c: P.clay, o: P.ochre, y: P.sand, w: P.wheat,
  e: P.reso, E: P.resoLite, q: P.resoDeep,
};

// 14x18 bodies (hood + cloak). Light from the upper left: sand (y) lit side, ochre (o) mid, clay (c) shade.
const BODY_DOWN = [
  '.....oooo.....',
  '...ooyyyyoo...',
  '..oyywyyyyoo..',
  '..oyyyyyyyooc.',
  '.oyyonnnnnnoc.',
  '.oyonnppppnnc.',
  '.oyonpbbbbpnoc',
  '.oyonpebbepnoc',
  '.ooonppbbppnoc',
  '..oonnppppnnc.',
  '..qqeqqqqqqqc.',
  '.oqEeqqqqqqqoc',
  '.oyyoyyyyooocc',
  'oyyyoyyyyooocc',
  'oyyyoyyyoooocc',
  'oyyooyyooooccc',
  '.ooooooooocccc',
  '..cccccccccc..',
];

const BODY_UP = [
  '.....oooo.....',
  '...ooyyyyoo...',
  '..oyywyyyyoo..',
  '..oyyyyyyyooc.',
  '.oyyyyyyyyoocc',
  '.oyyyyyyyooocc',
  '.oyyyyyyoooocc',
  '.ooyyyyoooocc.',
  '..oooooooocc..',
  '..qqqqqqqqqq..',
  '.oqeqqqqqqqqc.',
  '.oyyooyyooocc.',
  'oyyyooyyoooocc',
  'oyyyooyyoooocc',
  'oyyooyyooooccc',
  'oyyooyyoooccc.',
  '.ooooooooccccc',
  '..cccccccccc..',
];

const BODY_SIDE = [
  '....oooo......',
  '...oyyyyoo....',
  '..oyywyyyoo...',
  '..oyyyyyyonn..',
  '.oyyyyyyonpp..',
  '.oyyyyyyonpbp.',
  '.oyyyyyoonpebp',
  '.ooyyyooonppp.',
  '..ooooooonnp..',
  '..ooooooqqq...',
  '..qqqqqqqeq...',
  '..oyyyoooqc...',
  '.oyyyyooooc...',
  '.oyyyyoooocc..',
  '.oyyyooooccc..',
  'oyyyoooocccc..',
  '.oooooocccc...',
  '..ccccccccc...',
];

const FOOT = parse(['ds', 'dd'], L);
const FOOT_LIFT = parse(['sd'], L);
const GLOVE = parse(['ta', 'st'], L);
const GLOVE_GLOW = parse(['.E.', 'EtE', '.e.'], L);
const TASSEL = [
  parse(['q', 'e', 'q', 'q'], L),
  parse(['q.', '.e', '.q', 'q.'], L),
  parse(['.q', 'e.', 'q.', '.q'], L),
];
// needles strapped on the back (visible from behind): one shaft per held needle
const BACK_NEEDLE = parse(['...b', '..p.', '.m..', 'q...'], L);

interface Pose {
  bodyX?: number;
  bodyY?: number;
  feet: [number, number, number, number]; // lx, ly, rx, ry relative to body origin
  lift?: 'l' | 'r';
  gloves?: [number, number, number, number] | null;
  glow?: [number, number] | null;
  tassel: number;
  hemShift?: number;
}

type Facing = 'down' | 'up' | 'side';
const BODIES: Record<Facing, Grid> = {
  down: parse(BODY_DOWN, L),
  up: parse(BODY_UP, L),
  side: parse(BODY_SIDE, L),
};

const BX = 5; // body origin inside the 24x32 cell
const BY = 8;

function compose(face: Facing, pose: Pose, heldNeedles = 3): Grid {
  const g = grid(24, 32);
  const bx = BX + (pose.bodyX ?? 0);
  const by = BY + (pose.bodyY ?? 0);
  // feet first (under the hem)
  const [lx, ly, rx, ry] = pose.feet;
  blit(g, pose.lift === 'l' ? FOOT_LIFT : FOOT, BX + lx, BY + ly);
  blit(g, pose.lift === 'r' ? FOOT_LIFT : FOOT, BX + rx, BY + ry);
  blit(g, BODIES[face], bx, by);
  if (face === 'up') {
    for (let i = 0; i < heldNeedles; i++) blit(g, BACK_NEEDLE, bx + 4 + i * 2, by + 10 + (i % 2));
  }
  const tas = TASSEL[pose.tassel % 3]!;
  if (face === 'down') blit(g, tas, bx + 2, by + 12);
  else if (face === 'up') blit(g, tas, bx + 10, by + 11);
  else blit(g, tas, bx + 1, by + 11);
  if (pose.gloves) {
    const [ax, ay, cx, cy] = pose.gloves;
    blit(g, GLOVE, bx + ax, by + ay);
    blit(g, GLOVE, bx + cx, by + cy);
  }
  if (pose.glow) blit(g, GLOVE_GLOW, bx + pose.glow[0], by + pose.glow[1]);
  return outline(g);
}

const STAND: Pose['feet'] = [4, 17, 8, 17];
const SIDE_STAND: Pose['feet'] = [4, 17, 7, 17];

function poses(face: Facing) {
  const side = face === 'side';
  const st = side ? SIDE_STAND : STAND;
  const restGloves: Pose['gloves'] = side ? [8, 12, 8, 12] : [-1, 13, 13, 13];
  const idle: Pose[] = [0, 0, 1, 1].map((dy, i) => ({ bodyY: dy, feet: st, gloves: restGloves && [restGloves[0], restGloves[1], restGloves[2], restGloves[3]], tassel: i % 3 }));
  // walk: 6 frames, alternating stride with a 1px bob on contact frames
  const stride: Pose['feet'][] = side
    ? [[2, 17, 9, 17], [3, 16, 8, 17], [5, 17, 6, 17], [9, 17, 2, 17], [8, 17, 3, 16], [6, 17, 5, 17]]
    : [[4, 18, 8, 16], [4, 17, 8, 16], [4, 17, 8, 17], [4, 16, 8, 18], [4, 16, 8, 17], [4, 17, 8, 17]];
  const walk: Pose[] = stride.map((f, i) => ({
    bodyY: i === 1 || i === 4 ? -1 : 0,
    feet: f,
    lift: side ? (i === 1 ? 'l' : i === 4 ? 'r' : undefined) : undefined,
    gloves: side ? [8 + (i < 3 ? -1 : 1), 12, 8, 12] : [-1, 13 + (i < 3 ? 0 : 1), 13, 13 + (i < 3 ? 1 : 0)],
    tassel: i % 3,
  }));
  // throw: wind-up, release (arm extended toward facing), follow-through, recover
  const throwG: Pose['gloves'][] = side
    ? [[3, 9, 8, 12], [12, 11, 8, 12], [12, 12, 8, 12], [9, 12, 8, 12]]
    : face === 'down'
      ? [[-1, 13, 13, 8], [-1, 13, 11, 17], [-1, 13, 12, 16], [-1, 13, 13, 13]]
      : [[-1, 13, 13, 8], [-1, 13, 11, 5], [-1, 13, 12, 7], [-1, 13, 13, 13]];
  const thr: Pose[] = throwG.map((gl, i) => ({ bodyX: side && i === 1 ? 1 : 0, feet: st, gloves: gl, tassel: (i + 1) % 3 }));
  // dash: lean with a stretched stance, tassel streaming
  const dash: Pose[] = [0, 1, 2].map((i) => ({
    bodyX: side ? 1 : 0,
    bodyY: i === 1 ? 1 : 0,
    feet: side ? [1, 17, 9, 16] : [3, 17, 9, 17],
    gloves: side ? [4, 12, 8, 12] : [-1, 12, 13, 12],
    tassel: 2,
  }));
  return { idle, walk, thr, dash, restGloves, st };
}

// --- whole-body special frames (face down): pulse, recall, hit, death
function specials(): FrameDef[] {
  const f: FrameDef[] = [];
  const st = STAND;
  const pulseG: [Pose['gloves'], Pose['glow']][] = [
    [[1, 12, 11, 12], null],
    [[3, 14, 9, 14], null],
    [[4, 15, 8, 15], [5, 15]],
    [[4, 15, 8, 15], [5, 16]],
    [[2, 14, 10, 14], null],
  ];
  pulseG.forEach(([gl, glow], i) => f.push({ name: `pulse_${i}`, grid: compose('down', { feet: st, gloves: gl, glow, tassel: i % 3, bodyY: i === 2 ? 1 : 0 }) }));
  const recallG: Pose['gloves'][] = [[-1, 13, 13, 6], [-1, 13, 12, 3], [-1, 13, 13, 8]];
  recallG.forEach((gl, i) => f.push({ name: `recall_${i}`, grid: compose('down', { feet: st, gloves: gl, tassel: i, glow: i === 1 ? [11, 1] : null }) }));
  // hit flinch: body pushed back and up
  f.push({ name: 'hit_0', grid: compose('down', { feet: st, bodyY: -1, bodyX: -1, gloves: [-2, 10, 14, 10], tassel: 1 }) });
  f.push({ name: 'hit_1', grid: compose('down', { feet: st, bodyY: 1, gloves: [-1, 12, 13, 12], tassel: 2 }) });
  // death: kneel -> crumple -> scarf light fades
  f.push({ name: 'death_0', grid: compose('down', { feet: st, bodyY: 1, gloves: [0, 14, 12, 14], tassel: 0 }) });
  f.push({ name: 'death_1', grid: compose('down', { feet: [4, 17, 8, 17], bodyY: 3, gloves: [1, 15, 11, 15], tassel: 1 }) });
  const pile = (scarf: string, eye: string): Grid => {
    const rows = [
      '......oooo........',
      '....ooyyyyoo......',
      '...oyynnnnyoo.....',
      '..oyyonppnnoc.....',
      '.ooyyonp' + eye + 'pnocc....',
      'oyyyyoqq' + scarf + 'qqoccc...',
      'oyyyoooooooocccc..',
      '.ooooooooooccccccc',
      '..cccccccccccccc..',
    ];
    const g = grid(24, 32);
    blit(g, parse(rows, L), 3, 19);
    return outline(g);
  };
  f.push({ name: 'death_2', grid: pile('e', 'e') });
  f.push({ name: 'death_3', grid: pile('e', 'q') });
  f.push({ name: 'death_4', grid: pile('q', 'n') });
  f.push({ name: 'death_5', grid: pile('q', 'n') });
  f.push({ name: 'death_6', grid: pile('n', 'n') });
  return f;
}

export function playerSheets(): SheetDef[] {
  const frames: FrameDef[] = [];
  const anims: AnimDef[] = [];
  for (const face of ['down', 'up', 'side'] as const) {
    const ps = poses(face);
    ps.idle.forEach((p, i) => frames.push({ name: `idle_${face}_${i}`, grid: compose(face, p) }));
    ps.walk.forEach((p, i) => frames.push({ name: `walk_${face}_${i}`, grid: compose(face, p) }));
    ps.thr.forEach((p, i) => frames.push({ name: `throw_${face}_${i}`, grid: compose(face, p) }));
    ps.dash.forEach((p, i) => frames.push({ name: `dash_${face}_${i}`, grid: compose(face, p) }));
    anims.push(anim(`p_idle_${face}`, [0, 1, 2, 3].map((i) => `idle_${face}_${i}`), [420, 180, 420, 180]));
    anims.push(anim(`p_walk_${face}`, [0, 1, 2, 3, 4, 5].map((i) => `walk_${face}_${i}`), 95));
    anims.push(anim(`p_throw_${face}`, [0, 1, 2, 3].map((i) => `throw_${face}_${i}`), [40, 60, 60, 60], 0));
    anims.push(anim(`p_dash_${face}`, [0, 1, 2].map((i) => `dash_${face}_${i}`), 60, 0));
  }
  // up-facing idle variants with fewer strapped needles (0..2 held) so the back shows what is in hand
  for (let held = 0; held < 3; held++) {
    frames.push({ name: `idle_up_held${held}`, grid: compose('up', { feet: STAND, gloves: [-1, 13, 13, 13], tassel: 0 }, held) });
  }
  frames.push(...specials());
  anims.push(anim('p_pulse', [0, 1, 2, 3, 4].map((i) => `pulse_${i}`), [40, 40, 90, 90, 80], 0));
  anims.push(anim('p_recall', [0, 1, 2].map((i) => `recall_${i}`), [50, 90, 80], 0));
  anims.push(anim('p_hit', ['hit_0', 'hit_1'], [90, 110], 0));
  anims.push(anim('p_death', [0, 1, 2, 3, 4, 5, 6].map((i) => `death_${i}`), [90, 110, 140, 160, 180, 200, 400], 0));
  // side frames also exported mirrored (left) as dedicated frames: no runtime rotation/scaling ever
  const mirrored: FrameDef[] = frames.filter((f) => f.name.includes('_side_')).map((f) => ({ name: f.name.replace('_side_', '_left_'), grid: flipX(f.grid) }));
  frames.push(...mirrored);
  for (const a of anims.filter((x) => x.key.endsWith('_side'))) {
    anims.push(anim(a.key.replace('_side', '_left'), a.frames.map((n) => n.replace('_side_', '_left_')), a.durations, a.repeat));
  }
  // palette-shift variants (same frame order): hit flash (bone) and Thread Step afterimage (checker-dithered teal)
  const flash: FrameDef[] = frames.map((f) => ({ name: f.name, grid: solidFill(f.grid, P.bone) }));
  const ghost: FrameDef[] = frames.map((f) => {
    const g = solidFill(f.grid, P.reso);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if ((x + y) % 2 === 1) g.px[y * g.w + x] = -1;
    return { name: f.name, grid: g };
  });
  return [
    { key: 'player', dir: 'sprites', cw: 24, ch: 32, cols: 16, pivot: { x: 12, y: 28 }, frames, anims },
    { key: 'player_flash', dir: 'sprites', cw: 24, ch: 32, cols: 16, pivot: { x: 12, y: 28 }, frames: flash },
    { key: 'player_ghost', dir: 'sprites', cw: 24, ch: 32, cols: 16, pivot: { x: 12, y: 28 }, frames: ghost },
  ];
}
