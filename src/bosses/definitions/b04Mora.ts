// B04 뿌리기계 모라 — "보스 공격으로 arena 회로를 고칠 수 있는가?"
// Four broken conduits ring the court; glowing veins on Mora point at the one it needs. Each seal is a different act:
//  A: bridge conduit 0 with two needles, catch a root slam on the bridge, pulse into its machine-side terminal.
//  B: the root tips are now Moving Anchors; a slam charges lines anchored on the slamming tip: tip -> conduit 3.
//  C: two charged lines must flow into conduit 1's machine-side terminal at once (fork-in).
//  Core: the heart opens; powered conduits feed Impact into lines on their terminals; deliver it into the heart.
import { DT } from '../../core/clock/fixedStep.ts';
import { type Vec, copy, sub, len, norm, add, scale, lerp } from '../../core/math/vec.ts';
import { makeBody, circle } from '../../core/sim/bodies.ts';
import type { Attack, Body, DeliveryInfo, Link, PulseResult } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { type BossController, makeSeals, newView } from '../framework/boss.ts';
import { applyCapture } from '../../resonance/link.ts';

export const MORA = {
  pos: { x: 208, y: 70 },
  armBase: [{ x: 172, y: 92 }, { x: 244, y: 92 }] as Vec[],
  armRest: [{ x: 132, y: 136 }, { x: 284, y: 136 }] as Vec[],
  reach: 170,
  raise: 0.95,
  slamActive: 0.2,
  rest: 1.6,
  retract: 0.6,
  gap: 0.7,
  feed: 2.4,
};
/** conduit k: [machine-side terminal a, far terminal b] */
export const CONDUITS: readonly [Vec, Vec][] = [
  [{ x: 64, y: 112 }, { x: 64, y: 184 }],
  [{ x: 176, y: 236 }, { x: 112, y: 236 }],
  [{ x: 240, y: 236 }, { x: 304, y: 236 }],
  [{ x: 352, y: 112 }, { x: 352, y: 184 }],
];
export const SEAL_CONDUIT = [0, 3, 1];

type ArmState = 'rest' | 'raise' | 'slam' | 'down' | 'retract';
interface Arm {
  body: Body;
  state: ArmState;
  t: number;
  target: Vec;
  from: Vec;
  attack: Attack | null;
}

export class MoraBoss implements BossController {
  readonly id = 'B04';
  phase = 'dormant';
  seals = makeSeals([{ id: 'veinA', glyph: 0 }, { id: 'veinB', glyph: 1 }, { id: 'veinC', glyph: 2 }], 'B04');
  coreExposed = false;
  defeated = false;
  view = newView();
  core!: Body;
  arms: Arm[] = [];
  powered = [false, false, false, false];
  t = 0;
  nextArm = 0;
  actions = 0;
  feedT = 0;
  sweep: Attack | null = null;
  private forkWindow: { t: number; group: number; count: number } | null = null;

  setup(sim: Sim): void {
    this.core = sim.addBody(makeBody('mora', 'boss', copy(MORA.pos), [
      circle('mora:shell', { x: 0, y: 0 }, 24, 'NonAnchorable', { blocksMove: true }),
      circle('mora:heart', { x: 0, y: 24 }, 7, 'BossAnchorable', { enabled: false, blocksMove: false, receiver: 'heart' }),
    ]));
    for (let i = 0; i < 2; i++) {
      const body = sim.addBody(makeBody(`mora:arm${i}`, 'boss', copy(MORA.armRest[i]!), [
        circle(`mora:tip${i}`, { x: 0, y: 0 }, 7, 'NonAnchorable', { blocksMove: false, receiver: `tip${i}` }),
      ]));
      this.arms.push({ body, state: 'rest', t: 0, target: copy(MORA.armRest[i]!), from: copy(MORA.armRest[i]!), attack: null });
    }
    this.syncView(sim);
  }

