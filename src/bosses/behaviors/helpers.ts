// Shared boss behaviour helpers (pure over Sim state).
import { DT } from '../../core/clock/fixedStep.ts';
import { type Vec, add, scale, dist, sub, norm, len } from '../../core/math/vec.ts';
import { resolveCircle, raycast } from '../../core/sim/bodies.ts';
import type { Body, Needle } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { isEmbedded } from '../../resonance/needle.ts';

/**
 * Move a boss body (circle radius r) along dir at speed. Collides with movement-blocking shapes of every other body.
 * Returns the contact point when the body hits something this tick, else null.
 */
export function moveBody(sim: Sim, body: Body, dir: Vec, speed: number, r: number): Vec | null {
  const want = add(body.pos, scale(dir, speed * DT));
  const others = sim.bodies.filter((b) => b !== body);
  const got = resolveCircle(others, want, r, 3);
  const pushed = dist(got, want) > 0.05;
  body.pos = got;
  if (!pushed) return null;
  return add(got, scale(dir, r));
}

/** Distance from p along dir until a world wall (for lane telegraphs). */
export function wallDistance(sim: Sim, p: Vec, dir: Vec, max = 600): number {
  const hit = raycast(sim.bodies, p, add(p, scale(dir, max)), (b, s) => b.kind === 'world' && s.blocksMove);
  return hit ? hit.t * max : max;
}

/** Knock embedded world needles loose near an impact point (wall-breaker crash). */
export function dislodgeNear(sim: Sim, p: Vec, radius: number): Needle[] {
  const out: Needle[] = [];
  for (const n of sim.needles) {
    if (n.state === 'EmbeddedWorld' && dist(n.pos, p) <= radius) {
      sim.disableNeedle(n, 1.0);
      out.push(n);
    }
  }
  return out;
}

export function dirTo(from: Vec, to: Vec, fallback: Vec = { x: 0, y: 1 }): Vec {
  const d = sub(to, from);
  return len(d) > 0.5 ? norm(d) : fallback;
}

export function embeddedOn(sim: Sim, shapeId: string): Needle | undefined {
  return sim.needles.find((n) => isEmbedded(n) && n.host?.shapeId === shapeId);
}

export const approachAngle = (cur: number, target: number, step: number): number => {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= step) return target;
  return cur + Math.sign(d) * step;
};
