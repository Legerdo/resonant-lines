// B07 쌍궤도 아르/오르 — "두 개체를 하나의 회로로 볼 수 있는가?"
// Ar (sun) and Or (moon) orbit the central pedestal in opposite directions. Needles stick to either body.
// Whenever the Ar–Or line sweeps across the pedestal (opposition), every live line on the bodies gains Rotational.
// The shared seal breaks only when that energy flows into the pedestal needle at a given configuration:
//  A opposition (180°), B conjunction (0°), C quadrature (90°).  Core: the orbits tighten; with the three-point
//  lattice closed and the Ar–Or line charged, deliver it into either body to make them converge.
import { DT } from '../../core/clock/fixedStep.ts';
import { type Vec, copy, sub, norm } from '../../core/math/vec.ts';
import { makeBody, circle } from '../../core/sim/bodies.ts';
import { pointSegDist2 } from '../../core/geometry/geom.ts';
import type { Attack, Body, DeliveryInfo, PulseResult } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { type BossController, makeSeals, newView } from '../framework/boss.ts';
import { applyCapture } from '../../resonance/link.ts';

export const ORBIT = {
  center: { x: 208, y: 150 },
  rAr: 100,
  rOr: 62,
  pAr: 9,
  pOr: 7,
  tol: (26 * Math.PI) / 180,
  flareEvery: 3.1,
  bladeLen: 34,
  merge: 22,
};

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export class OrbitBoss implements BossController {
  readonly id = 'B07';
  phase = 'orbit';
  seals = makeSeals([{ id: 'opp', glyph: 0 }, { id: 'conj', glyph: 1 }, { id: 'quad', glyph: 2 }], 'B07');
  coreExposed = false;
  defeated = false;
  view = newView();
  ar!: Body;
  or!: Body;
  aAr = 0;
  aOr = Math.PI * 0.5;
  rAr = ORBIT.rAr;
  rOr = ORBIT.rOr;
  flareT = 1.5;
  wasOpp = false;
  events = 0;
  contactAr: Attack | null = null;
  contactOr: Attack | null = null;
  blade: Attack | null = null;
  mergeT = 0;
  bladeA = 0;

  setup(sim: Sim): void {
    this.ar = sim.addBody(makeBody('ar', 'boss', this.posAt(this.aAr, this.rAr), [circle('ar:orb', { x: 0, y: 0 }, 11, 'BossAnchorable', { blocksMove: false, receiver: 'ar' })]));
    this.or = sim.addBody(makeBody('or', 'boss', this.posAt(this.aOr, this.rOr), [circle('or:orb', { x: 0, y: 0 }, 9, 'BossAnchorable', { blocksMove: false, receiver: 'or' })]));
    this.syncView(sim);
  }

  private posAt(a: number, r: number): Vec {
    return { x: ORBIT.center.x + Math.cos(a) * r, y: ORBIT.center.y + Math.sin(a) * r * 0.82 };
  }

  /** angular separation seen from the pedestal, in [0, PI] */
  separation(): number {
    return Math.abs(wrap(this.aAr - this.aOr));
  }

  configuration(): 'opp' | 'conj' | 'quad' | 'none' {
    const s = this.separation();
    if (Math.abs(s - Math.PI) <= ORBIT.tol) return 'opp';
    if (s <= ORBIT.tol) return 'conj';
    if (Math.abs(s - Math.PI / 2) <= ORBIT.tol) return 'quad';
    return 'none';
  }

  update(sim: Sim): void {
    if (this.coreExposed) {
      this.mergeT += DT;
      const k = Math.min(1, this.mergeT / ORBIT.merge);
      this.rAr = ORBIT.rAr - (ORBIT.rAr - 52) * k;
      this.rOr = ORBIT.rOr - (ORBIT.rOr - 40) * k;
      if (k >= 1) this.mergeT = 0; // they spring apart and try again
    }
    const speed = this.coreExposed ? 1.25 : 1;
    this.aAr = wrap(this.aAr + ((Math.PI * 2) / ORBIT.pAr) * DT * speed);
    this.aOr = wrap(this.aOr - ((Math.PI * 2) / ORBIT.pOr) * DT * speed);
    this.ar.pos = this.posAt(this.aAr, this.rAr);
    this.or.pos = this.posAt(this.aOr, this.rOr);
    // contact hazards follow the bodies (drawn by the view; exact circles)
    this.contactAr = this.follow(sim, this.contactAr, this.ar.pos, 11);
    this.contactOr = this.follow(sim, this.contactOr, this.or.pos, 9);
    // orbital charge: the Ar–Or line sweeping across the pedestal
    const opp = pointSegDist2(ORBIT.center, this.ar.pos, this.or.pos) < 6 * 6;
    if (opp && !this.wasOpp) {
      this.events++;
      sim.record(`B07 opposition ${this.events}`);
      sim.emit({ type: 'sfx', text: 'orbit', pos: copy(ORBIT.center) });
      for (const l of sim.links) {
        if (!l.valid) continue;
        const onBody = [l.a, l.b].some((id) => {
          const b = sim.needle(id).host?.bodyId;
          return b === 'ar' || b === 'or';
        });
        if (onBody) applyCapture(sim, l, 'Rotational', -1, -100 - this.events);
      }
    }
    this.wasOpp = opp;
    // sun flares
    this.flareT -= DT;
    if (this.flareT <= 0) {
      this.flareT = ORBIT.flareEvery;
      const d = norm(sub(sim.player.pos, this.ar.pos));
      for (let k = -1; k <= 1; k++) {
        const a = Math.atan2(d.y, d.x) + k * 0.26;
        sim.spawnAttack({ kind: 'projectile', owner: 'ar', harmful: true, p: { x: this.ar.pos.x, y: this.ar.pos.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, r: 3, range: 300 } });
      }
    }
    // moon blade (after the first seal): a Rotational edge circling Or — also catchable
    if (this.seals[0]!.broken) {
      this.bladeA += DT * 3.2;
      const o = this.or.pos;
      const a = { x: o.x + Math.cos(this.bladeA) * 12, y: o.y + Math.sin(this.bladeA) * 12 };
      const b = { x: o.x + Math.cos(this.bladeA) * (12 + ORBIT.bladeLen), y: o.y + Math.sin(this.bladeA) * (12 + ORBIT.bladeLen) };
      if (!this.blade || this.blade.phase === 'done') {
        this.blade = sim.spawnAttack({ kind: 'blade', owner: 'or', sig: 'Rotational', capturable: true, harmful: true, phase: 'active', shape: { kind: 'capsule', a, b, r: 3 } });
      } else this.blade.shape = { kind: 'capsule', a, b, r: 3 };
    }
    this.syncView(sim);
  }

  private follow(sim: Sim, a: Attack | null, p: Vec, r: number): Attack {
    if (!a || a.phase === 'done') {
      a = sim.spawnAttack({ kind: 'contact', owner: 'orb', harmful: true, phase: 'active', shape: { kind: 'circle', c: copy(p), r }, p: { noGeneric: 1 } });
    }
    a.shape = { kind: 'circle', c: copy(p), r };
    a.hitPlayer = false; // continuous hazard (the player's i-frames still apply)
    return a;
  }

  onAttackLink(sim: Sim, a: Attack, l: import('../../core/sim/types.ts').Link) {
    if (a.kind === 'blade') {
      const onOr = (id: 'A' | 'B' | 'C') => sim.needle(id).host?.bodyId === 'or';
      if (onOr(l.a) || onOr(l.b)) return 'ignore' as const;
    }
    return undefined;
  }

  onPulseDelivered(sim: Sim, d: DeliveryInfo): PulseResult | undefined {
    if (this.coreExposed) {
      if ((d.receiver === 'ar' || d.receiver === 'or') && d.pulse.sig === 'Rotational' && sim.lattice.formed) {
        const src = sim.needle(d.pulse.from).host?.bodyId;
        if (src === 'ar' || src === 'or') {
          sim.requestVictory(d.t, d.pos);
          return 'success';
        }
        return 'none';
      }
      return d.receiver === 'ar' || d.receiver === 'or' ? 'fail' : undefined;
    }
    if (d.receiver !== 'pedestal') return undefined;
    if (d.pulse.sig !== 'Rotational') return 'fail';
    const next = this.seals.find((s) => !s.broken);
    if (!next) return 'none';
    const conf = this.configuration();
    if (conf !== next.id) {
      sim.emit({ type: 'sealRejected', id: next.id, pos: d.pos, text: conf });
      return 'fail';
    }
    if (sim.breakSeal(next.id, `pulse${d.pulse.group}`, d.pos)) {
      sim.setBossPhase(this.coreExposed ? 'converge' : `orbit${this.seals.filter((s) => s.broken).length}`);
      return 'success';
    }
    return 'none';
  }

  updateDefeated(sim: Sim): void {
    this.view.pose = 'defeat';
    this.view.poseT += DT;
    const k = Math.min(1, this.view.poseT / 1.5);
    this.ar.pos = { x: this.ar.pos.x + (ORBIT.center.x - this.ar.pos.x) * k * 0.1, y: this.ar.pos.y + (ORBIT.center.y - this.ar.pos.y) * k * 0.1 };
    this.or.pos = { x: this.or.pos.x + (ORBIT.center.x - this.or.pos.x) * k * 0.1, y: this.or.pos.y + (ORBIT.center.y - this.or.pos.y) * k * 0.1 };
    this.syncView(sim);
  }

  private syncView(sim: Sim): void {
    const v = this.view;
    if (v.pose !== 'defeat') v.pose = this.coreExposed ? 'merge' : 'orbit';
    v.poseT += DT;
    v.parts.ar = { x: this.ar.pos.x, y: this.ar.pos.y, a: this.aAr };
    v.parts.or = { x: this.or.pos.x, y: this.or.pos.y, a: this.aOr };
    v.parts.conf = { x: 0, y: 0, f: ['opp', 'conj', 'quad', 'none'].indexOf(this.configuration()) };
    v.parts.blade = this.blade && this.blade.phase !== 'done' && this.blade.shape?.kind === 'capsule' ? { x: this.blade.shape.b.x, y: this.blade.shape.b.y, on: true } : { x: 0, y: 0, on: false };
    v.flash = this.seals.some((s) => s.brokenTick === sim.tick) ? 0.3 : Math.max(0, v.flash - DT);
  }

  debugInfo() {
    return { sep: +((this.separation() * 180) / Math.PI).toFixed(0), conf: this.configuration(), events: this.events };
  }
}
