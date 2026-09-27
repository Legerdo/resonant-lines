// Rigid body transforms + continuous queries over all colliders.
import { type Vec, vec, rotate, sub, add, norm, dot, lerp, len } from '../math/vec.ts';
import { segSeg, rayCircle, segCircle, closestOnSeg } from '../geometry/geom.ts';
import type { Body, Shape, SegShape, CircleShape } from './types.ts';

export const toWorld = (b: Body, p: Vec): Vec => add(b.pos, rotate(p, b.angle));
export const toWorldPrev = (b: Body, p: Vec): Vec => add(b.prevPos, rotate(p, b.prevAngle));
export const toLocal = (b: Body, p: Vec): Vec => rotate(sub(p, b.pos), -b.angle);
export const toLocalPrev = (b: Body, p: Vec): Vec => rotate(sub(p, b.prevPos), -b.prevAngle);
export const dirToWorld = (b: Body, d: Vec): Vec => rotate(d, b.angle);

export function makeBody(id: string, kind: Body['kind'], pos: Vec, shapes: Shape[], angle = 0): Body {
  return { id, kind, pos: { ...pos }, angle, prevPos: { ...pos }, prevAngle: angle, shapes, enabled: true };
}

export function seg(id: string, a: Vec, b: Vec, n: Vec, tag: Shape['tag'], opts: Partial<SegShape> = {}): SegShape {
  return { kind: 'seg', id, a, b, n, tag, blocksLink: true, blocksMove: true, blocksNeedle: true, enabled: true, ...opts };
}

export function circle(id: string, c: Vec, r: number, tag: Shape['tag'], opts: Partial<CircleShape> = {}): CircleShape {
  return { kind: 'circle', id, c, r, tag, blocksLink: false, blocksMove: true, blocksNeedle: true, enabled: true, ...opts };
}

export interface WorldSeg { a: Vec; b: Vec; n: Vec }
export function worldSeg(b: Body, s: SegShape): WorldSeg {
  return { a: toWorld(b, s.a), b: toWorld(b, s.b), n: dirToWorld(b, s.n) };
}
export function worldCircle(b: Body, s: CircleShape): { c: Vec; r: number } {
  return { c: toWorld(b, s.c), r: s.r };
}

export interface RayHit {
  t: number;
  body: Body;
  shape: Shape;
  point: Vec;
  normal: Vec;
  /** hit point / normal in the body's local frame (exact for moving bodies) */
  localPoint: Vec;
  localNormal: Vec;
}

/**
 * Swept point query p0 -> p1 against every enabled shape passing `filter`. Moving bodies are handled with relative
 * motion (start in the previous transform, end in the current one), so fast needles never tunnel through moving parts.
 */
export function raycast(bodies: readonly Body[], p0: Vec, p1: Vec, filter: (b: Body, s: Shape) => boolean, inflate = 0, exclude?: ReadonlySet<string>): RayHit | null {
  let best: RayHit | null = null;
  for (const b of bodies) {
    if (!b.enabled) continue;
    const l0 = toLocalPrev(b, p0);
    const l1 = toLocal(b, p1);
    for (const s of b.shapes) {
      if (!s.enabled || !filter(b, s) || exclude?.has(s.id)) continue;
      let t: number | null = null;
      let nLocal: Vec = vec();
      if (s.kind === 'seg') {
        const h = segSeg(l0, l1, s.a, s.b);
        if (h) {
          t = h.t;
          nLocal = dot(sub(l1, l0), s.n) > 0 ? { x: -s.n.x, y: -s.n.y } : s.n;
        }
      } else {
        const tc = rayCircle(l0, l1, s.c, s.r + inflate);
        if (tc !== null) {
          t = tc;
          const hp = lerp(l0, l1, tc);
          nLocal = norm(sub(hp, s.c));
          if (len(nLocal) < 0.5) nLocal = norm(sub(l0, s.c));
          if (len(nLocal) < 0.5) nLocal = { x: 0, y: -1 };
        }
      }
      if (t === null) continue;
      if (!best || t < best.t || (t === best.t && s.id < best.shape.id)) {
        best = { t, body: b, shape: s, point: lerp(p0, p1, t), normal: dirToWorld(b, nLocal), localPoint: lerp(l0, l1, t), localNormal: nLocal };
      }
    }
  }
  return best;
}

/** Line of sight between two world points against link-blocking shapes (current transforms). */
export function losBlocked(bodies: readonly Body[], a: Vec, b: Vec, exclude: ReadonlySet<string>): boolean {
  for (const body of bodies) {
    if (!body.enabled) continue;
    for (const s of body.shapes) {
      if (!s.enabled || !s.blocksLink || exclude.has(s.id)) continue;
      if (s.kind === 'seg') {
        const w = worldSeg(body, s);
        const h = segSeg(a, b, w.a, w.b);
        // touching exactly at an endpoint (needle resting on this very wall) is not a block
        if (h && h.t > 1e-4 && h.t < 1 - 1e-4) return true;
      } else {
        const w = worldCircle(body, s);
        if (segCircle(a, b, w.c, w.r - 0.5)) return true;
      }
    }
  }
  return false;
}

/** Push a circle out of every movement-blocking shape. Returns the corrected position. */
export function resolveCircle(bodies: readonly Body[], pos: Vec, r: number, iterations = 4): Vec {
  let p = { ...pos };
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const body of bodies) {
      if (!body.enabled) continue;
      for (const s of body.shapes) {
        if (!s.enabled || !s.blocksMove) continue;
        if (s.kind === 'seg') {
          const w = worldSeg(body, s);
          const c = closestOnSeg(p, w.a, w.b);
          const dx = p.x - c.x;
          const dy = p.y - c.y;
          const d = Math.hypot(dx, dy);
          if (d < r) {
            let nx: number;
            let ny: number;
            if (d > 1e-6) {
              nx = dx / d;
              ny = dy / d;
            } else {
              nx = w.n.x;
              ny = w.n.y;
            }
            p = { x: c.x + nx * r, y: c.y + ny * r };
            moved = true;
          }
        } else {
          const w = worldCircle(body, s);
          const dx = p.x - w.c.x;
          const dy = p.y - w.c.y;
          const d = Math.hypot(dx, dy);
          const min = w.r + r;
          if (d < min) {
            const nx = d > 1e-6 ? dx / d : 0;
            const ny = d > 1e-6 ? dy / d : -1;
            p = { x: w.c.x + nx * min, y: w.c.y + ny * min };
            moved = true;
          }
        }
      }
    }
    if (!moved) break;
  }
  return p;
}

export function findShape(bodies: readonly Body[], shapeId: string): { body: Body; shape: Shape } | null {
  for (const b of bodies) for (const s of b.shapes) if (s.id === shapeId) return { body: b, shape: s };
  return null;
}

export function saveTransforms(bodies: readonly Body[]): void {
  for (const b of bodies) {
    b.prevPos.x = b.pos.x;
    b.prevPos.y = b.pos.y;
    b.prevAngle = b.angle;
  }
}
