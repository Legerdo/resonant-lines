// Resonance links (LOCKED-R02) and the triangular lattice. Links are derived from needle geometry every tick.
import { DT } from '../core/clock/fixedStep.ts';
import { dist, lerp, copy } from '../core/math/vec.ts';
import { segSeg, triArea } from '../core/geometry/geom.ts';
import { CFG } from '../core/sim/config.ts';
import { losBlocked } from '../core/sim/bodies.ts';
import type { Link, Signature } from '../core/sim/types.ts';
import type { Sim } from '../core/sim/sim.ts';
import { isEmbedded } from './needle.ts';

export function resetCharge(l: Link): void {
  l.state = 'Idle';
  l.sig = null;
  l.tone = -1;
  l.power = 0;
  l.progress = 0;
  l.chargingSig = null;
  l.chargingTone = -1;
  l.overloadT = 0;
}

export function linkMid(sim: Sim, l: Link) {
  return lerp(sim.needle(l.a).pos, sim.needle(l.b).pos, 0.5);
}

export function breakLink(sim: Sim, l: Link, reason: string): void {
  const mid = linkMid(sim, l);
  resetCharge(l);
  l.state = 'Broken';
  l.brokenT = CFG.link.brokenDuration;
  l.valid = false;
  l.blocked = 'broken';
  l.stateTick = sim.tick;
  sim.record(`linkBroken ${l.id} ${reason}`);
  sim.emit({ type: 'linkBroken', link: l.id, pos: mid, text: reason });
}

/** Overload failure. The Stable Net tuning absorbs the first one per attempt. */
export function overloadBreak(sim: Sim, l: Link): void {
  if (sim.mods.stableNet && !sim.stableNetUsed) {
    sim.stableNetUsed = true;
    l.overloadT = sim.mods.overloadDuration;
    sim.emit({ type: 'sfx', text: 'stabilized', link: l.id, pos: linkMid(sim, l) });
    return;
  }
  breakLink(sim, l, 'overload');
}

export function applyCapture(sim: Sim, l: Link, sig: Signature, tone: number, attackId: number): void {
  const pos = linkMid(sim, l);
  if (l.state === 'Idle' || l.state === 'Charging') {
    l.state = 'Charged';
    l.sig = sig;
    l.tone = tone;
    l.power = 1;
    l.progress = 0;
    l.stateTick = sim.tick;
    sim.emit({ type: 'capture', link: l.id, sig, value: tone, pos });
  } else if (l.state === 'Charged') {
    if (l.sig === sig && l.tone === tone) {
      l.state = 'Overloaded';
      l.power = 2;
      l.overloadT = sim.mods.overloadDuration;
      l.stateTick = sim.tick;
      sim.emit({ type: 'overload', link: l.id, sig, value: tone, pos });
    } else {
      l.sig = sig;
      l.tone = tone;
      l.power = 1;
      l.stateTick = sim.tick;
      sim.emit({ type: 'capture', link: l.id, sig, value: tone, pos });
    }
  } else if (l.state === 'Overloaded') {
    overloadBreak(sim, l);
  }
  sim.record(`capture ${l.id} ${sig}${tone >= 0 ? tone : ''} a${attackId} -> ${l.state}`);
}

export function updateLinks(sim: Sim): void {
  for (const l of sim.links) {
    l.threadCd = Math.max(0, l.threadCd - DT);
    l.echoT = Math.max(0, l.echoT - DT);
    if (l.state === 'Broken') {
      l.brokenT -= DT;
      if (l.brokenT <= 0) {
        resetCharge(l);
        l.stateTick = sim.tick;
      }
    }
    const a = sim.needle(l.a);
    const b = sim.needle(l.b);
    let blocked: Link['blocked'] = 'none';
    if (!isEmbedded(a) || !isEmbedded(b)) blocked = 'state';
    else if (l.state === 'Broken') blocked = 'broken';
    else {
      l.length = dist(a.pos, b.pos);
      if (l.length > sim.mods.maxLinkDistance || l.length < CFG.link.minDistance) blocked = 'distance';
      else if (losBlocked(sim.bodies, a.pos, b.pos, new Set([a.host!.shapeId, b.host!.shapeId]))) blocked = 'los';
    }
    if (isEmbedded(a) && isEmbedded(b)) l.length = dist(a.pos, b.pos);
    l.blocked = blocked;
    const valid = blocked === 'none';
    if (valid && !l.valid) {
      l.valid = true;
      l.formedTick = sim.tick;
      l.stateTick = sim.tick;
      sim.emit({ type: 'linkFormed', link: l.id, pos: lerp(a.pos, b.pos, 0.5) });
    } else if (!valid && l.valid) {
      l.valid = false;
      if (l.state !== 'Broken') {
        if (l.sig || l.progress > 0) sim.emit({ type: 'chargeLost', link: l.id, pos: lerp(a.pos, b.pos, 0.5) });
        resetCharge(l);
      }
      sim.emit({ type: 'linkLost', link: l.id, pos: lerp(a.pos, b.pos, 0.5) });
    }
    if (l.valid && l.state === 'Overloaded') {
      l.overloadT -= DT;
      if (l.overloadT <= 0) overloadBreak(sim, l);
    }
  }
  updateLattice(sim);
}

export function updateLattice(sim: Sim): void {
  const all = sim.links.every((l) => l.valid);
  const [A, B, C] = [sim.needle('A').pos, sim.needle('B').pos, sim.needle('C').pos];
  const area = all ? triArea(A, B, C) : 0;
  const formed = all && area >= CFG.link.latticeMinArea;
  const lat = sim.lattice;
  lat.area = area;
  lat.centroid = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
  if (formed && !lat.formed) {
    lat.formed = true;
    lat.formedTick = sim.tick;
    sim.record('lattice+');
    sim.emit({ type: 'latticeFormed', pos: copy(lat.centroid) });
  } else if (!formed && lat.formed) {
    lat.formed = false;
    sim.record('lattice-');
    sim.emit({ type: 'latticeLost', pos: copy(lat.centroid) });
  }
}

/** Thread Step: dashing across one of your own live links extends the dash and stabilises that link. */
export function threadStep(sim: Sim): void {
  const p = sim.player;
  if (!p.dash.active || p.dead) return;
  for (const l of sim.links) {
    if (!l.valid || l.threadCd > 0) continue;
    const a = sim.needle(l.a).pos;
    const b = sim.needle(l.b).pos;
    const h = segSeg(p.prevPos, p.pos, a, b);
    if (!h) continue;
    p.dash.dur += sim.mods.threadExtend;
    l.threadCd = sim.mods.threadCooldown;
    if (l.state === 'Overloaded') l.overloadT = sim.mods.overloadDuration;
    if (l.progress > 0) l.progress = Math.min(0.99, l.progress + 0.3);
    sim.record(`threadStep ${l.id}`);
    sim.emit({ type: 'threadStep', link: l.id, pos: lerp(p.prevPos, p.pos, h.t) });
  }
}
