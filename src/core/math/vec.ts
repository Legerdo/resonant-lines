export interface Vec {
  x: number;
  y: number;
}

export const vec = (x = 0, y = 0): Vec => ({ x, y });
export const copy = (a: Vec): Vec => ({ x: a.x, y: a.y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const addScaled = (a: Vec, b: Vec, s: number): Vec => ({ x: a.x + b.x * s, y: a.y + b.y * s });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const len2 = (a: Vec): number => a.x * a.x + a.y * a.y;
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a: Vec, b: Vec): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });
export const angleOf = (a: Vec): number => Math.atan2(a.y, a.x);
export const fromAngle = (ang: number, l = 1): Vec => ({ x: Math.cos(ang) * l, y: Math.sin(ang) * l });

export function norm(a: Vec): Vec {
  const l = Math.hypot(a.x, a.y);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

export function rotate(a: Vec, ang: number): Vec {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

export function clampLen(a: Vec, max: number): Vec {
  const l = Math.hypot(a.x, a.y);
  return l > max && l > 0 ? { x: (a.x / l) * max, y: (a.y / l) * max } : { x: a.x, y: a.y };
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Wrap angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r <= -Math.PI) r += Math.PI * 2;
  if (r > Math.PI) r -= Math.PI * 2;
  return r;
}

export const angleDiff = (a: number, b: number): number => wrapAngle(a - b);

export function approach(cur: number, target: number, step: number): number {
  if (cur < target) return Math.min(cur + step, target);
  return Math.max(cur - step, target);
}

export const isFiniteVec = (a: Vec): boolean => Number.isFinite(a.x) && Number.isFinite(a.y);
