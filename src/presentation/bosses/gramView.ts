import { P } from '../art/palette.ts';
import { registerBossView } from './index.ts';
import { ySort, type ViewCtx } from './types.ts';
import type { GramBoss } from '../../bosses/definitions/b01Gram.ts';

const FRAMES: Record<string, { n: number; ms: number; hold?: boolean }> = {
  idle: { n: 2, ms: 420 },
  windup: { n: 2, ms: 110 },
  charge: { n: 4, ms: 70 },
  crash: { n: 2, ms: 260 },
  rear: { n: 1, ms: 100 },
  stomp: { n: 1, ms: 100 },
  pinned: { n: 2, ms: 140 },
  defeat: { n: 3, ms: 380, hold: true },
};

interface Frag {
  x: number;
  y: number;
  vy: number;
  vx: number;
  t: number;
}
const frags = new WeakMap<object, { seen: number; list: Frag[] }>();

registerBossView('B01', (ctx: ViewCtx) => {
  const boss = ctx.sim.boss as GramBoss;
  const v = boss.view;
  const body = v.parts.body;
  if (!body) return;
  const poseName = v.pose === 'recover' ? 'idle' : v.pose;
  const spec = FRAMES[poseName] ?? FRAMES.idle!;
  const idx = spec.hold ? Math.min(spec.n - 1, Math.floor((v.poseT * 1000) / spec.ms)) : Math.floor((v.poseT * 1000) / spec.ms) % spec.n;
  const broken = boss.seals.filter((s) => s.broken).length;
  const plates = boss.coreExposed ? 0 : 3 - broken;
  const face = v.facing >= 0 ? 'r' : 'l';
  const px = body.x;
  const py = body.y + 12;
  const flash = v.flash > 0 && ctx.frame % 4 < 2;
  const img = ctx.pool.draw('boss_gram', `${poseName}${idx}_${plates}_${face}`, px, py, ySort(py));
  if (img && flash) img.setVisible(ctx.frame % 2 === 0);
  // shadow on the ground (ordered dither, palette exact)
  ctx.under.disc(px, py - 2, 18, P.night, 1, 0);
  // dizzy stars while stunned
  if (poseName === 'crash' && ctx.sim.fight?.result === 'ongoing') {
    ctx.pool.draw('boss_gram', `stars_${Math.floor(ctx.time * 8) % 4}`, px + 18 * v.facing, py - 44, ySort(py) + 1);
  }
  // core resonance when pinned inside the lattice
  if (v.pose === 'pinned') {
    const cx = body.x - 12 * v.facing;
    const cy = body.y - 20;
    const r = 6 + ((ctx.time * 20) % 10);
    ctx.over.ring(cx, cy, r, r < 10 ? P.flare : P.ember, 3, ctx.frame);
  }
  // falling plate fragments when a seal breaks (view-only)
  let st = frags.get(boss);
  if (!st) {
    st = { seen: broken, list: [] };
    frags.set(boss, st);
  }
  if (broken > st.seen) {
    for (let k = st.seen; k < broken; k++) st.list.push({ x: px - 14 * v.facing + k * 6 * v.facing, y: py - 34, vy: -60, vx: -30 * v.facing, t: 0 });
    st.seen = broken;
  }
  for (const f of st.list) {
    f.t += 1 / 60;
    f.vy += 400 / 60;
    f.x += f.vx / 60;
    f.y = Math.min(py + 4, f.y + f.vy / 60);
    if (f.t < 2.5) ctx.pool.draw('boss_gram', 'plate', f.x, f.y, ySort(py + 5));
  }
});
