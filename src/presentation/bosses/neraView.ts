import { P } from '../art/palette.ts';
import { registerBossView } from './index.ts';
import { ySort, type ViewCtx } from './types.ts';
import type { NeraBoss } from '../../bosses/definitions/b03Nera.ts';

registerBossView('B03', (ctx: ViewCtx) => {
  const boss = ctx.sim.boss as NeraBoss;
  const v = boss.view;
  const ongoing = ctx.sim.fight?.result === 'ongoing';
  for (let i = 0; i < 4; i++) {
    const part = v.parts[`fig${i}`];
    if (!part) continue;
    const isTrue = part.a === 1;
    if (boss.coreExposed && !isTrue) continue;
    const face = (part.f ?? 1) >= 0 ? 'r' : 'l';
    let pose = v.pose === 'swim' ? 'swim' : v.pose === 'dive' ? 'dive' : v.pose === 'defeat' ? 'defeat' : 'idle';
    if (!part.on && pose !== 'dive' && pose !== 'defeat') continue;
    if (pose === 'defeat' && !isTrue) continue;
    const n = pose === 'dive' || pose === 'defeat' ? Math.min(1, Math.floor(v.poseT * 3.4)) : Math.floor(ctx.time * 2.5 + i * 0.7) % 2;
    if (pose === 'idle' && !ongoing && ctx.sim.fight?.result !== 'intro') pose = 'idle';
    const x = part.x;
    const y = part.y + 10;
    // ripples + reflection in the mirror water
    const rr = 12 + ((ctx.time * 12 + i * 5) % 8);
    ctx.under.ring(x, y - 2, rr, rr < 16 ? P.lake : P.tide, 3, i);
    if (pose !== 'swim') ctx.pool.draw('boss_nera', `refl_${face}`, x, y + 20, ySort(y) - 60);
    ctx.pool.draw('boss_nera', `${pose}${n}_${face}`, x, y, ySort(y));
  }
  // refraction: a line through the true body bends around it (the only tell)
  const rf = v.parts.refract;
  if (rf?.on) {
    for (const l of ctx.sim.links) {
      if (!boss.refracted.has(l.id)) continue;
      const a = ctx.sim.needle(l.a).pos;
      const b = ctx.sim.needle(l.b).pos;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const t = ((rf.x - a.x) * ux + (rf.y - a.y) * uy);
      const cx = a.x + ux * t;
      const cy = a.y + uy * t;
      const k = 3 + Math.round(Math.sin(ctx.time * 9));
      // detour: two short segments offset perpendicular, bright
      const nx = -uy * k;
      const ny = ux * k;
      ctx.over.line(cx - ux * 12, cy - uy * 12, cx + nx, cy + ny, P.resoLite);
      ctx.over.line(cx + nx, cy + ny, cx + ux * 12, cy + uy * 12, P.resoLite);
      ctx.over.px(cx + nx, cy + ny, P.bone);
    }
  }
});
