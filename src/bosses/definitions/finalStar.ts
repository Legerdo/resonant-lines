// FINAL 닫힌 별 — three phases.
//  A 회로 붕괴: the terminal ring rotates; link each broken outer circuit (t0-t1, t2-t3, t4-t5), catch the star's sweeping
//    Heat on it, and pulse clockwise (into t1/t3/t5).
//  B 역위상: some lines are anti-phased (flow reversed, shown by reversed chevrons + zigzag + particle flow).
//    North socket needs Heat through an ANTI-PHASED line; south socket needs Impact through a normal line.
//  C 무선 상태: every anchor surface dies except the star's socket, three orbiting debris shards (temporary anchors) and a
//    transient core shard. Close a moving three-point lattice on the star and deliver its Wave song into it.
import { DT } from '../../core/clock/fixedStep.ts';
import { type Vec, copy, sub, norm } from '../../core/math/vec.ts';
import { makeBody, circle } from '../../core/sim/bodies.ts';
import type { Body, DeliveryInfo, PulseResult } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { type BossController, makeSeals, newView } from '../framework/boss.ts';
import { datan2, dcos, dsin } from '../../core/math/dmath.ts';

export const STAR = {
  center: { x: 208, y: 146 },
  ringR: 108,
  ringSpin: 0.22,
  beamEvery: 5.2,
  antiEvery: 4,
  debrisR: 66,
  debrisSpin: 0.7,
  glowCycle: 3,
  glowOn: 2.1,
};
const ANTI_SETS: readonly string[][] = [['AB'], ['BC'], ['CA'], ['AB', 'BC'], ['BC', 'CA'], ['CA', 'AB']];

type Phase = 'A' | 'B' | 'C';

export class StarBoss implements BossController {
  readonly id = 'FINAL';
  phase = 'A';
  seals = makeSeals([
    { id: 'circ0', glyph: 0 }, { id: 'circ1', glyph: 0 }, { id: 'circ2', glyph: 0 }, { id: 'antiN', glyph: 1 }, { id: 'antiS', glyph: 2 },
  ], 'FINAL');
  coreExposed = false;
  defeated = false;
  view = newView();
  star!: Body;
  ring!: Body;
  debris: Body[] = [];
  shard!: Body;
  stage: Phase = 'A';
  t = 0;
  ringA = 0;
  beamT = 2.0;
  ringT = 2.5;
  antiT = 0;
  antiIdx = 0;
  debA = 0;
  shardT = 0;
  restored = [false, false, false];

