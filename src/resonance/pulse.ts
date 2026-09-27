// E releases stored energy. World mechanisms still route toward the aimed endpoint; boss fights send every charged
// line at once and advance one seal, so players never need to learn signal types or target a particular boss part.
import { DT } from '../core/clock/fixedStep.ts';
import { dist, dist2, lerp, norm, sub, copy } from '../core/math/vec.ts';
import { segCircle, segSegDist2 } from '../core/geometry/geom.ts';
import { worldCircle, worldSeg } from '../core/sim/bodies.ts';
import type { Link, Needle, Pulse, DeliveryInfo } from '../core/sim/types.ts';
import type { Sim } from '../core/sim/sim.ts';
import { isEmbedded } from './needle.ts';

export const isCharged = (l: Link): boolean => l.valid && (l.state === 'Charged' || l.state === 'Overloaded');

/** XOR of the global reverse-tide flag and per-link anti-phase */
export const flowInvertedFor = (sim: Sim, l: Link): boolean => !sim.boss && sim.flowInverted !== sim.invertedLinks.has(l.id);

export interface PulsePlan {
  target: Needle;
  links: Link[];
  automatic?: boolean;
}

/** Boss fights auto-select every charged line; mechanisms route toward the embedded needle nearest the aim point. */
export function planPulse(sim: Sim): PulsePlan | null {
  const charged = sim.links.filter(isCharged);
  if (charged.length === 0) return null;
  if (sim.boss) {
    const target = sim.needles.find((n) => isEmbedded(n) && charged.some((l) => l.a === n.id || l.b === n.id));
    return target ? { target, links: charged, automatic: true } : null;
  }
  const aim = sim.player.aim;
  let target: Needle | null = null;
  let best = Infinity;
  for (const n of sim.needles) {
    if (!isEmbedded(n)) continue;
    if (!charged.some((l) => l.a === n.id || l.b === n.id)) continue;
    const d = dist2(n.pos, aim);
    if (d < best - 1e-9) {
      best = d;
      target = n;
    }
  }
  if (!target) return null;
  const t = target;
  return { target: t, links: charged.filter((l) => l.a === t.id || l.b === t.id) };
}

export function releasePulse(sim: Sim): void {
  const plan = planPulse(sim);
  const p = sim.player;
  if (!plan) {
    sim.emit({ type: 'pulseEmpty', pos: copy(p.pos) });
    return;
  }
  const group = sim.nextId();
  for (const l of plan.links) {
    const other = l.a === plan.target.id ? l.b : l.a;
    const inverted = plan.automatic ? false : flowInvertedFor(sim, l);
    const fromId = plan.automatic ? l.a : inverted ? plan.target.id : other;
    const toId = plan.automatic ? l.b : inverted ? other : plan.target.id;
    const from = sim.needle(fromId);
    const toN = sim.needle(toId);
    const q: Pulse = {
      id: sim.nextId(),
      group,
      linkId: l.id,
      from: fromId,
      to: toId,
      sig: l.sig!,
      tone: l.tone,
      power: l.power,
      d: 0,
      prevD: 0,
      length: dist(from.pos, toN.pos),
      speed: sim.mods.pulseSpeed,
      width: sim.mods.pulseWidth,
      done: false,
      pathHits: [],
      dir: norm(sub(toN.pos, from.pos)),
      linger: sim.mods.echo,
      delivered: false,
    };
    sim.pulses.push(q);
    sim.record(`pulse ${fromId}->${toId} ${q.sig}${q.tone >= 0 ? q.tone : ''} p${q.power}${inverted ? ' inv' : ''}`);
    sim.emit({ type: 'pulseFired', link: l.id, needle: toId, sig: q.sig, value: q.power, pos: copy(from.pos), dir: copy(q.dir) });
    // discharge
    l.state = 'Idle';
    l.sig = null;
    l.tone = -1;
    l.power = 0;
    l.progress = 0;
    l.overloadT = 0;
    l.echoT = sim.mods.echo;
    l.stateTick = sim.tick;
  }
  p.pulseCd = sim.mods.pulseCooldown;
}