  get currentConduit(): number {
    const k = this.seals.findIndex((s) => !s.broken);
    return k < 0 ? -1 : SEAL_CONDUIT[k]!;
  }

  private startSlam(sim: Sim, i: number): void {
    const arm = this.arms[i]!;
    const base = MORA.armBase[i]!;
    let tgt = copy(sim.player.pos);
    const d = sub(tgt, base);
    if (len(d) > MORA.reach) tgt = add(base, scale(norm(d), MORA.reach));
    tgt = { x: Math.max(28, Math.min(388, tgt.x)), y: Math.max(60, Math.min(244, tgt.y)) };
    arm.from = copy(arm.body.pos);
    arm.target = tgt;
    arm.state = 'raise';
    arm.t = 0;
    arm.attack = sim.spawnAttack({ kind: 'slam', owner: `mora:arm${i}`, sig: 'Impact', capturable: true, harmful: true, p: { x: tgt.x, y: tgt.y, r: 18, tele: MORA.raise, active: MORA.slamActive, arm: i } });
    arm.attack.kind = 'zone';
    sim.emit({ type: 'telegraph', id: 'slam', sig: 'Impact', pos: copy(tgt) });
    sim.record(`B04 slam${i} ${tgt.x.toFixed(0)},${tgt.y.toFixed(0)}`);
  }

  update(sim: Sim): void {
    this.t += DT;
    // arms
    for (const [i, arm] of this.arms.entries()) {
      arm.t += DT;
      const rest = MORA.armRest[i]!;
      switch (arm.state) {
        case 'rest':
          arm.body.pos = { x: rest.x, y: rest.y + Math.sin(this.t * 2 + i) * 1.5 };
          break;
        case 'raise': {
          const k = Math.min(1, arm.t / MORA.raise);
          const p = lerp(arm.from, arm.target, k);
          arm.body.pos = { x: p.x, y: p.y - Math.sin(k * Math.PI) * 26 - k * 8 };
          if (arm.t >= MORA.raise) {
            arm.state = 'slam';
            arm.t = 0;
            arm.body.pos = copy(arm.target);
            sim.emit({ type: 'shake', value: 4 });
          }
          break;
        }
        case 'slam':
          arm.body.pos = copy(arm.target);
          if (arm.t >= MORA.slamActive) {
            arm.state = 'down';
            arm.t = 0;
          }
          break;
        case 'down':
          if (arm.t >= MORA.rest) {
            arm.state = 'retract';
            arm.t = 0;
            arm.from = copy(arm.body.pos);
          }
          break;
        case 'retract': {
          const k = Math.min(1, arm.t / MORA.retract);
          arm.body.pos = lerp(arm.from, rest, k);
          if (k >= 1) arm.state = 'rest';
          break;
        }
      }
      // root tips become moving anchors once the first conduit is restored
      const tip = arm.body.shapes[0]!;
      tip.tag = this.seals[0]!.broken && !this.coreExposed ? 'MovingAnchor' : 'NonAnchorable';
    }
    // action scheduler
    const idle = this.arms.every((a) => a.state === 'rest' || a.state === 'down');
    if (idle && this.t >= MORA.gap) {
      this.actions++;
      if (this.actions % 4 === 0) {
        const d = norm(sub(sim.player.pos, this.core.pos));
        for (let k = -2; k <= 2; k++) {
          const a = Math.atan2(d.y, d.x) + k * 0.22;
          sim.spawnAttack({ kind: 'projectile', owner: 'mora', harmful: true, p: { x: this.core.pos.x, y: this.core.pos.y + 16, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, r: 3, range: 300 } });
        }
      } else {
        const i = this.pickArm(sim);
        if (this.arms[i]!.state === 'rest') this.startSlam(sim, i);
      }
      this.t = 0;
    }
    // core phase: the restored circuit feeds the lines on powered terminals; roots sweep
    if (this.coreExposed) {
      this.feedT += DT;
      if (this.feedT >= MORA.feed) {
        this.feedT = 0;
        for (const l of sim.links) {
          if (!l.valid || (l.state !== 'Idle' && l.state !== 'Charging')) continue;
          const ends = [sim.needle(l.a).host?.shapeId, sim.needle(l.b).host?.shapeId];
          const fed = this.powered.some((p, k) => p && ends.includes(`p:c${k}a`));
          if (fed) applyCapture(sim, l, 'Impact', -1, -2);
        }
        sim.emit({ type: 'sfx', text: 'coreHum', pos: copy(this.core.pos) });
      }
      if (!this.sweep || this.sweep.phase === 'done') {
        if (this.t > 0.3 && sim.rng.next() < 0.004) this.startSweep(sim);
      }
      if (this.sweep && this.sweep.phase !== 'done') this.updateSweep(sim);
    }
    if (this.forkWindow) {
      this.forkWindow.t -= DT;
      if (this.forkWindow.t <= 0) this.forkWindow = null;
    }
    this.syncView(sim);
  }

