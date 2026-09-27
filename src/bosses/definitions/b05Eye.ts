// B05 역조의 눈 — "endpoint가 움직이면 선의 의미도 바뀐다."
// Rafts drift on loops in a tide that reverses; the eye sends flat pressure fronts (Wave) that a line only catches
// when it lies (nearly) parallel to the front — a raft endpoint rotates the line into and out of alignment.
// While the tide runs backwards, energy flows OUT of the needle you aim at (arrows show it).
//  A upper lid: aligned front on a line lid <- raft. B lower lid: a water jet (Impact) on lid <- raft.
//  C tear duct: two aligned fronts (Overloaded Wave). Core: pupil + two rafts as a lattice; aligned front; into the pupil.
import { DT } from '../../core/clock/fixedStep.ts';
import { type Vec, copy, sub, norm } from '../../core/math/vec.ts';
import { makeBody, circle, resolveCircle } from '../../core/sim/bodies.ts';
import type { Attack, Body, DeliveryInfo, Link, PulseResult } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { type BossController, makeSeals, newView } from '../framework/boss.ts';
import { dcos, dsin, dtan } from '../../core/math/dmath.ts';

export const EYE = {
  pos: { x: 208, y: 52 },
  tide: 8,
  frontEvery: 3.2,
  frontSpeed: 105,
  jetEvery: 2.1,
  alignDeg: 24,
  drift: 16,
  rafts: [
    { c: { x: 110, y: 128 }, rx: 70, ry: 58, period: 13, phase: 1.6 },
    { c: { x: 306, y: 128 }, rx: 70, ry: 58, period: 13, phase: -1.6 },
    { c: { x: 208, y: 204 }, rx: 120, ry: 30, period: 17, phase: 0 },
  ],
};

export const aligned = (sim: Sim, l: Link): boolean => {
  const a = sim.needle(l.a).pos;
  const b = sim.needle(l.b).pos;
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  return dx > 1 && dy / dx <= dtan((EYE.alignDeg * Math.PI) / 180);
};

export class EyeBoss implements BossController {
  readonly id = 'B05';
  phase = 'tide';
  seals = makeSeals([{ id: 'lidUp', glyph: 0 }, { id: 'lidLow', glyph: 1 }, { id: 'duct', glyph: 2 }], 'B05');
  coreExposed = false;
  defeated = false;
  view = newView();
  eye!: Body;
  rafts: Body[] = [];
  raftA: number[] = [];
  tideSign = 1;
  tideT = 0;
  frontT = 1.6;
  jetT = 1.0;
  jetBurst = 0;
  t = 0;
  blink = 0;

  setup(sim: Sim): void {
    this.eye = sim.addBody(makeBody('eye', 'boss', copy(EYE.pos), [
      circle('eye:ball', { x: 0, y: 0 }, 14, 'NonAnchorable', { blocksMove: true }),
      circle('eye:lidUp', { x: 0, y: -13 }, 6, 'BossAnchorable', { blocksMove: false, receiver: 'lidUp' }),
      circle('eye:lidLow', { x: 0, y: 15 }, 6, 'BossAnchorable', { blocksMove: false, receiver: 'lidLow' }),
      circle('eye:duct', { x: -20, y: 3 }, 6, 'BossAnchorable', { blocksMove: false, receiver: 'duct' }),
      circle('eye:pupil', { x: 0, y: 0 }, 9, 'BossAnchorable', { enabled: false, blocksMove: false, receiver: 'pupil' }),
    ]));
    EYE.rafts.forEach((r, i) => {
      this.raftA.push(r.phase);
      this.rafts.push(sim.addBody(makeBody(`raft${i}`, 'mechanism', this.raftPos(i), [
        circle(`raft${i}:pad`, { x: 0, y: 0 }, 7, 'MovingAnchor', { blocksMove: false }),
      ])));
    });
    this.syncView(sim);
  }

  private raftPos(i: number): Vec {
    const r = EYE.rafts[i]!;
    const a = this.raftA[i]!;
    return { x: r.c.x + dcos(a) * r.rx, y: r.c.y + dsin(a) * r.ry };
  }

  update(sim: Sim): void {
    this.t += DT;
    this.blink = Math.max(0, this.blink - DT);
    // reversing tide: rafts change direction, the player is pushed gently, pulse flow inverts while reversed
    this.tideT += DT;
    if (this.tideT >= EYE.tide) {
      this.tideT = 0;
      this.tideSign = -this.tideSign;
      sim.record(`B05 tide ${this.tideSign > 0 ? 'flow' : 'ebb'}`);
      sim.emit({ type: 'sfx', text: 'tide', pos: copy(this.eye.pos) });
    }
    sim.flowInverted = this.tideSign < 0;
    EYE.rafts.forEach((r, i) => {
      this.raftA[i] = this.raftA[i]! + ((Math.PI * 2) / r.period) * DT * this.tideSign;
      this.rafts[i]!.pos = this.raftPos(i);
    });
    if (!sim.player.dead && !sim.player.dash.active) {
      const push = { x: EYE.drift * this.tideSign * DT, y: 0 };
      sim.player.pos = resolveCircle(sim.bodies, { x: sim.player.pos.x + push.x, y: sim.player.pos.y + push.y }, sim.player.radius);
    }
    // pressure fronts: two halves with a moving gap
    this.frontT -= DT;
    if (this.frontT <= 0) {
      this.frontT = EYE.frontEvery;
      const gap = 60 + sim.rng.int(6) * 50;
      const l = this.spawnFront(sim, 24, gap - 26);
      const r = this.spawnFront(sim, gap + 26, 392);
      if (l && r) {
        l.p.sib = r.id;
        r.p.sib = l.id;
      }
      this.blink = 0.4;
    }
    // water jets (Impact) in bursts of three
    this.jetT -= DT;
    if (this.jetT <= 0) {
      this.jetBurst = 3;
      this.jetT = EYE.jetEvery;
    }
    if (this.jetBurst > 0 && Math.round(this.jetT * 60) % 9 === 0) {
      this.jetBurst--;
      const o = { x: this.eye.pos.x, y: this.eye.pos.y + 12 };
      const d = norm(sub(sim.player.pos, o));
      sim.spawnAttack({ kind: 'projectile', owner: 'eye', sig: 'Impact', capturable: true, harmful: true, p: { x: o.x, y: o.y, vx: d.x * 175, vy: d.y * 175, r: 4, range: 320 } });
    }
    for (const a of sim.attacks) if (a.kind === 'front') this.stepFront(a);
    this.syncView(sim);
  }

