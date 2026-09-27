// Reactive bot toolkit: shot planning, dodging and luring on top of the input-only ScriptBot model.
import { emptyInput, type InputFrame, type NeedleId } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { raycast, worldCircle, findShape } from '../../core/sim/bodies.ts';
import { pointSegDist2 } from '../../core/geometry/geom.ts';
import { isEmbedded } from '../../resonance/needle.ts';
import { resolveCircle } from '../../core/sim/bodies.ts';
import { TILE, isSolidTile } from '../../world/areaTypes.ts';

export const NIDX: Record<NeedleId, number> = { A: 0, B: 1, C: 2 };

/** is a point inside solid tiles or too close to them (player radius) */
export function blockedAt(sim: Sim, p: Vec, r = 6): boolean {
  for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]] as const) {
    const cx = Math.floor((p.x + dx) / TILE);
    const cy = Math.floor((p.y + dy) / TILE);
    if (isSolidTile(sim.area.tiles[cy]?.[cx])) return true;
  }
  return false;
}

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
  return threat(sim, pos, margin)?.esc ?? null;
}

export function threat(sim: Sim, pos: Vec, margin = 10): { esc: Vec; urgent: boolean } | null {
  let esc: Vec | null = null;
  let urgent = false;
  for (const a of sim.attacks) {
    if (!a.harmful || a.kind === 'front') continue;
    const s = a.phase === 'active' ? a.shape : a.phase === 'telegraph' ? a.tele : null;
    if (!s) continue;
    const before: Vec | null = esc;
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
        // perpendicular away from the lane, unless a wall is right there (then the other side)
        let nx = -vy / l;
        let ny = vx / l;
        const side = (pos.x - s.a.x) * nx + (pos.y - s.a.y) * ny;
        if (side < 0) {
          nx = -nx;
          ny = -ny;
        }
        if (blockedAt(sim, { x: pos.x + nx * 24, y: pos.y + ny * 24 }) || blockedAt(sim, { x: pos.x + nx * 12, y: pos.y + ny * 12 })) {
          nx = -nx;
          ny = -ny;
        }
        esc = { x: nx, y: ny };
      }
    } else if (s.kind === 'ring' && a.phase === 'active') {
      const d = Math.hypot(pos.x - s.c.x, pos.y - s.c.y);
      let inArc = true;
      if (s.arcAng !== undefined) {
        const ang = Math.atan2(pos.y - s.c.y, pos.x - s.c.x);
        const da = Math.abs(Math.atan2(Math.sin(ang - s.arcAng), Math.cos(ang - s.arcAng)));
        inArc = da <= (s.arcHalf ?? Math.PI) + 0.25;
      }
      if (inArc && d > s.rIn - 8 && d < s.rOut + 22) esc = { x: 0, y: 0 }; // ring about to pass: dash through
    }
    if (esc !== before && (a.phase === 'active' || a.p.lock === 1)) urgent = true;
  }
  return esc ? { esc, urgent } : null;
}

export function frame(sim: Sim, aim: Vec): InputFrame {
  return emptyInput(aim);
}

export const embeddedIn = (sim: Sim, id: NeedleId, shapeId: string): boolean => isEmbedded(sim.needle(id)) && sim.needle(id).host?.shapeId === shapeId;

/** no world wall / blocking prop between two points */
export function clearWorldLine(sim: Sim, a: Vec, b: Vec): boolean {
  const hit = raycast(sim.bodies, a, b, (bd, s) => bd.kind === 'world' && s.blocksNeedle);
  return !hit;
}

export interface PlaceTarget {
  shape?: string;
  point?: Vec;
  tol?: number;
}

/** Would a needle thrown from `from` at `p` embed on an anchorable surface within `tol` of `p`? */
export function clearPointShot(sim: Sim, from: Vec, p: Vec, tol: number, reach = 290): boolean {
  const dx = p.x - from.x;
  const dy = p.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d > reach || d < 4) return false;
  const end = { x: from.x + (dx / d) * (d + 24), y: from.y + (dy / d) * (d + 24) };
  const hit = raycast(sim.bodies, from, end, (_b, s) => s.blocksNeedle);
  if (!hit || hit.shape.tag === 'NonAnchorable' || !hit.shape.enabled) return false;
  return Math.hypot(hit.point.x - p.x, hit.point.y - p.y) <= tol;
}

/** Reusable needle placement routine (recall if misplaced, find a clear spot, fire). */
export class Placer {
  aim: Vec = { x: 0, y: 0 };
  private spot: Vec | null = null;
  private spotFor = '';
  cooldown = 0;

  satisfied(sim: Sim, id: NeedleId, t: PlaceTarget): boolean {
    const n = sim.needle(id);
    if (!isEmbedded(n)) return false;
    if (t.shape) return n.host?.shapeId === t.shape;
    if (t.point) return Math.hypot(n.pos.x - t.point.x, n.pos.y - t.point.y) <= (t.tol ?? 14);
    return true;
  }

