import { P } from '../art/palette.ts';
import { registerBossView } from './index.ts';
import { ySort, type ViewCtx } from './types.ts';
import type { BrakBoss } from '../../bosses/definitions/b06Brak.ts';

registerBossView('B06', (ctx: ViewCtx) => {
  const boss = ctx.sim.boss as BrakBoss;
  const v = boss.view;
  const b = v.parts.body;
  if (!b) return;
  const face = (b.f ?? 1) >= 0 ? 'r' : 'l';
  // tunnel trail: cracked ground behind the digger
  boss.trail.forEach((p, i) => {
    const r = 2 + (i % 3);
    ctx.under.px(p.x - r, p.y, P.umber);
    ctx.under.px(p.x + r, p.y + 1, P.umber);
    ctx.under.px(p.x, p.y - 1, P.rust);
  });
  if (v.pose === 'under') {
    ctx.pool.draw('boss_brak', `mound${Math.floor(ctx.time * 8) % 3}`, b.x, b.y + 6, ySort(b.y) - 4);
  } else {
    const n = v.pose === 'surface' ? Math.floor(ctx.time * 18) % 3 : v.pose === 'jam' ? Math.floor(ctx.time * 6) % 2 : Math.min(1, Math.floor(v.poseT * 2));
    ctx.under.disc(b.x, b.y + 4, 16, P.night, 1, 0);
    ctx.pool.draw('boss_brak', `${v.pose}${n}_${face}`, b.x, b.y + 8, ySort(b.y + 8));
    if (v.pose === 'jam' && ctx.frame % 5 === 0) ctx.over.px(b.x + (face === 'r' ? 20 : -20), b.y - 10, P.flare);
  }
  // the swallowed needle glows through the ground (the internal endpoint is always visible)
  const g = v.parts.gut;
  if (g?.on) {
    const r = 5 + (Math.floor(ctx.time * 6) % 3);
    ctx.under.ring(g.x, g.y, r, P.reso, 2, ctx.frame);
    ctx.under.ring(g.x, g.y, r + 3, P.resoDeep, 3, ctx.frame >> 1);
  }
});