  setup(sim: Sim): void {
    this.star = sim.addBody(makeBody('star', 'boss', copy(STAR.center), [
      circle('star:body', { x: 0, y: 0 }, 20, 'NonAnchorable', { blocksMove: true }),
      circle('star:sockN', { x: 0, y: -26 }, 6, 'BossAnchorable', { enabled: false, blocksMove: false, receiver: 'sockN' }),
      circle('star:sockS', { x: 0, y: 26 }, 6, 'BossAnchorable', { enabled: false, blocksMove: false, receiver: 'sockS' }),
    ]));
    const terms = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      terms.push(circle(`ring:t${i}`, { x: dcos(a) * STAR.ringR, y: dsin(a) * STAR.ringR * 0.8 }, 6, 'MovingAnchor', { blocksMove: false, receiver: `t${i}` }));
    }
    this.ring = sim.addBody(makeBody('ring', 'mechanism', copy(STAR.center), terms));
    for (let i = 0; i < 3; i++) {
      const d = sim.addBody(makeBody(`debris${i}`, 'mechanism', copy(STAR.center), [circle(`debris${i}:c`, { x: 0, y: 0 }, 6, 'TemporaryAnchor', { blocksMove: false })]));
      d.enabled = false;
      this.debris.push(d);
    }
    this.shard = sim.addBody(makeBody('coreShard', 'mechanism', copy(STAR.center), [circle('coreShard:c', { x: 0, y: 0 }, 6, 'TemporaryAnchor', { blocksMove: false })]));
    this.shard.enabled = false;
    this.syncView(sim);
  }

  private ringPos(i: number): Vec {
    const a = (i / 6) * Math.PI * 2 + this.ringA;
    return { x: STAR.center.x + dcos(a) * STAR.ringR, y: STAR.center.y + dsin(a) * STAR.ringR * 0.8 };
  }

  update(sim: Sim): void {
    this.t += DT;
    if (this.stage === 'A') {
      // the circuit ring turns; terminal positions are recomputed in local space so the body stays unrotated
      this.ringA += STAR.ringSpin * DT;
      this.ring.shapes.forEach((s, i) => {
        if (s.kind === 'circle') {
          const p = this.ringPos(i);
          s.c = { x: p.x - STAR.center.x, y: p.y - STAR.center.y };
        }
      });
      for (const n of sim.needles) {
        if (n.host?.bodyId === 'ring') {
          const s = this.ring.shapes.find((x) => x.id === n.host!.shapeId);
          if (s && s.kind === 'circle') n.host.local = { x: s.c.x + n.host.localNormal.x * 7.5, y: s.c.y + n.host.localNormal.y * 7.5 };
        }
      }
      this.beamT -= DT;
      if (this.beamT <= 0) {
        this.beamT = STAR.beamEvery;
        const base = datan2(sim.player.pos.y - STAR.center.y, sim.player.pos.x - STAR.center.x) + Math.PI * 0.5;
        for (const off of [0, Math.PI]) {
          sim.spawnAttack({ kind: 'beam', owner: 'star', sig: 'Heat', capturable: true, continuous: true, harmful: true, p: { x: STAR.center.x, y: STAR.center.y, ang: base + off, len: 150, w: 3, spin: 0.55, tele: 0.8, active: 3.0 } });
        }
      }
    } else if (this.stage === 'B') {
      this.antiT -= DT;
      if (this.antiT <= 0) {
        this.antiT = STAR.antiEvery;
        const set = ANTI_SETS[this.antiIdx++ % ANTI_SETS.length]!;
        sim.invertedLinks = new Set(set);
        sim.record(`FINAL anti ${set.join('+')}`);
      }
      this.ringT -= DT;
      if (this.ringT <= 0) {
        this.ringT = 3.4;
        sim.spawnAttack({ kind: 'ring', owner: 'star', sig: 'Impact', capturable: true, harmful: true, p: { x: STAR.center.x, y: STAR.center.y, r: 22, speed: 130, rMax: 200, th: 7, tele: 0.5 } });
      }
      this.beamT -= DT;
      if (this.beamT <= 0) {
        this.beamT = STAR.beamEvery + 1;
        const a = datan2(sim.player.pos.y - STAR.center.y, sim.player.pos.x - STAR.center.x) + 0.9;
        sim.spawnAttack({ kind: 'beam', owner: 'star', sig: 'Heat', capturable: true, continuous: true, harmful: true, p: { x: STAR.center.x, y: STAR.center.y, ang: a, len: 170, w: 3, spin: -0.5, tele: 0.8, active: 2.6 } });
      }
    } else {
      // no-line state: orbiting debris + a transient core shard are the only endpoints besides the star
      this.debA += STAR.debrisSpin * DT;
      this.debris.forEach((d, i) => {
        const a = this.debA + (i / 3) * Math.PI * 2;
        d.pos = { x: STAR.center.x + dcos(a) * STAR.debrisR, y: STAR.center.y + dsin(a) * STAR.debrisR * 0.8 };
        const on = (this.t + i * 1.0) % STAR.glowCycle < STAR.glowOn;
        d.shapes[0]!.enabled = on;
      });
      this.shardT += DT;
      const vis = this.shardT % 7 < 4;
      this.shard.enabled = vis;
      if (vis) {
        const k = Math.floor(this.shardT / 7);
        const a = k * 2.1 + 0.6;
        this.shard.pos = { x: STAR.center.x + dcos(a) * 110, y: STAR.center.y + dsin(a) * 80 };
      }
      this.ringT -= DT;
      if (this.ringT <= 0) {
        this.ringT = 3.0;
        sim.spawnAttack({ kind: 'ring', owner: 'star', sig: 'Wave', capturable: true, harmful: true, p: { x: STAR.center.x, y: STAR.center.y, r: 22, speed: 120, rMax: 205, th: 7, tele: 0.5 } });
        const d = norm(sub(sim.player.pos, STAR.center));
        for (let k = -1; k <= 1; k++) {
          const a = datan2(d.y, d.x) + k * 0.3;
          sim.spawnAttack({ kind: 'projectile', owner: 'star', harmful: true, p: { x: STAR.center.x, y: STAR.center.y, vx: dcos(a) * 140, vy: dsin(a) * 140, r: 3, range: 300 } });
        }
      }
    }
    this.syncView(sim);
  }

  onSimpleProgress(sim: Sim, brokenSeals: number): void {
    if (this.stage === 'A' && brokenSeals >= this.restored.length) {
      this.restored = [true, true, true];
      this.enterB(sim);
    } else if (this.stage === 'B' && this.coreExposed) {
      this.enterSimpleC(sim);
    }
  }

  private enterB(sim: Sim): void {
    this.stage = 'B';
    sim.setBossPhase('B');
    this.star.shapes[1]!.enabled = true;
    this.star.shapes[2]!.enabled = true;
    this.antiT = 0;
    this.beamT = 3;
    this.ringT = 1.5;
  }

  private enterC(sim: Sim): void {
    this.stage = 'C';
    sim.setBossPhase('C');
    sim.invertedLinks = new Set();
    // every anchor surface of the arena goes dark
    const world = sim.body('world');
    if (world) for (const s of world.shapes) s.tag = 'NonAnchorable';
    this.ring.enabled = false;
    this.star.shapes[2]!.enabled = false;
    for (const d of this.debris) d.enabled = true;
    this.t = 0;
    this.ringT = 1.2;
    sim.emit({ type: 'shake', value: 6 });
  }

  /** Keep the fixed arena anchors in the simplified finale so the player can repeat the same counter loop. */
  private enterSimpleC(sim: Sim): void {
    this.stage = 'C';
    sim.setBossPhase('C');
    sim.invertedLinks = new Set();
    this.star.shapes[1]!.enabled = true;
    this.star.shapes[2]!.enabled = true;
    this.t = 0;
    this.ringT = 1.2;
  }

  onPulseDelivered(sim: Sim, d: DeliveryInfo): PulseResult | undefined {
    const r = d.receiver ?? '';
    if (this.stage === 'A') {
      const m = /^t(\d)$/.exec(r);
      if (!m) return undefined;
      const i = Number(m[1]);
      const k = Math.floor(i / 2);
      const fromShape = sim.needle(d.pulse.from).host?.shapeId;
      const pairIn = i % 2 === 1 && fromShape === `ring:t${i - 1}`;
      if (d.pulse.sig !== 'Heat' || !pairIn || this.restored[k]) {
        sim.emit({ type: 'sealRejected', id: r, pos: d.pos, text: pairIn ? 'signature' : 'direction' });
        return 'fail';
      }
      this.restored[k] = true;
      sim.breakSeal(`circ${k}`, `pulse${d.pulse.id}`, d.pos);
      sim.record(`FINAL circuit ${k}`);
      if (this.restored.every(Boolean)) this.enterB(sim);
      return 'success';
    }
    if (this.stage === 'B') {
      if (r !== 'sockN' && r !== 'sockS') return undefined;
      const inverted = sim.invertedLinks.has(d.pulse.linkId);
      const ok = r === 'sockN' ? d.pulse.sig === 'Heat' && inverted : d.pulse.sig === 'Impact' && !inverted;
      const id = r === 'sockN' ? 'antiN' : 'antiS';
      if (!ok || this.seals.find((s) => s.id === id)!.broken) {
        sim.emit({ type: 'sealRejected', id: r, pos: d.pos, text: inverted ? 'phase' : 'signature' });
        return 'fail';
      }
      sim.breakSeal(id, `pulse${d.pulse.id}`, d.pos);
      if (this.coreExposed) this.enterC(sim);
      return 'success';
    }
    // C: converge the moving three-point net on the star
    if (r !== 'sockN') return undefined;
    const hosts = sim.needles.map((n) => n.host?.bodyId ?? '');
    const moving = hosts.filter((h) => h.startsWith('debris') || h === 'coreShard').length;
    if (d.pulse.sig === 'Wave' && sim.lattice.formed && moving >= 2) {
      sim.requestVictory(d.t, d.pos);
      return 'success';
    }
    sim.emit({ type: 'sealRejected', id: r, pos: d.pos, text: 'net' });
    return 'fail';
  }

  updateDefeated(sim: Sim): void {
    sim.invertedLinks = new Set();
    this.view.pose = 'defeat';
    this.view.poseT += DT;
  }

  private syncView(sim: Sim): void {
    const v = this.view;
    if (v.pose !== 'defeat') v.pose = this.stage;
    v.poseT += DT;
    v.parts.star = { x: this.star.pos.x, y: this.star.pos.y, f: ['A', 'B', 'C'].indexOf(this.stage) };
    for (let i = 0; i < 6; i++) {
      const p = this.ringPos(i);
      v.parts[`t${i}`] = { x: p.x, y: p.y, on: this.ring.enabled, f: this.restored[Math.floor(i / 2)] ? 1 : 0 };
    }
    this.debris.forEach((d, i) => (v.parts[`debris${i}`] = { x: d.pos.x, y: d.pos.y, on: d.enabled, f: d.shapes[0]!.enabled ? 1 : 0 }));
    v.parts.shard = { x: this.shard.pos.x, y: this.shard.pos.y, on: this.shard.enabled };
    v.flash = this.seals.some((s) => s.brokenTick === sim.tick) ? 0.3 : Math.max(0, v.flash - DT);
  }

  debugInfo() {
    return { stage: this.stage, restored: this.restored.map(Number).join(''), anti: [...(this.stage === 'B' ? ANTI_SETS[(this.antiIdx + ANTI_SETS.length - 1) % ANTI_SETS.length]! : [])].join('+') };
  }
}
