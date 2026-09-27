import { P } from '../art/palette.ts';
import { registerBossView } from './index.ts';
import { ySort, type ViewCtx } from './types.ts';
import { ORBIT, type OrbitBoss } from '../../bosses/definitions/b07Orbit.ts';

registerBossView('B07', (ctx: ViewCtx) => {
  const boss = ctx.sim.boss as OrbitBoss;
  const v = boss.view;
  const c = ORBIT.center;
  // orbit paths (dotted ellipses) — the geometry is the puzzle, so it is always visible
  for (const [r, col, dash] of [[boss.rAr, P.ochre, 5], [boss.rOr, P.mist, 3]] as const) {
    const steps = Math.ceil(r * 5.4);
    for (let i = 0; i < steps; i++) {
      if (i % dash !== 0) continue;
      const a = (i / steps) * Math.PI * 2;
      ctx.under.px(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.82, col);
    }
  }
  const ar = v.parts.ar;
  const or = v.parts.or;
  if (!ar || !or) return;
  // the Ar–Or axis as a faint stepped line: seeing it sweep over the pedestal is the core read
  ctx.under.line(ar.x, ar.y, or.x, or.y, (i) => (i % 6 === 0 ? P.dusk : -1));
  const conf = v.parts.conf?.f ?? 3;
  ctx.pool.draw('boss_orbit', conf === 0 ? 'pedestalLit' : 'pedestal', c.x, c.y - 4, ySort(c.y + 8));
  const fr = Math.floor(ctx.time * 6) % 4;
  ctx.under.disc(ar.x, ar.y + 14, 8, P.night, 1, 0);
  ctx.under.disc(or.x, or.y + 12, 6, P.night, 1, 0);
  ctx.pool.draw('boss_orbit', `ar${fr}`, ar.x, ar.y, ySort(ar.y + 12));
  ctx.pool.draw('boss_orbit', `or${fr}`, or.x, or.y, ySort(or.y + 10));
});
