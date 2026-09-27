import { P, SIG_COLORS } from '../art/palette.ts';
import { registerBossView } from './index.ts';
import { ySort, type ViewCtx } from './types.ts';
import type { CrownBoss } from '../../bosses/definitions/b08Crown.ts';

registerBossView('B08', (ctx: ViewCtx) => {
  const boss = ctx.sim.boss as CrownBoss;
  const v = boss.view;
  const b = v.parts.body;
  if (!b) return;
  let pose = v.pose.startsWith('act_') ? v.pose.replace('act_', 'tell_') : v.pose;
  if (pose === 'tell_ring') pose = 'tell_shards';
  if (!ctx.assets.has('boss_crown', `${pose}0`)) pose = 'idle';
  const n = Math.floor(ctx.time * (pose.startsWith('tell') ? 8 : 2.5)) % 2;
  const frame = pose === 'defeat' ? `defeat${Math.min(1, Math.floor(v.poseT * 1.5))}` : `${pose}${n}`;
  ctx.under.disc(b.x, b.y + 30, 10, P.night, 1, 0);
  ctx.pool.draw('boss_crown', frame, b.x, b.y, ySort(b.y + 26));
  // receptive gem: a ring whose SHAPE matches the signature it will accept (colour second)
  const gem = v.parts.gem;
  if (gem && gem.f) {
    const sig = gem.f === 1 ? 'Void' : gem.f === 2 ? 'Impact' : 'Wave';
    const [c0, c1] = SIG_COLORS[sig];
    const r = 7 + (Math.floor(ctx.time * 10) % 3);
    if (sig === 'Void') ctx.over.ring(gem.x, gem.y, r, c1, 2, ctx.frame >> 1);
    else if (sig === 'Impact') {
      for (let k = -r; k <= r; k += 2) {
        ctx.over.px(gem.x + k, gem.y - r, c1);
        ctx.over.px(gem.x + k, gem.y + r, c0);
      }
    } else {
      ctx.over.ring(gem.x, gem.y, r, c1);
      ctx.over.ring(gem.x, gem.y, r - 3, c0);
    }
  }
  // what the crown is reading: three tiny glyph bars over it (long / net / reliance)
  const read = v.parts.read;
  if (read && ctx.sim.fight?.result === 'ongoing') {
    const vals = [read.x, read.y, read.f ?? 0];
    vals.forEach((val, i) => {
      const h = Math.min(6, Math.round(val * 1.5));
      for (let k = 0; k < h; k++) ctx.over.px(b.x - 5 + i * 5, b.y - 34 - k, k < 2 ? P.voidD : P.voidL);
    });
  }
  const press = v.parts.press;
  if (press?.on) ctx.under.ring(press.x, press.y, 3, P.flare);
});
