// Area props: static art keyed by PropDef.kind (+ state from boss view / area logic, region variants).
import { P } from './art/palette.ts';
import { ySort, type ViewCtx } from './bosses/types.ts';
import { worldCircle } from '../core/sim/bodies.ts';

const ANIMATED: Record<string, number> = { lamp: 4 };

export function propFrame(ctx: ViewCtx, kind: string, variant: number | undefined, state: string | undefined): string | null {
  const a = ctx.assets;
  const region = ctx.sim.area.region;
  const cands: string[] = [];
  if (state !== undefined && variant !== undefined) cands.push(`${kind}_${variant}_${state}`);
  if (state !== undefined) cands.push(`${kind}_${state}`);
  cands.push(`${kind}_${region}`);
  if (variant !== undefined) cands.push(`${kind}_${variant}`);
  const anim = ANIMATED[kind];
  if (anim) cands.push(`${kind}_${(Math.floor(ctx.time * 8) + (variant ?? 0)) % anim}`);
  cands.push(kind);
  for (const c of cands) if (a.has('props', c)) return c;
  return null;
}

export function drawProps(ctx: ViewCtx): void {
  const { sim } = ctx;
  const logicView = sim.logic?.view ?? {};
  const bossProps = sim.boss?.view.props ?? {};
  const bossesDone = [...sim.flags].filter((f) => f.startsWith('boss:') && f !== 'boss:FINAL').length;
  for (const p of sim.area.props) {
    if (p.ifFlag && !sim.flags.has(p.ifFlag)) continue;
    if (p.unlessFlag && sim.flags.has(p.unlessFlag)) continue;
    let state: string | undefined = bossProps[p.id];
    const lv = logicView[p.id];
    if (state === undefined && lv !== undefined) state = lv >= 1 ? 'on' : 'off';
    let variant = p.variant;
    if (p.kind === 'heartDoor') {
      state = undefined;
      variant = sim.flags.has('finalGate') ? undefined : Math.min(5, bossesDone);
      if (sim.flags.has('finalGate')) state = 'open';
    }
    const f = propFrame(ctx, p.kind, variant, state);
    if (f) ctx.pool.draw('props', f, p.pos.x, p.pos.y + (p.r ?? 0), ySort(p.pos.y));
    else {
      // dev fallback only; the RC check asserts no missing prop frames (A23)
      ctx.assets.missing.add(`props/${p.kind}`);
      ctx.under.ring(p.pos.x, p.pos.y, p.r ?? 6, P.heat, 2, 0);
    }
  }
  // resonance sockets of mechanisms (barriers): a carved ring that reads as "plant a needle here"
  for (const b of sim.bodies) {
    if (!b.enabled || b.kind !== 'mechanism') continue;
    for (const s of b.shapes) {
      if (!s.enabled || s.kind !== 'circle' || !s.receiver) continue;
      const w = worldCircle(b, s);
      ctx.under.disc(w.c.x, w.c.y, w.r, P.night);
      ctx.under.ring(w.c.x, w.c.y, w.r, P.resoDeep);
      ctx.under.ring(w.c.x, w.c.y, w.r - 3, Math.floor(ctx.time * 2) % 2 === 0 ? P.reso : P.resoDeep);
    }
  }
}
