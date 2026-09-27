// Resonance needles (LOCKED-R01): exactly three objects A/B/C exist for the lifetime of a Sim; only their state changes.
import { DT } from '../core/clock/fixedStep.ts';
import { add, scale, copy, sub, len, norm, rotate, dot, dist } from '../core/math/vec.ts';
import { CFG } from '../core/sim/config.ts';
import { raycast, toWorld, dirToWorld, type RayHit } from '../core/sim/bodies.ts';
import { isAnchorTag, type Needle, type Shape } from '../core/sim/types.ts';
import type { Sim } from '../core/sim/sim.ts';

export const isEmbedded = (n: Needle): boolean => n.state === 'EmbeddedWorld' || n.state === 'EmbeddedBoss';
export const isOut = (n: Needle): boolean => n.state !== 'Held';

export function fireNeedle(sim: Sim): boolean {
  const p = sim.player;
  if (p.fireCd > 0) return false;
  const order = [p.selected, (p.selected + 1) % 3, (p.selected + 2) % 3];
  const idx = order.find((i) => sim.needles[i]!.state === 'Held');
  if (idx === undefined) {
    sim.emit({ type: 'sfx', text: 'empty', pos: copy(p.pos) });
    return false;
  }
  const n = sim.needles[idx]!;
  const dir = sim.aimDir();
  n.state = 'Flying';
  n.pos = copy(p.pos);
  n.prevPos = copy(p.pos);
  n.dir = copy(dir);
  n.speed = sim.mods.needleSpeed;
  n.traveled = 0;
  n.host = null;
  n.bounces = sim.mods.bounces;
  n.recallLocked = false;
  n.timer = 0;
  n.stateTick = sim.tick;
  p.fireCd = CFG.player.fireCooldown;
  p.throwAnim = 0.2;
  const next = [1, 2].map((k) => (idx + k) % 3).find((i) => sim.needles[i]!.state === 'Held');
  p.selected = next ?? idx;
  sim.emit({ type: 'needleFired', needle: n.id, pos: copy(p.pos), dir: copy(dir) });
  return true;
}

export function recallNeedle(sim: Sim, n: Needle): boolean {
  if (n.state === 'Held' || n.state === 'Returning') return false;
  if (n.recallLocked || (sim.boss?.canRecall && !sim.boss.canRecall(sim, n))) {
    sim.emit({ type: 'recallDenied', needle: n.id, pos: copy(n.pos) });
    return false;
  }
  n.state = 'Returning';
  n.host = null;
  n.stateTick = sim.tick;
  sim.emit({ type: 'needleRecalled', needle: n.id, pos: copy(n.pos) });
  return true;
}

function anchorActive(shape: Shape): boolean {
  return shape.enabled && isAnchorTag(shape.tag);
}

function embed(sim: Sim, n: Needle, hit: RayHit): void {
  const localPos = add(hit.localPoint, scale(hit.localNormal, CFG.needle.embedOffset));
  n.host = { bodyId: hit.body.id, shapeId: hit.shape.id, local: localPos, localNormal: copy(hit.localNormal) };
  n.pos = toWorld(hit.body, localPos);
  n.normal = dirToWorld(hit.body, hit.localNormal);
  n.state = hit.body.kind === 'boss' ? 'EmbeddedBoss' : 'EmbeddedWorld';
  n.timer = hit.shape.tag === 'HazardAnchor' ? CFG.needle.hazardTime : 0;
  n.stateTick = sim.tick;
  sim.emit({ type: 'needleEmbedded', needle: n.id, pos: copy(n.pos), dir: copy(n.normal), id: hit.shape.id, value: hit.body.kind === 'boss' ? 1 : 0 });
}

function flyStep(sim: Sim, n: Needle): void {
  let remaining = n.speed * DT;
  let from = copy(n.pos);
  const passed = new Set<string>();
  for (let iter = 0; iter < 4 && remaining > 1e-6; iter++) {
    const to = add(from, scale(n.dir, remaining));
    const hit = raycast(sim.bodies, from, to, (_b, s) => s.blocksNeedle, 0, passed);
    if (!hit) {
      n.pos = to;
      n.traveled += remaining;
      remaining = 0;
      break;
    }
    const travel = remaining * hit.t;
    n.traveled += travel;
    remaining -= travel;
    const response = sim.boss?.onNeedleHit?.(sim, n, hit) ?? (anchorActive(hit.shape) ? 'embed' : 'bounce');
    if (response === 'embed') {
      embed(sim, n, hit);
      return;
    }
    if (response === 'pass') {
      passed.add(hit.shape.id);
      from = hit.point;
      continue;
    }
    if (response === 'bounce' && n.bounces > 0) {
      n.bounces--;
      const d = dot(n.dir, hit.normal);
      n.dir = norm(sub(n.dir, scale(hit.normal, 2 * d)));
      from = add(hit.point, scale(hit.normal, 0.5));
      sim.emit({ type: 'needleBounced', needle: n.id, pos: copy(hit.point), dir: copy(hit.normal) });
      continue;
    }
    // bounce without elasticity (or explicit disable): the needle drops next to the surface
    n.pos = add(hit.point, scale(hit.normal, 3));
    sim.emit({ type: 'needleBounced', needle: n.id, pos: copy(hit.point), dir: copy(hit.normal) });
    sim.disableNeedle(n);
    return;
  }
  if (remaining > 1e-6) n.pos = from;
  if (n.traveled >= CFG.needle.maxFlight) {
    n.state = 'Returning';
    n.stateTick = sim.tick;
    sim.emit({ type: 'sfx', text: 'needleFade', pos: copy(n.pos) });
  }
}

export function updateNeedles(sim: Sim): void {
  const p = sim.player;
  for (const n of sim.needles) {
    switch (n.state) {
      case 'Held':
        n.pos = copy(p.pos);
        break;
      case 'Flying':
        flyStep(sim, n);
        break;
      case 'EmbeddedWorld':
      case 'EmbeddedBoss': {
        const h = n.host;
        const body = h ? sim.body(h.bodyId) : undefined;
        const shape = body?.shapes.find((s) => s.id === h?.shapeId);
        if (!h || !body || !body.enabled || !shape || !anchorActive(shape)) {
          sim.disableNeedle(n);
          break;
        }
        n.pos = toWorld(body, h.local);
        n.normal = rotate(h.localNormal, body.angle);
        if (shape.tag === 'HazardAnchor') {
          n.timer -= DT;
          if (n.timer <= 0) sim.disableNeedle(n);
        }
        break;
      }
      case 'Disabled':
        n.timer -= DT;
        if (n.timer <= 0) {
          n.state = 'Returning';
          n.stateTick = sim.tick;
        }
        break;
      case 'Returning': {
        const d = sub(p.pos, n.pos);
        const l = len(d);
        const step = sim.mods.recallSpeed * DT;
        if (l <= Math.max(CFG.needle.catchRadius, step)) {
          n.state = 'Held';
          n.pos = copy(p.pos);
          n.host = null;
          n.recallLocked = false;
          n.stateTick = sim.tick;
          sim.emit({ type: 'needleCaught', needle: n.id, pos: copy(p.pos) });
        } else {
          n.dir = norm(d);
          n.pos = add(n.pos, scale(n.dir, step));
        }
        break;
      }
    }
  }
}

/** Distance helper for presentation / bots. */
export const needleDistance = (a: Needle, b: Needle): number => dist(a.pos, b.pos);
