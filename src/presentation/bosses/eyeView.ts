import { P } from '../art/palette.ts';
import { registerBossView } from './index.ts';
import { ySort, type ViewCtx } from './types.ts';
import { aligned, type EyeBoss } from '../../bosses/definitions/b05Eye.ts';

registerBossView('B05', (ctx: ViewCtx) => {
  const boss = ctx.sim.boss as EyeBoss;
  const v = boss.view;
  const e = v.parts.eye;
  if (!e) return;
  const tide = v.parts.tide?.x ?? 1;
  // tide current: stepped streaks drifting with the flow (direction readable without colour)
  const off = Math.floor(ctx.time * 16 * tide);
  for (let row = 0; row < 6; row++) {
    const y = 90 + row * 30;
    for (let x = 24; x < 392; x += 36) {
      const xx = ((x + off + row * 11) % 368 + 368) % 368 + 24;
      ctx.under.line(xx, y, xx + 6 * tide, y, P.tide);
      ctx.under.px(xx + 7 * tide, y - 1, P.lake);
    }
  }
  // rafts
  for (let i = 0; i < 3; i++) {
    const r = v.parts[`raft${i}`];
    if (!r) continue;
    ctx.under.ring(r.x, r.y + 2, 11 + ((ctx.time * 8 + i * 3) % 4), P.tide, 3, i);
    ctx.pool.draw('eye_parts', `raft${i}`, r.x, r.y, ySort(r.y) - 30);
  }
  const torn = Math.min(3, e.f ?? 0);
  const frame = v.pose === 'open' ? 'open_3' : v.pose === 'defeat' ? 'defeat_3' : `${v.pose === 'blink' ? 'blink' : 'watch'}_${torn}`;
  ctx.pool.draw('boss_eye', frame, e.x, e.y, ySort(e.y + 20));
  if (v.pose !== 'blink' && v.pose !== 'defeat') {
    const look = v.parts.look ?? { x: 0, y: 1 };
    const px = e.x + Math.round(look.x * 8);
    const py = e.y + Math.round(look.y * 4);
    ctx.pool.draw('eye_parts', v.pose === 'open' ? 'pupilGlow' : Math.floor(ctx.time * 2) % 2 ? 'pupil1' : 'pupil0', px, py, ySort(e.y + 20) + 1);
  }
  // alignment hint: a line lying along the fronts shows small cross ticks (mechanical, not a solution marker)
  for (const l of ctx.sim.links) {
    if (!l.valid || !aligned(ctx.sim, l)) continue;
    const a = ctx.sim.needle(l.a).pos;
    const b = ctx.sim.needle(l.b).pos;
    for (let k = 1; k < 4; k++) {
      const x = a.x + ((b.x - a.x) * k) / 4;
      const y = a.y + ((b.y - a.y) * k) / 4;
      ctx.over.px(x, y - 2, P.waveLite);
      ctx.over.px(x, y + 2, P.waveLite);
    }
  }
});
