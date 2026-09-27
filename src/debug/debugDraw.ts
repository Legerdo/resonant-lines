// F1..F6 geometry overlays (debug builds / ?debug=1 only).
import { P } from '../presentation/art/palette.ts';
import type { PixelLayer } from '../presentation/pixelLayer.ts';
import type { Sim } from '../core/sim/sim.ts';
import { worldCircle, worldSeg } from '../core/sim/bodies.ts';
import { planPulse } from '../resonance/pulse.ts';

export interface DebugFlags {
  any: boolean;
  hurtbox: boolean; // F1
  boss: boolean; // F2
  links: boolean; // F3
  capture: boolean; // F4
  pulse: boolean; // F5
  step: boolean; // F6
}

export const noDebug = (): DebugFlags => ({ any: false, hurtbox: false, boss: false, links: false, capture: false, pulse: false, step: false });

const captureMarks: { x: number; y: number; t: number }[] = [];

export function drawDebug(l: PixelLayer, sim: Sim, f: DebugFlags): void {
  if (f.hurtbox) {
    l.ring(sim.player.pos.x, sim.player.pos.y, sim.player.radius, P.lime);
    for (const b of sim.bodies) {
      if (!b.enabled) continue;
      for (const s of b.shapes) {
        if (!s.enabled) continue;
        const c = s.tag === 'NonAnchorable' ? P.stone : s.tag === 'BossAnchorable' ? P.flare : P.reso;
        if (s.kind === 'seg') {
          const w = worldSeg(b, s);
          l.line(w.a.x, w.a.y, w.b.x, w.b.y, (i) => (i % 2 === 0 ? c : -1));
        } else {
          const w = worldCircle(b, s);
          l.ring(w.c.x, w.c.y, w.r, s.hazard ? P.heat : c);
          // moving anchor velocity
          const v = { x: b.pos.x - b.prevPos.x, y: b.pos.y - b.prevPos.y };
          if (Math.hypot(v.x, v.y) > 0.01) l.line(w.c.x, w.c.y, w.c.x + v.x * 8, w.c.y + v.y * 8, P.bone);
        }
      }
    }
    for (const a of sim.attacks) {
      const s = a.shape ?? a.tele;
      if (!s) continue;
      const c = a.phase === 'active' ? P.heatLite : P.voidL;
      if (s.kind === 'circle') l.ring(s.c.x, s.c.y, s.r, c);
      else if (s.kind === 'ring') {
        l.ring(s.c.x, s.c.y, s.rOut, c);
        l.ring(s.c.x, s.c.y, s.rIn, c, 2);
      } else l.line(s.a.x, s.a.y, s.b.x, s.b.y, c);
    }
  }
  if (f.links) {
    for (const k of sim.links) {
      const a = sim.needle(k.a).pos;
      const b = sim.needle(k.b).pos;
      if (!k.valid) l.line(a.x, a.y, b.x, b.y, (i) => (i % 3 === 0 ? P.heat : -1));
    }
    for (const n of sim.needles) l.ring(n.pos.x, n.pos.y, 2, n.state === 'Disabled' ? P.heat : P.lime);
  }
  if (f.capture) {
    for (const e of sim.events) if ((e.type === 'capture' || e.type === 'overload') && e.pos) captureMarks.push({ x: e.pos.x, y: e.pos.y, t: 90 });
    for (const m of captureMarks) {
      m.t--;
      l.ring(m.x, m.y, 4, P.flare);
      l.px(m.x, m.y, P.bone);
    }
    while (captureMarks.length && captureMarks[0]!.t <= 0) captureMarks.shift();
  }
  if (f.pulse) {
    const plan = planPulse(sim);
    if (plan) for (const k of plan.links) {
      const from = sim.needle(k.a === plan.target.id ? k.b : k.a).pos;
      l.line(from.x, from.y, plan.target.pos.x, plan.target.pos.y, (i) => (i % 2 === 0 ? P.bone : P.voidL));
    }
  }
}
