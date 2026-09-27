// Generic attack primitives. Every hit / capture decision uses these exact shapes (never sprite overlap).
import { DT } from '../../core/clock/fixedStep.ts';
import { type Vec, lerp, fromAngle, add } from '../../core/math/vec.ts';
import { circleRing, segRing, segCircle, pointSegDist2, segSegDist2 } from '../../core/geometry/geom.ts';
import { raycast } from '../../core/sim/bodies.ts';
import type { Attack, AttackShape } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';

export function cloneShape(s: AttackShape | null): AttackShape | null {
  if (!s) return null;
  switch (s.kind) {
    case 'circle':
      return { kind: 'circle', c: { ...s.c }, r: s.r };
    case 'ring': {
      const r: AttackShape = { kind: 'ring', c: { ...s.c }, rIn: s.rIn, rOut: s.rOut };
      if (s.arcAng !== undefined) r.arcAng = s.arcAng;
      if (s.arcHalf !== undefined) r.arcHalf = s.arcHalf;
      return r;
    }
    case 'capsule':
      return { kind: 'capsule', a: { ...s.a }, b: { ...s.b }, r: s.r };
  }
}

/** Interpolate between the previous and current attack shape for sub-tick sampling. */
export function lerpShape(a: AttackShape | null, b: AttackShape, t: number): AttackShape {
  if (!a || a.kind !== b.kind) return b;
  if (a.kind === 'circle' && b.kind === 'circle') return { kind: 'circle', c: lerp(a.c, b.c, t), r: a.r + (b.r - a.r) * t };
  if (a.kind === 'ring' && b.kind === 'ring') {
    const r: AttackShape = { kind: 'ring', c: lerp(a.c, b.c, t), rIn: a.rIn + (b.rIn - a.rIn) * t, rOut: a.rOut + (b.rOut - a.rOut) * t };
    if (b.arcAng !== undefined) r.arcAng = b.arcAng;
    if (b.arcHalf !== undefined) r.arcHalf = b.arcHalf;
    return r;
  }
  if (a.kind === 'capsule' && b.kind === 'capsule') return { kind: 'capsule', a: lerp(a.a, b.a, t), b: lerp(a.b, b.b, t), r: a.r + (b.r - a.r) * t };
  return b;
}

export function shapeHitsCircle(s: AttackShape, c: Vec, r: number): boolean {
  switch (s.kind) {
    case 'circle':
      return (s.c.x - c.x) ** 2 + (s.c.y - c.y) ** 2 <= (s.r + r) ** 2;
    case 'ring':
      return circleRing(c, r, s.c, s.rIn, s.rOut, s.arcAng !== undefined ? { ang: s.arcAng, half: s.arcHalf ?? Math.PI } : undefined);
    case 'capsule':
      return pointSegDist2(c, s.a, s.b) <= (s.r + r) ** 2;
  }
}

export function shapeHitsSegment(s: AttackShape, a: Vec, b: Vec, tol: number): boolean {
  switch (s.kind) {
    case 'circle':
      return segCircle(a, b, s.c, s.r + tol);
    case 'ring':
      return segRing(a, b, s.c, Math.max(0, s.rIn - tol), s.rOut + tol, s.arcAng !== undefined ? { ang: s.arcAng, half: s.arcHalf ?? Math.PI } : undefined);
    case 'capsule':
      return segSegDist2(a, b, s.a, s.b) <= (s.r + tol) ** 2;
  }
}

export function shapeCenter(s: AttackShape): Vec {
  return s.kind === 'capsule' ? lerp(s.a, s.b, 0.5) : s.c;
}

type AttackInit = Partial<Attack> & { kind: string; owner: string };

export function makeAttack(id: number, init: AttackInit): Attack {
  return {
    id,
    sig: null,
    tone: -1,
    phase: 'telegraph',
    t: 0,
    age: 0,
    shape: null,
    prevShape: null,
    tele: null,
    harmful: true,
    lethal: false,
    capturable: false,
    continuous: false,
    hitPlayer: false,
    p: {},
    ...init,
  };
}