function pathHits(sim: Sim, q: Pulse, a: { x: number; y: number }, b: { x: number; y: number }, t: number): void {
  for (const body of sim.bodies) {
    if (!body.enabled || body.kind === 'world') continue;
    for (const s of body.shapes) {
      if (!s.enabled || q.pathHits.includes(s.id)) continue;
      let hit = false;
      if (s.kind === 'circle') {
        const w = worldCircle(body, s);
        hit = segCircle(a, b, w.c, w.r + q.width);
      } else {
        const w = worldSeg(body, s);
        hit = segSegDist2(a, b, w.a, w.b) <= q.width * q.width;
      }
      if (!hit) continue;
      q.pathHits.push(s.id);
      sim.boss?.onPulsePath?.(sim, q, body, s, t);
      sim.emit({ type: 'pulsePathHit', id: s.id, pos: lerp(a, b, 0.5), sig: q.sig });
    }
  }
}

function deliver(sim: Sim, q: Pulse, to: Needle, t: number): void {
  const host = to.host;
  if (!host) {
    sim.emit({ type: 'pulseFizzled', link: q.linkId, pos: copy(to.pos) });
    return;
  }
  const found = sim.shape(host.shapeId);
  const info: DeliveryInfo = {
    pulse: q, needle: to, bodyId: host.bodyId, shapeId: host.shapeId, receiver: found?.shape.receiver, t, pos: copy(to.pos),
  };
  const result = sim.boss ? sim.resolveSimpleBossPulse(info) : sim.logic?.onPulseDelivered?.(sim, info);
  const r = result ?? 'none';
  sim.record(`deliver ${q.from}->${q.to} ${host.shapeId} ${r}`);
  sim.emit({ type: 'pulseDelivered', link: q.linkId, needle: to.id, sig: q.sig, pos: copy(to.pos), result: r, id: host.shapeId, value: q.power });
  if (r === 'success') sim.pulseSucceeded();
}

export function updatePulses(sim: Sim): void {
  const p = sim.player;
  if (sim.pendingPulse) {
    p.pulseStartup -= DT;
    if (p.pulseStartup <= 1e-9) {
      sim.pendingPulse = false;
      p.pulseStartup = 0;
      if (!p.dead) releasePulse(sim);
    }
  }
  for (const q of sim.pulses) {
    if (q.done) continue;
    const l = sim.link(q.linkId);
    const from = sim.needle(q.from);
    const to = sim.needle(q.to);
    if (!l.valid || !isEmbedded(from) || !isEmbedded(to)) {
      q.done = true;
      if (!q.delivered) sim.emit({ type: 'pulseFizzled', link: q.linkId, pos: copy(to.pos) });
      continue;
    }
    if (q.delivered) {
      // Echo: the discharged line keeps sweeping for a moment (hits things crossing it, cannot capture)
      q.linger -= DT;
      pathHits(sim, q, from.pos, to.pos, 1);
      if (q.linger <= 0) q.done = true;
      continue;
    }
    q.length = Math.max(1, dist(from.pos, to.pos));
    q.prevD = q.d;
    q.d += q.speed * DT;
    const u0 = Math.min(1, q.prevD / q.length);
    const u1 = Math.min(1, q.d / q.length);
    const segA = lerp(from.pos, to.pos, u0);
    const segB = lerp(from.pos, to.pos, u1);
    const tArrive = q.d >= q.length ? (q.length - q.prevD) / Math.max(1e-9, q.d - q.prevD) : 1;
    pathHits(sim, q, segA, segB, Math.min(1, Math.max(0, tArrive)));
    if (q.d >= q.length) {
      q.delivered = true;
      if (q.linger <= 0) q.done = true;
      deliver(sim, q, to, Math.min(1, Math.max(0, tArrive)));
    }
  }
}
