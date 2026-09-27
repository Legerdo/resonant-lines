import { P } from '../art/palette.ts';
import { registerBossView } from './index.ts';
import { ySort, type ViewCtx } from './types.ts';
import { MORA, CONDUITS, type MoraBoss } from '../../bosses/definitions/b04Mora.ts';

registerBossView('B04', (ctx: ViewCtx) => {
  const boss = ctx.sim.boss as MoraBoss;
  const v = boss.view;
  const core = v.parts.core;
  if (!core) return;
  // conduits: broken channel between terminals; restored = flowing chevrons toward the machine-side end
  CONDUITS.forEach(([a, b], k) => {
    const lit = boss.powered[k];
    ctx.under.line(a.x, a.y, b.x, b.y, (i, n) => {
      const gap = i > n * 0.38 && i < n * 0.62;
      if (lit) return (i + Math.floor(ctx.time * 20)) % 6 === 0 ? P.lime : P.moss;
      return gap ? -1 : i % 2 === 0 ? P.pine : P.forest;
    });
    for (const [end, p] of [['a', a], ['b', b]] as const) {
      ctx.pool.draw('mora_parts', `term${end === 'a' ? 0 : 1}_${lit ? 'lit' : 'dead'}`, p.x, p.y, ySort(p.y));
    }
  });
  // diegetic tell: a vein runs across the floor from Mora toward the conduit it needs
  const want = v.parts.vein?.f ?? -1;
  if (want >= 0 && ctx.sim.fight?.result === 'ongoing') {
    const t = CONDUITS[want]![0];
    const phase = Math.floor(ctx.time * 12);
    ctx.under.line(core.x, core.y + 24, t.x, t.y, (i) => ((i + phase) % 9 < 2 ? P.sprout : (i % 3 === 0 ? P.moss : -1)));
  }
  const spec = v.pose === 'defeat' ? { n: 2, ms: 600, hold: true } : { n: 2, ms: v.pose === 'strain' ? 120 : 460, hold: false };
  const idx = spec.hold ? Math.min(1, Math.floor((v.poseT * 1000) / spec.ms)) : Math.floor((v.poseT * 1000) / spec.ms) % 2;
  ctx.pool.draw('boss_mora', `${v.pose}${idx}`, core.x, core.y + 26, ySort(core.y + 20));
  // root arms: segment chains from base to tip (a sagging curve)
  for (let i = 0; i < 2; i++) {
    const arm = v.parts[`arm${i}`];
    if (!arm) continue;
    const base = MORA.armBase[i]!;
    const n = 7;
    for (let s = 1; s < n; s++) {
      const t = s / n;
      const x = base.x + (arm.x - base.x) * t;
      const sag = Math.sin(t * Math.PI) * (arm.f === 1 ? -14 : 8);
      const y = base.y + (arm.y - base.y) * t + sag;
      ctx.pool.draw('mora_parts', `seg${s % 3}`, x, y, ySort(Math.min(y, arm.y)) - 2);
    }
    const lit = !!arm.on;
    const open = arm.f === 1 || arm.f === 3;
    ctx.pool.draw('mora_parts', `${lit ? 'tipLit' : 'tip'}${open ? 'Open' : ''}`, arm.x, arm.y, ySort(arm.y) + 1);
    if (arm.f === 3) ctx.under.disc(arm.x, arm.y + 4, 10, P.forest, 2, 0);
  }
});
