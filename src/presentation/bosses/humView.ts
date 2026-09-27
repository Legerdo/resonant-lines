import { P } from '../art/palette.ts';
import { registerBossView } from './index.ts';
import { ySort, type ViewCtx } from './types.ts';
import type { HummingBoss } from '../../bosses/definitions/b02Humming.ts';

const FRAMES: Record<string, { n: number; ms: number; hold?: boolean }> = {
  idle: { n: 2, ms: 420 },
  inhale: { n: 2, ms: 240 },
  sing: { n: 2, ms: 60 },
  open: { n: 2, ms: 380 },
  defeat: { n: 2, ms: 500, hold: true },
};

/** waveform glyph: size/period encode pitch (low = wide slow, high = tight fast); chord = all three */
function pitchGlyph(ctx: ViewCtx, x: number, y: number, tone: number): void {
  const tones = tone === 3 ? [0, 1, 2] : [tone];
  for (const k of tones) {
    const amp = [4, 3, 2][k]!;
    const wl = [18, 10, 5][k]!;
    const c = [P.wave, P.waveLite, P.bone][k]!;
    const phase = ctx.time * [4, 7, 12][k]!;
    let px = -99;
    let py = 0;
    for (let i = -18; i <= 18; i++) {
      const yy = Math.round(y + Math.sin((i / wl) * Math.PI * 2 + phase) * amp) + (tone === 3 ? (k - 1) * 3 : 0);
      if (px !== -99 && Math.abs(yy - py) > 1) ctx.over.line(x + i - 1, py, x + i, yy, c);
      else ctx.over.px(x + i, yy, c);
      px = x + i;
      py = yy;
    }
  }
}

registerBossView('B02', (ctx: ViewCtx) => {
  const boss = ctx.sim.boss as HummingBoss;
  const v = boss.view;
  const body = v.parts.body;
  if (!body) return;
  // bells (boss-owned props)
  for (const p of ctx.sim.area.props) {
    if (p.kind !== 'bell') continue;
    const st = v.props[p.id] ?? 'idle';
    const frame = st === 'ring' ? (Math.floor(ctx.time * 16) % 2 === 0 ? 'ring' : 'ring1') : st;
    ctx.pool.draw('bells', `bell_${p.variant ?? 0}_${frame}`, p.pos.x, p.pos.y + (p.r ?? 0), ySort(p.pos.y));
  }
  const spec = FRAMES[v.pose] ?? FRAMES.idle!;
  const idx = spec.hold ? Math.min(spec.n - 1, Math.floor((v.poseT * 1000) / spec.ms)) : Math.floor((v.poseT * 1000) / spec.ms) % spec.n;
  const px = body.x;
  const py = body.y + 26;
  // floating: dithered shadow far below the bell
  ctx.under.disc(px, body.y + 30, 14, P.night, 1, 0);
  const img = ctx.pool.draw('boss_hum', `${v.pose}${idx}`, px, py, ySort(body.y + 20));
  if (img && v.flash > 0 && ctx.opts.flash) img.setVisible(ctx.frame % 2 === 0);
  const pitch = v.parts.pitch;
  if (pitch?.on && ctx.sim.fight?.result === 'ongoing') pitchGlyph(ctx, pitch.x, pitch.y - 4, pitch.f ?? 0);
  const clap = v.parts.clapper;
  if (clap?.on) {
    ctx.over.line(body.x, body.y + 10, clap.x, clap.y - 6, (i) => (i % 3 === 2 ? -1 : P.stone));
    ctx.pool.draw('boss_hum', clap.f ? 'clapper_lit' : 'clapper_dim', clap.x, clap.y + 6, ySort(clap.y + 6));
    if (clap.f) ctx.under.ring(clap.x, clap.y, 8, Math.floor(ctx.time * 6) % 2 === 0 ? P.reso : P.resoDeep, 2, ctx.frame);
  }
});
