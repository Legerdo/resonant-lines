import { P } from '../art/palette.ts';
import { registerBossView } from './index.ts';
import { ySort, type ViewCtx } from './types.ts';
import type { StarBoss } from '../../bosses/definitions/finalStar.ts';

registerBossView('FINAL', (ctx: ViewCtx) => {
  const boss = ctx.sim.boss as StarBoss;
  const v = boss.view;
  const s = v.parts.star;
  if (!s) return;
  const stage = s.f ?? 0;
  // outer circuits (A): broken arcs between terminal pairs; restored ones flow clockwise
  for (let k = 0; k < 3; k++) {
    const a = v.parts[`t${2 * k}`];
    const b = v.parts[`t${2 * k + 1}`];
    if (!a || !b || !a.on) continue;
    const lit = (a.f ?? 0) === 1;
    const ph = Math.floor(ctx.time * 16);
    ctx.under.line(a.x, a.y, b.x, b.y, (i, n) => {
      if (lit) return (i + ph) % 5 === 0 ? P.resoLite : P.resoDeep;
      return i > n * 0.4 && i < n * 0.6 ? -1 : i % 2 === 0 ? P.slate : -1;
    });
  }
  for (let i = 0; i < 6; i++) {
    const t = v.parts[`t${i}`];
    if (!t?.on) continue;
    ctx.pool.draw('star_parts', t.f ? 'termLit' : 'term', t.x, t.y, ySort(t.y));
  }
  for (let i = 0; i < 3; i++) {
    const d = v.parts[`debris${i}`];
    if (!d?.on) continue;
    ctx.pool.draw('star_parts', d.f ? `debLit${i}` : `deb${i}`, d.x, d.y, ySort(d.y));
  }
  const sh = v.parts.shard;
  if (sh?.on) {
    ctx.pool.draw('star_parts', 'debLit0', sh.x, sh.y, ySort(sh.y));
    ctx.under.ring(sh.x, sh.y, 9, Math.floor(ctx.time * 5) % 2 ? P.flare : P.ember, 2, ctx.frame);
  }
  const n = Math.floor(ctx.time * (stage === 2 ? 5 : 2)) % 2;
  if (v.pose === 'defeat') {
    const k = Math.min(1, v.poseT / 2);
    ctx.under.ring(s.x, s.y, 20 + k * 120, k < 0.5 ? P.resoLite : P.reso, 0, 0);
  }
  ctx.pool.draw('boss_star', `star${Math.min(2, stage)}_${n}`, s.x, s.y, ySort(s.y + 30));
});