  private spawnFront(sim: Sim, x0: number, x1: number): Attack | null {
    if (x1 - x0 < 8) return null;
    const y = 72;
    return sim.spawnAttack({
      kind: 'front', owner: 'eye', sig: 'Wave', tone: -1, capturable: true, harmful: true, phase: 'telegraph',
      tele: { kind: 'capsule', a: { x: x0, y }, b: { x: x1, y }, r: 1 },
      p: { x0, x1, y, tele: 0.8 },
    });
  }

  private stepFront(a: Attack): void {
    if (a.phase === 'telegraph') {
      if (a.t >= a.p.tele!) {
        a.phase = 'active';
        a.t = 0;
      }
      return;
    }
    if (a.phase !== 'active') return;
    a.p.y = a.p.y! + EYE.frontSpeed * DT;
    a.shape = { kind: 'capsule', a: { x: a.p.x0!, y: a.p.y }, b: { x: a.p.x1!, y: a.p.y }, r: 4 };
    if (a.p.y > 262) a.phase = 'done';
  }

  onAttackLink(sim: Sim, a: Attack, l: Link) {
    if (a.kind === 'front') {
      // one front (two halves) charges a line once; only lines lying along the front catch it
      if (a.p.sib !== undefined && l.captured.includes(a.p.sib)) return 'ignore' as const;
      return aligned(sim, l) ? ('capture' as const) : ('ignore' as const);
    }
    if (a.kind === 'projectile' && a.owner === 'eye' && a.age < 0.3) {
      // a jet has to travel before it can be caught (no free charge at the eye's own sockets)
      const onEye = (id: 'A' | 'B' | 'C') => sim.needle(id).host?.bodyId === 'eye';
      if (onEye(l.a) || onEye(l.b)) return 'ignore' as const;
    }
    return undefined;
  }

  onPulseDelivered(sim: Sim, d: DeliveryInfo): PulseResult | undefined {
    const r = d.receiver;
    const fromHost = sim.needle(d.pulse.from).host?.bodyId ?? '';
    const fromRaft = fromHost.startsWith('raft');
    if (r === 'pupil') {
      if (!this.coreExposed || d.pulse.sig !== 'Wave' || !sim.lattice.formed) return 'fail';
      const onRafts = sim.needles.filter((n) => n.host?.bodyId.startsWith('raft')).length;
      if (onRafts < 2) return 'fail';
      sim.requestVictory(d.t, d.pos);
      return 'success';
    }
    if (r !== 'lidUp' && r !== 'lidLow' && r !== 'duct') return undefined;
    const seal = this.seals.find((s) => s.id === r)!;
    if (seal.broken) return 'none';
    let ok = false;
    if (r === 'lidUp') ok = d.pulse.sig === 'Wave' && fromRaft;
    if (r === 'lidLow') ok = d.pulse.sig === 'Impact' && fromRaft;
    if (r === 'duct') ok = d.pulse.sig === 'Wave' && d.pulse.power >= 2;
    if (!ok) {
      this.blink = 0.6;
      sim.emit({ type: 'sealRejected', id: r, pos: d.pos, text: fromRaft ? 'signature' : 'raft' });
      return 'fail';
    }
    if (sim.breakSeal(r, `pulse${d.pulse.id}`, d.pos)) {
      if (this.coreExposed) {
        for (const s of this.eye.shapes) if (s.id !== 'eye:pupil') s.enabled = false;
        this.eye.shapes.find((s) => s.id === 'eye:pupil')!.enabled = true;
        sim.setBossPhase('open');
      } else sim.setBossPhase(`lid${this.seals.filter((s) => s.broken).length}`);
      return 'success';
    }
    return 'none';
  }

  updateDefeated(sim: Sim): void {
    sim.flowInverted = false;
    this.view.pose = 'defeat';
    this.view.poseT += DT;
  }

  private syncView(sim: Sim): void {
    const v = this.view;
    const pose = this.coreExposed ? 'open' : this.blink > 0 ? 'blink' : 'watch';
    if (v.pose !== pose) {
      v.pose = pose;
      v.poseT = 0;
    } else v.poseT += DT;
    const toP = norm(sub(sim.player.pos, this.eye.pos));
    v.parts.eye = { x: this.eye.pos.x, y: this.eye.pos.y, f: this.seals.filter((s) => s.broken).length };
    v.parts.look = { x: toP.x, y: toP.y };
    v.parts.tide = { x: this.tideSign, y: this.tideT / EYE.tide };
    this.rafts.forEach((r, i) => (v.parts[`raft${i}`] = { x: r.pos.x, y: r.pos.y }));
    v.flash = this.seals.some((s) => s.brokenTick === sim.tick) ? 0.3 : Math.max(0, v.flash - DT);
  }

  debugInfo() {
    return { tide: this.tideSign, tideT: +this.tideT.toFixed(1), fronts: 0 };
  }
}