export function setPhase(sim: Sim, a: Attack, phase: Attack['phase']): void {
  a.phase = phase;
  a.t = 0;
  if (phase === 'active') {
    const c = a.shape ? shapeCenter(a.shape) : a.tele ? shapeCenter(a.tele) : undefined;
    sim.emit({ type: 'attack', id: a.kind, sig: a.sig, value: a.id, ...(c ? { pos: { ...c } } : {}) });
  }
}

/**
 * Built-in behaviours (bosses can also drive attacks manually with kind 'custom').
 *  ring:       p {x,y,r,speed,rMax,th,tele,arcAng?,arcHalf?}
 *  zone:       p {x,y,r,tele,active}
 *  projectile: p {x,y,vx,vy,r,range}
 *  beam:       p {x,y,ang,len,w,spin,tele,active}
 */
export function updateAttack(sim: Sim, a: Attack): void {
  a.age += DT;
  a.t += DT;
  const p = a.p;
  switch (a.kind) {
    case 'ring': {
      const arc = p.arcHalf !== undefined ? { arcAng: p.arcAng ?? 0, arcHalf: p.arcHalf } : {};
      if (a.phase === 'telegraph') {
        a.tele = { kind: 'ring', c: { x: p.x!, y: p.y! }, rIn: 0, rOut: Math.min(p.rMax!, 24 + a.t * 40), ...arc };
        if (a.t >= (p.tele ?? 0)) {
          a.shape = { kind: 'ring', c: { x: p.x!, y: p.y! }, rIn: Math.max(0, p.r! - p.th!), rOut: p.r!, ...arc };
          setPhase(sim, a, 'active');
        }
      } else if (a.phase === 'active') {
        p.r = p.r! + p.speed! * DT;
        a.shape = { kind: 'ring', c: { x: p.x!, y: p.y! }, rIn: Math.max(0, p.r - p.th!), rOut: p.r, ...arc };
        if (p.r >= p.rMax!) setPhase(sim, a, 'done');
      }
      break;
    }
    case 'zone': {
      if (a.phase === 'telegraph') {
        a.tele = { kind: 'circle', c: { x: p.x!, y: p.y! }, r: p.r! };
        if (a.t >= p.tele!) {
          a.shape = { kind: 'circle', c: { x: p.x!, y: p.y! }, r: p.r! };
          setPhase(sim, a, 'active');
        }
      } else if (a.phase === 'active') {
        if (a.t >= p.active!) setPhase(sim, a, 'done');
      }
      break;
    }
    case 'projectile': {
      if (a.phase === 'telegraph') {
        a.shape = { kind: 'circle', c: { x: p.x!, y: p.y! }, r: p.r! };
        setPhase(sim, a, 'active');
      }
      if (a.phase === 'active') {
        const from = { x: p.x!, y: p.y! };
        const to = { x: p.x! + p.vx! * DT, y: p.y! + p.vy! * DT };
        const hit = raycast(sim.bodies, from, to, (b, s) => b.kind === 'world' && s.blocksNeedle && s.kind === 'seg');
        p.x = hit ? hit.point.x : to.x;
        p.y = hit ? hit.point.y : to.y;
        p.range = (p.range ?? 400) - Math.hypot(p.vx!, p.vy!) * DT;
        a.shape = { kind: 'circle', c: { x: p.x, y: p.y }, r: p.r! };
        if (hit || p.range <= 0) setPhase(sim, a, 'done');
      }
      break;
    }
    case 'beam': {
      const ang = p.ang! + (p.spin ?? 0) * a.age;
      const o = { x: p.x!, y: p.y! };
      const end = add(o, fromAngle(ang, p.len!));
      if (a.phase === 'telegraph') {
        a.tele = { kind: 'capsule', a: o, b: end, r: 1 };
        if (a.t >= p.tele!) {
          a.shape = { kind: 'capsule', a: o, b: end, r: p.w! };
          setPhase(sim, a, 'active');
        }
      } else if (a.phase === 'active') {
        a.shape = { kind: 'capsule', a: o, b: end, r: p.w! };
        if (a.t >= p.active!) setPhase(sim, a, 'done');
      }
      break;
    }
    default:
      break; // 'custom' and boss-owned kinds are driven by their owner
  }
}