  private pickArm(sim: Sim): number {
    // the arm on the player's side slams (readable), alternating when centred
    const dx = sim.player.pos.x - this.core.pos.x;
    if (Math.abs(dx) < 24) return this.nextArm++ % 2;
    return dx < 0 ? 0 : 1;
  }

  private startSweep(sim: Sim): void {
    this.sweep = sim.spawnAttack({ kind: 'custom', owner: 'mora', harmful: true, p: { tele: 0.8, ang: Math.atan2(sim.player.pos.y - this.core.pos.y, sim.player.pos.x - this.core.pos.x) - 1.2, noGeneric: 0 } });
    this.sweep.kind = 'sweep';
    sim.record('B04 sweep');
  }

  private updateSweep(sim: Sim): void {
    const a = this.sweep!;
    const c = this.core.pos;
    const ang = a.p.ang! + (a.phase === 'active' ? a.t * 2.4 : 0);
    const inner = add(c, { x: Math.cos(ang) * 30, y: Math.sin(ang) * 30 });
    const outer = add(c, { x: Math.cos(ang) * 104, y: Math.sin(ang) * 104 });
    if (a.phase === 'telegraph') {
      a.tele = { kind: 'capsule', a: inner, b: outer, r: 1 };
      if (a.t >= a.p.tele!) {
        a.phase = 'active';
        a.t = 0;
      }
    } else if (a.phase === 'active') {
      a.shape = { kind: 'capsule', a: inner, b: outer, r: 5 };
      if (a.t >= 1.3) a.phase = 'done';
    }
    void sim;
  }

  onAttackLink(sim: Sim, a: Attack, l: Link) {
    // a slamming root carries its impact into lines anchored on its own tip (the core of seal B)
    if (a.p.arm !== undefined) {
      const tip = `mora:tip${a.p.arm}`;
      if (sim.needle(l.a).host?.shapeId === tip || sim.needle(l.b).host?.shapeId === tip) return 'capture' as const;
    }
    return undefined;
  }

