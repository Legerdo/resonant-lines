// Reactive bot toolkit: shot planning, dodging and luring on top of the input-only ScriptBot model.
import { emptyInput, type InputFrame, type NeedleId } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { raycast, worldCircle, findShape } from '../../core/sim/bodies.ts';
import { pointSegDist2 } from '../../core/geometry/geom.ts';
import { isEmbedded } from '../../resonance/needle.ts';
import { resolveCircle } from '../../core/sim/bodies.ts';

export const NIDX: Record<NeedleId, number> = { A: 0, B: 1, C: 2 };

export function shapePos(sim: Sim, shapeId: string): Vec | null {
  const f = findShape(sim.bodies, shapeId);
  if (!f) return null;
  if (f.shape.kind === 'circle') return worldCircle(f.body, f.shape).c;
  const s = f.shape;
  const c = Math.cos(f.body.angle);
  const sn = Math.sin(f.body.angle);
  const mx = (s.a.x + s.b.x) / 2;
  const my = (s.a.y + s.b.y) / 2;
  return { x: f.body.pos.x + mx * c - my * sn, y: f.body.pos.y + mx * sn + my * c };
}

/** Would a needle fired from `from` toward `to` first hit `shapeId`? */
export function clearShot(sim: Sim, from: Vec, to: Vec, shapeId: string, reach = 290): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d > reach || d < 4) return false;
  const end = { x: from.x + (dx / d) * (d + 20), y: from.y + (dy / d) * (d + 20) };
  const hit = raycast(sim.bodies, from, end, (_b, s) => s.blocksNeedle);
  return !!hit && hit.shape.id === shapeId;
}

/** Candidate standing spots with a clear shot at a target shape, sorted by travel distance. */
export function throwSpots(sim: Sim, target: Vec, shapeId: string, avoid: Vec[] = [], minAvoid = 40): Vec[] {
  const out: { p: Vec; score: number }[] = [];
  const me = sim.player.pos;
  for (let r = 40; r <= 200; r += 20) {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const p = { x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r };
      const q = resolveCircle(sim.bodies.filter((b) => b.kind === 'world'), p, 6, 3);
      if (Math.hypot(q.x - p.x, q.y - p.y) > 0.5) continue; // inside a wall
      if (avoid.some((v) => Math.hypot(v.x - p.x, v.y - p.y) < minAvoid)) continue;
      if (!clearShot(sim, p, target, shapeId)) continue;
      out.push({ p, score: Math.hypot(p.x - me.x, p.y - me.y) });
    }
  }
  return out.sort((a, b) => a.score - b.score).map((o) => o.p);
}

export function steerTo(sim: Sim, f: InputFrame, target: Vec, tol = 3): boolean {
  const p = sim.player.pos;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d <= tol) return true;
  const k = d < 6 ? Math.max(0.3, d / 6) : 1;
  f.move = { x: (dx / d) * k, y: (dy / d) * k };
  return false;
}

/** Danger from telegraphed / active attacks at the player position: returns a unit escape direction or null. */
export function danger(sim: Sim, pos: Vec = sim.player.pos, margin = 10): Vec | null {
  let esc: Vec | null = null;
  for (const a of sim.attacks) {
    if (!a.harmful) continue;
    const s = a.phase === 'active' ? a.shape : a.phase === 'telegraph' ? a.tele : null;
    if (!s) continue;
    if (s.kind === 'circle') {
      const r = (a.phase === 'telegraph' ? (a.p.r ?? s.r) : s.r) + margin;
      const dx = pos.x - s.c.x;
      const dy = pos.y - s.c.y;
      const d = Math.hypot(dx, dy);
      if (d < r) esc = d > 0.1 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 };
    } else if (s.kind === 'capsule') {
      const w = (a.p.w ?? s.r) + margin + 6;
      if (pointSegDist2(pos, s.a, s.b) < w * w) {
        const vx = s.b.x - s.a.x;
        const vy = s.b.y - s.a.y;
        const l = Math.hypot(vx, vy) || 1;
        // perpendicular away from the lane
        let nx = -vy / l;
        let ny = vx / l;
        const side = (pos.x - s.a.x) * nx + (pos.y - s.a.y) * ny;
        if (side < 0) {
          nx = -nx;
          ny = -ny;
        }
        esc = { x: nx, y: ny };
      }
    } else if (s.kind === 'ring' && a.phase === 'active') {
      const d = Math.hypot(pos.x - s.c.x, pos.y - s.c.y);
      if (d > s.rIn - margin - 14 && d < s.rOut + 4) esc = { x: 0, y: 0 }; // ring about to pass: dash through
    }
  }
  return esc;
}

export function frame(sim: Sim, aim: Vec): InputFrame {
  return emptyInput(aim);
}

export const embeddedIn = (sim: Sim, id: NeedleId, shapeId: string): boolean => isEmbedded(sim.needle(id)) && sim.needle(id).host?.shapeId === shapeId;

/** point on the far side of a segment from `from`, offset `off` px from the segment's closest point */
export function lurePoint(a: Vec, b: Vec, from: Vec, off: number): Vec {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const l = Math.hypot(vx, vy) || 1;
  let nx = -vy / l;
  let ny = vx / l;
  const side = (from.x - a.x) * nx + (from.y - a.y) * ny;
  if (side > 0) {
    nx = -nx;
    ny = -ny;
  }
  // closest point of the segment to `from`, then step across
  const t = Math.max(0.2, Math.min(0.8, ((from.x - a.x) * vx + (from.y - a.y) * vy) / (l * l)));
  return { x: a.x + vx * t + nx * off, y: a.y + vy * t + ny * off };
}
