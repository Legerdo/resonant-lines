// Exact 2D geometry used by every gameplay decision (needles, links, capture, pulse, hits).
import { type Vec, cross, dot, sub, len2, dist2, clamp } from '../math/vec.ts';

export interface SegHit {
  t: number; // along p0->p1
  u: number; // along q0->q1
}

/** Segment p0-p1 vs segment q0-q1. Returns parameters of the intersection or null (parallel/none). */
export function segSeg(p0: Vec, p1: Vec, q0: Vec, q1: Vec): SegHit | null {
  const r = sub(p1, p0);
  const s = sub(q1, q0);
  const denom = cross(r, s);
  if (Math.abs(denom) < 1e-12) return null;
  const qp = sub(q0, p0);
  const t = cross(qp, s) / denom;
  const u = cross(qp, r) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u };
}

/** First entry parameter t in [0,1] of the moving point p0->p1 into circle (c, r). 0 if already inside. */
export function rayCircle(p0: Vec, p1: Vec, c: Vec, r: number): number | null {
  const d = sub(p1, p0);
  const f = sub(p0, c);
  const a = len2(d);
  const cc = len2(f) - r * r;
  if (cc <= 0) return 0;
  if (a < 1e-12) return null;
  const b = 2 * dot(f, d);
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

export function closestOnSeg(p: Vec, a: Vec, b: Vec): { t: number; x: number; y: number } {
  const ab = sub(b, a);
  const l2 = len2(ab);
  const t = l2 < 1e-12 ? 0 : clamp(dot(sub(p, a), ab) / l2, 0, 1);
  return { t, x: a.x + ab.x * t, y: a.y + ab.y * t };
}

export function pointSegDist2(p: Vec, a: Vec, b: Vec): number {
  const c = closestOnSeg(p, a, b);
  return (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
}

export function segSegDist2(a0: Vec, a1: Vec, b0: Vec, b1: Vec): number {
  if (segSeg(a0, a1, b0, b1)) return 0;
  return Math.min(pointSegDist2(a0, b0, b1), pointSegDist2(a1, b0, b1), pointSegDist2(b0, a0, a1), pointSegDist2(b1, a0, a1));
}

export const segCircle = (a: Vec, b: Vec, c: Vec, r: number): boolean => pointSegDist2(c, a, b) <= r * r;
export const circleCircle = (a: Vec, ra: number, b: Vec, rb: number): boolean => dist2(a, b) <= (ra + rb) * (ra + rb);

export function triArea(a: Vec, b: Vec, c: Vec): number {
  return Math.abs(cross(sub(b, a), sub(c, a))) / 2;
}

export function pointInTriangle(p: Vec, a: Vec, b: Vec, c: Vec): boolean {
  const d1 = cross(sub(b, a), sub(p, a));
  const d2 = cross(sub(c, b), sub(p, b));
  const d3 = cross(sub(a, c), sub(p, c));
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** Does the segment a-b touch the annulus (c, rIn..rOut), optionally restricted to an arc (centre angle, half width)? */
export function segRing(a: Vec, b: Vec, c: Vec, rIn: number, rOut: number, arc?: { ang: number; half: number }): boolean {
  const dMin2 = pointSegDist2(c, a, b);
  const dMax2 = Math.max(dist2(c, a), dist2(c, b));
  if (dMin2 > rOut * rOut || dMax2 < rIn * rIn) return false;
  if (!arc) return true;
  // sample along the segment (segments are short: <= ~220px), 2px resolution
  const steps = Math.max(2, Math.ceil(Math.sqrt(dist2(a, b)) / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t - c.x;
    const y = a.y + (b.y - a.y) * t - c.y;
    const d2 = x * x + y * y;
    if (d2 < rIn * rIn || d2 > rOut * rOut) continue;
    const da = Math.abs(angleWrap(Math.atan2(y, x) - arc.ang));
    if (da <= arc.half) return true;
  }
  return false;
}

export function circleRing(p: Vec, pr: number, c: Vec, rIn: number, rOut: number, arc?: { ang: number; half: number }): boolean {
  const d = Math.sqrt(dist2(p, c));
  if (d + pr < rIn || d - pr > rOut) return false;
  if (!arc) return true;
  const da = Math.abs(angleWrap(Math.atan2(p.y - c.y, p.x - c.x) - arc.ang));
  const slack = d > 1 ? Math.asin(Math.min(1, pr / d)) : Math.PI;
  return da <= arc.half + slack;
}

function angleWrap(a: number): number {
  let r = a % (Math.PI * 2);
  if (r <= -Math.PI) r += Math.PI * 2;
  if (r > Math.PI) r -= Math.PI * 2;
  return r;
}

/** Signed side of point p relative to directed line a->b (positive = left). */
export const side = (p: Vec, a: Vec, b: Vec): number => cross(sub(b, a), sub(p, a));