  onPulseDelivered(sim: Sim, d: DeliveryInfo): PulseResult | undefined {
    const r = d.shapeId;
    if (this.coreExposed) {
      if (d.receiver === 'heart' && d.pulse.sig === 'Impact') {
        const src = sim.needle(d.pulse.from).host?.shapeId ?? '';
        const fromPowered = this.powered.some((p, k) => p && src === `p:c${k}a`);
        if (fromPowered) {
          sim.requestVictory(d.t, d.pos);
          return 'success';
        }
        sim.emit({ type: 'sealRejected', id: 'heart', pos: d.pos, text: 'circuit' });
        return 'fail';
      }
      return undefined;
    }
    const m = /^p:c(\d)([ab])$/.exec(r);
    if (!m) return undefined;
    const k = Number(m[1]);
    const end = m[2];
    if (d.pulse.sig !== 'Impact') return 'fail';
    const want = this.currentConduit;
    if (end !== 'a' || k !== want) {
      sim.emit({ type: 'sealRejected', id: `c${k}${end}`, pos: d.pos, text: end !== 'a' ? 'direction' : 'conduit' });
      return 'fail';
    }
    const sealIdx = this.seals.findIndex((s) => !s.broken);
    const src = sim.needle(d.pulse.from).host?.shapeId ?? '';
    if (sealIdx === 0) {
      // A: the bridge itself (from the far terminal of the same conduit)
      if (src !== `p:c${k}b`) return 'fail';
    } else if (sealIdx === 1) {
      // B: must come from a root tip
      if (!src.startsWith('mora:tip')) {
        sim.emit({ type: 'sealRejected', id: `c${k}a`, pos: d.pos, text: 'root' });
        return 'fail';
      }
    } else if (sealIdx === 2) {
      // C: two lines into the terminal within one pulse group
      const g = d.pulse.group;
      if (!this.forkWindow || this.forkWindow.group !== g) this.forkWindow = { t: 0.45, group: g, count: 0 };
      this.forkWindow.count++;
      if (this.forkWindow.count < 2) {
        const others = sim.pulses.some((q) => q.group === g && !q.done && q !== d.pulse);
        if (others) return 'none';
        sim.emit({ type: 'sealRejected', id: `c${k}a`, pos: d.pos, text: 'fork' });
        return 'fail';
      }
    }
    if (sim.breakSeal(this.seals[sealIdx]!.id, `pulse${d.pulse.group}`, d.pos)) {
      this.powered[k] = true;
      sim.record(`B04 powered c${k}`);
      if (this.coreExposed) {
        // the shell parts: the heart now protrudes below the machine
        this.core.shapes[1]!.enabled = true;
        const shell = this.core.shapes[0]!;
        if (shell.kind === 'circle') shell.r = 18;
        sim.setBossPhase('heart');
      } else sim.setBossPhase(`circuit${sealIdx + 1}`);
      return 'success';
    }
    return 'none';
  }

  updateDefeated(sim: Sim): void {
    this.view.pose = 'defeat';
    this.view.poseT += DT;
    for (const [i, arm] of this.arms.entries()) arm.body.pos = lerp(arm.body.pos, { x: MORA.armBase[i]!.x, y: MORA.armBase[i]!.y + 20 }, 0.05);
    void sim;
  }

  private syncView(sim: Sim): void {
    const v = this.view;
    const pose = this.coreExposed ? 'open' : this.arms.some((a) => a.state === 'raise') ? 'strain' : 'idle';
    if (v.pose !== pose) {
      v.pose = pose;
      v.poseT = 0;
    } else v.poseT += DT;
    v.parts.core = { x: this.core.pos.x, y: this.core.pos.y };
    this.arms.forEach((a, i) => {
      v.parts[`arm${i}`] = { x: a.body.pos.x, y: a.body.pos.y, f: ['rest', 'raise', 'slam', 'down', 'retract'].indexOf(a.state), on: a.body.shapes[0]!.tag === 'MovingAnchor' };
    });
    v.parts.vein = { x: 0, y: 0, f: this.currentConduit };
    for (let k = 0; k < 4; k++) {
      v.props[`c${k}a`] = this.powered[k] ? 'lit' : this.currentConduit === k ? 'wanted' : 'dead';
      v.props[`c${k}b`] = this.powered[k] ? 'lit' : 'dead';
    }
    v.flash = this.seals.some((s) => s.brokenTick === sim.tick) ? 0.3 : Math.max(0, v.flash - DT);
  }

  debugInfo() {
    return { arms: this.arms.map((a) => a.state).join('/'), want: this.currentConduit, powered: this.powered.map(Number).join(''), sweep: this.sweep?.phase ?? '-' };
  }
}