  place(sim: Sim, f: InputFrame, id: NeedleId, t: PlaceTarget, avoid: Vec[] = []): boolean {
    this.cooldown--;
    const n = sim.needle(id);
    if (this.satisfied(sim, id, t)) return true;
    if (n.state === 'Flying' || n.state === 'Returning') return false;
    if (n.state !== 'Held') {
      if (sim.player.selected !== NIDX[id]) f.selIndex = NIDX[id];
      else f.recall = true;
      return false;
    }
    let target = t.shape ? shapePos(sim, t.shape) : t.point!;
    if (!target) return false;
    const me = sim.player.pos;
    // moving targets (rafts, arms, boss parts): lead the shot by the needle flight time
    let moving = false;
    if (t.shape) {
      const hostBody = findShape(sim.bodies, t.shape)?.body;
      if (hostBody) {
        const vx = (hostBody.pos.x - hostBody.prevPos.x) * 60;
        const vy = (hostBody.pos.y - hostBody.prevPos.y) * 60;
        if (Math.hypot(vx, vy) > 6) {
          moving = true;
          const tf = Math.hypot(target.x - me.x, target.y - me.y) / sim.mods.needleSpeed;
          target = { x: target.x + vx * tf, y: target.y + vy * tf };
        }
      }
    }
    const tgt = target;
    const ok = (from: Vec) =>
      moving
        ? clearWorldLine(sim, from, tgt) && Math.hypot(tgt.x - from.x, tgt.y - from.y) < 220
        : t.shape
          ? clearShot(sim, from, tgt, t.shape)
          : clearPointShot(sim, from, tgt, t.tol ?? 14);
    this.aim = tgt;
    if (ok(me) && this.cooldown <= 0) {
      if (sim.player.selected !== NIDX[id]) {
        f.selIndex = NIDX[id];
        return false;
      }
      f.fire = true;
      this.cooldown = 8;
      this.spot = null;
      return false;
    }
    const key = `${id}:${t.shape ?? `${target.x},${target.y}`}`;
    if (!this.spot || this.spotFor !== key || !ok(this.spot)) {
      this.spotFor = key;
      this.spot = null;
      for (let r = 30; r <= 200 && !this.spot; r += 16) {
        for (let k = 0; k < 32; k++) {
          const a = (k / 32) * Math.PI * 2;
          const p = { x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r };
          const q = resolveCircle(sim.bodies.filter((b) => b.kind === 'world'), p, 6, 3);
          if (Math.hypot(q.x - p.x, q.y - p.y) > 0.5) continue;
          if (avoid.some((v) => Math.hypot(v.x - p.x, v.y - p.y) < 36)) continue;
          if (ok(p)) {
            this.spot = p;
            break;
          }
        }
      }
    }
    if (this.spot) steerTo(sim, f, this.spot);
    return false;
  }
}

/** Standard survival layer: dash through rings, sidestep zones/lanes. Mutates the frame. */
export function survive(sim: Sim, f: InputFrame): void {
  // travelling wave fronts: dash through them toward their origin
  const me0 = sim.player.pos;
  for (const a of sim.attacks) {
    if (a.kind !== 'front' || !a.harmful) continue;
    if (a.phase === 'active' && a.shape?.kind === 'capsule') {
      const y = a.shape.a.y;
      if (me0.x >= a.shape.a.x - 8 && me0.x <= a.shape.b.x + 8 && me0.y > y - 6 && me0.y - y < 26) {
        f.move = { x: 0, y: -1 };
        if (sim.player.dash.cd <= 0 && me0.y - y < 16) f.dash = true;
        return;
      }
    }
  }
  const esc = danger(sim);
  if (!esc) {
    // do not walk into a live lane / zone: probe the intended step
    const m = Math.hypot(f.move.x, f.move.y);
    if (m > 0.05) {
      const me = sim.player.pos;
      const probe = { x: me.x + (f.move.x / m) * 8, y: me.y + (f.move.y / m) * 8 };
      if (danger(sim, probe, 6)) f.move = { x: 0, y: 0 };
    }
    return;
  }
  if (esc.x === 0 && esc.y === 0) {
    const me = sim.player.pos;
    for (const a of sim.attacks) {
      if (a.phase !== 'active' || !a.harmful || a.shape?.kind !== 'ring') continue;
      const s = a.shape;
      const d = Math.hypot(me.x - s.c.x, me.y - s.c.y);
      if (s.arcAng !== undefined && d - s.rOut < 40) {
        // cone: step out sideways, dash only when it is about to land
        const px = -Math.sin(s.arcAng);
        const py = Math.cos(s.arcAng);
        const side = (me.x - s.c.x) * px + (me.y - s.c.y) * py >= 0 ? 1 : -1;
        f.move = { x: px * side, y: py * side };
        if (d - s.rOut < 10 && sim.player.dash.cd <= 0) f.dash = true;
        return;
      }
      if (d - s.rOut < 12 && d > s.rIn - 4) {
        // dash through toward the centre if there is room, otherwise sidestep along the front
        const inx = (s.c.x - me.x) / (d || 1);
        const iny = (s.c.y - me.y) / (d || 1);
        const room = d - s.rIn > 0 && sim.bodies.every((b) => b.kind !== 'boss' || !b.enabled || Math.hypot(b.pos.x - (me.x + inx * 50), b.pos.y - (me.y + iny * 50)) > 26);
        f.move = room ? { x: inx, y: iny } : { x: -iny, y: inx };
        if (sim.player.dash.cd <= 0) f.dash = true;
        return;
      }
    }
    return;
  }
  f.move = esc;
  const th = threat(sim, sim.player.pos);
  if (th?.urgent) {
    // never dash into another live threat
    const me = sim.player.pos;
    const land = { x: me.x + esc.x * 44, y: me.y + esc.y * 44 };
    const mid = { x: me.x + esc.x * 22, y: me.y + esc.y * 22 };
    const others = threat(sim, land, 4) ?? threat(sim, mid, 4);
    if (!others || (others.esc.x === esc.x && others.esc.y === esc.y)) f.dash = true;
  }
}

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
