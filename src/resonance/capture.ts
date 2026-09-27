// Signature capture (LOCKED-R03): only attacks whose real geometry crosses a live link charge it (provenance per attack).
import { DT } from '../core/clock/fixedStep.ts';
import { lerp } from '../core/math/vec.ts';
import { CFG } from '../core/sim/config.ts';
import type { Attack, Link } from '../core/sim/types.ts';
import type { Sim } from '../core/sim/sim.ts';
import { lerpShape, shapeHitsSegment } from '../bosses/framework/attacks.ts';
import { applyCapture, breakLink } from './link.ts';

/** Earliest sub-tick time where the attack overlaps the (moving) link segment, or null. */
export function attackLinkT(sim: Sim, atk: Attack, l: Link, tol: number): number | null {
  if (!atk.shape) return null;
  const a = sim.needle(l.a);
  const b = sim.needle(l.b);
  const n = CFG.substeps;
  for (let s = 1; s <= n; s++) {
    const t = s / n;
    const pa = lerp(a.prevPos, a.pos, t);
    const pb = lerp(b.prevPos, b.pos, t);
    const sh = lerpShape(atk.prevShape, atk.shape, t);
    if (shapeHitsSegment(sh, pa, pb, tol)) return t;
  }
  return null;
}

export function updateCapture(sim: Sim): void {
  const tol = sim.mods.captureTolerance;
  for (const l of sim.links) {
    if (!l.valid || l.state === 'Broken') continue;
    let continuousHit = false;
    for (const atk of sim.attacks) {
      if (atk.phase !== 'active' || !atk.shape) continue;
      const custom = sim.boss?.onAttackLink?.(sim, atk, l);
      if (custom === 'ignore') continue;
      const wantsCapture = custom === 'capture' || (custom === undefined && atk.capturable && atk.sig !== null);
      if (!wantsCapture && custom !== 'cut') continue;
      if (l.captured.includes(atk.id)) continue;
      if (l.echoT > 0 && custom !== 'cut') continue; // Echo tuning: the lingering line cannot take new energy
      const t = attackLinkT(sim, atk, l, tol);
      if (t === null) continue;
      if (custom === 'cut') {
        l.captured.push(atk.id);
        breakLink(sim, l, atk.kind);
        break;
      }
      if (atk.sig === null) continue;
      if (atk.continuous) {
        continuousHit = true;
        if (l.state === 'Idle') {
          l.state = 'Charging';
          l.stateTick = sim.tick;
        }
        l.chargingSig = atk.sig;
        l.chargingTone = atk.tone;
        l.progress += DT / sim.mods.chargeTime;
        if (l.progress >= 1) {
          l.progress = 0;
          if (l.state === 'Charging') l.state = 'Idle';
          l.captured.push(atk.id);
          applyCapture(sim, l, atk.sig, atk.tone, atk.id);
        }
      } else {
        l.captured.push(atk.id);
        applyCapture(sim, l, atk.sig, atk.tone, atk.id);
      }
      if (l.captured.length > 64) l.captured.splice(0, l.captured.length - 64);
    }
    if (!continuousHit && l.progress > 0) {
      l.progress = Math.max(0, l.progress - DT / (sim.mods.chargeTime * 2));
      if (l.progress === 0 && l.state === 'Charging') {
        l.state = 'Idle';
        l.chargingSig = null;
      }
    }
  }
}
