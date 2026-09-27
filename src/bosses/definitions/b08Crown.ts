// B08 무언의 왕관 — "보스가 내가 만든 공명망을 읽는다면?"
// The crown scores what you show it (decaying 4 s memory) and answers the dominant pattern:
//   long lines  -> CUT   (Void blade sweep: severs lines > 110 px, charges shorter ones)
//   small lattice -> PRESS (Impact slam on the lattice centroid)
//   needles on it -> EJECT (throws them off, then sings a Wave ring)
// Each answer leaves its jewel receptive for a moment: deliver that same energy into the crown's gem.
// Show one pattern to bait an answer, then switch shape to exploit it. Core: trap the crown inside a lattice
// and discharge its song (Wave) into the net.
import { DT } from '../../core/clock/fixedStep.ts';
import { type Vec, copy, sub, norm, lerp, add } from '../../core/math/vec.ts';
import { makeBody, circle } from '../../core/sim/bodies.ts';
import { pointInTriangle } from '../../core/geometry/geom.ts';
import type { Attack, Body, DeliveryInfo, Link, PulseResult } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { type BossController, makeSeals, newView } from '../framework/boss.ts';
import { datan2, dcos, dexp, dsin } from '../../core/math/dmath.ts';

export type Answer = 'cut' | 'press' | 'eject' | 'shards' | 'ring';
type State = 'hover' | 'tell' | 'act' | 'recover' | 'return';

export const CROWN = {
  home: { x: 208, y: 100 },
  decide: 4.2,
  tau: 4,
  threshold: 0.9,
  longLen: 130,
  cutLimit: 110,
  smallArea: 5200,
  tell: { cut: 0.85, press: 1.1, eject: 0.6, shards: 0.5, ring: 0.7 } as Record<Answer, number>,
  window: 1.7,
  sweep: 1.25,
};

export class CrownBoss implements BossController {
  readonly id = 'B08';
  phase = 'watch';
  seals = makeSeals([{ id: 'void', glyph: 0 }, { id: 'impact', glyph: 1 }, { id: 'wave', glyph: 2 }], 'B08');
  coreExposed = false;
  defeated = false;
  view = newView();
  body!: Body;
  state: State = 'hover';
  t = 0;
  age = 0;
  answer: Answer = 'shards';
  scores = { long: 0, tri: 0, anchor: 0 };
  decideT = 2.5;
  receptive: 'Void' | 'Impact' | 'Wave' | null = null;
  windowT = 0;
  attack: Attack | null = null;
  pressAt: Vec = copy(CROWN.home);
  from: Vec = copy(CROWN.home);
  ejected = false;
  readonly history: string[] = [];

  setup(sim: Sim): void {
    this.body = sim.addBody(makeBody('crown', 'boss', copy(CROWN.home), [
      circle('crown:band', { x: 0, y: 0 }, 14, 'NonAnchorable', { blocksMove: true }),
      circle('crown:gem', { x: 0, y: 16 }, 6, 'BossAnchorable', { blocksMove: false, receiver: 'gem' }),
      circle('crown:prong', { x: 0, y: -15 }, 6, 'BossAnchorable', { blocksMove: false }),
    ]));
    this.syncView(sim);
  }

  private prongT = 0;

  private go(sim: Sim, s: State): void {
    this.state = s;
    this.t = 0;
    sim.record(`B08 ${s} ${this.answer}`);
  }

  private observe(sim: Sim): void {
    const k = dexp(-DT / CROWN.tau);
    const long = sim.links.some((l) => l.valid && l.length > CROWN.longLen);
    const tri = sim.lattice.formed && sim.lattice.area < CROWN.smallArea;
    // dependence = a needle riding the prongs for a while (a quick gem needle is not "reliance")
    const onProng = sim.needles.some((n) => n.state === 'EmbeddedBoss' && n.host?.shapeId === 'crown:prong');
    this.prongT = onProng ? this.prongT + DT : 0;
    const anchor = this.prongT >= 1.5;
    this.scores.long = this.scores.long * k + (long ? DT : 0);
    this.scores.tri = this.scores.tri * k + (tri ? DT : 0);
    this.scores.anchor = this.scores.anchor * k + (anchor ? DT : 0);
  }

  /** deterministic reading of the player's net (ties: anchor > lattice > long) */
  chooseAnswer(): Answer {
    const s = this.scores;
    const cands: [Answer, number][] = [['eject', s.anchor], ['press', s.tri], ['cut', s.long]];
    let best: Answer = 'shards';
    let bv = CROWN.threshold;
    for (const [a, v] of cands) if (v > bv + 1e-9) {
      best = a;
      bv = v;
    }
    return best;
  }

  update(sim: Sim): void {
    this.t += DT;
    this.age += DT;
    this.observe(sim);
    if (this.windowT > 0) {
      this.windowT -= DT;
      if (this.windowT <= 0) this.receptive = null;
    }
    const b = this.body;
    switch (this.state) {
      case 'hover': {
        const c = CROWN.home;
        b.pos = { x: c.x + dsin(this.age * 0.6) * 26, y: c.y + dsin(this.age * 0.9) * 8 + (this.coreExposed ? 26 : 0) };
        this.decideT -= DT;
        if (this.decideT <= 0) {
          this.answer = this.chooseAnswer();
          this.history.push(this.answer);
          if (this.answer === 'press') this.pressAt = sim.lattice.formed ? copy(sim.lattice.centroid) : copy(sim.player.pos);
          this.from = copy(b.pos);
          this.go(sim, 'tell');
        }
        break;
      }
      case 'tell': {
        if (this.answer === 'press') b.pos = lerp(this.from, { x: this.pressAt.x, y: this.pressAt.y - 6 }, Math.min(1, this.t / CROWN.tell.press));
        if (this.answer === 'press' && this.t <= DT) {
          this.attack = sim.spawnAttack({ kind: 'zone', owner: 'crown', sig: 'Impact', capturable: true, harmful: true, p: { x: this.pressAt.x, y: this.pressAt.y, r: 32, tele: CROWN.tell.press, active: 0.2 } });
        }
        if (this.t >= CROWN.tell[this.answer]) this.act(sim);
        break;
      }
      case 'act': {
        if (this.answer === 'cut' && this.attack) {
          const a = this.attack;
          const ang = a.p.ang! + (a.t / CROWN.sweep) * Math.PI * 2;
          const inner = add(b.pos, { x: dcos(ang) * 16, y: dsin(ang) * 16 });
          const outer = add(b.pos, { x: dcos(ang) * 230, y: dsin(ang) * 230 });
          a.shape = { kind: 'capsule', a: inner, b: outer, r: 3 };
          if (a.t >= CROWN.sweep) {
            a.phase = 'done';
            this.openWindow(sim, 'Void');
            this.go(sim, 'recover');
          }
        } else if (this.answer === 'eject') {
          if (!this.ejected) {
            this.ejected = true;
            // only the prongs shake off their riders; the gem keeps what it holds
            for (const n of sim.needlesOn('crown', 'crown:prong')) sim.disableNeedle(n, 0.5);
            this.prongT = 0;
            sim.emit({ type: 'shake', value: 2 });
          }
          if (this.t >= 0.55) {
            sim.spawnAttack({ kind: 'ring', owner: 'crown', sig: 'Wave', capturable: true, harmful: true, p: { x: b.pos.x, y: b.pos.y, r: 14, speed: 140, rMax: 210, th: 7, tele: 0 } });
            this.openWindow(sim, 'Wave');
            this.go(sim, 'recover');
          }
        } else if (this.answer === 'press') {
          b.pos = { x: this.pressAt.x, y: this.pressAt.y - 6 };
          if (this.t >= 0.2) {
            this.openWindow(sim, 'Impact');
            this.go(sim, 'recover');
          }
        } else if (this.answer === 'ring') {
          sim.spawnAttack({ kind: 'ring', owner: 'crown', sig: 'Wave', capturable: true, harmful: true, p: { x: b.pos.x, y: b.pos.y, r: 14, speed: 130, rMax: 220, th: 7, tele: 0 } });
          this.go(sim, 'recover');
        } else {
          const d = norm(sub(sim.player.pos, b.pos));
          for (let k = -2; k <= 2; k++) {
            const a = datan2(d.y, d.x) + k * 0.2;
            sim.spawnAttack({ kind: 'projectile', owner: 'crown', harmful: true, p: { x: b.pos.x, y: b.pos.y, vx: dcos(a) * 150, vy: dsin(a) * 150, r: 3, range: 300 } });
          }
          this.go(sim, 'recover');
        }
        break;
      }
      case 'recover':
        if (this.t >= (this.answer === 'shards' || this.answer === 'ring' ? 0.6 : CROWN.window)) {
          this.from = copy(b.pos);
          this.go(sim, 'return');
        }
        break;
      case 'return': {
        const c = CROWN.home;
        const tgt = { x: c.x + dsin(this.age * 0.6) * 26, y: c.y + dsin(this.age * 0.9) * 8 + (this.coreExposed ? 26 : 0) };
        b.pos = lerp(this.from, tgt, Math.min(1, this.t / 0.8));
        if (this.t >= 0.8) {
          this.decideT = CROWN.decide - 2.4;
          this.go(sim, 'hover');
        }
        break;
      }
    }
    this.syncView(sim);
  }

  private act(sim: Sim): void {
    this.ejected = false;
    if (this.answer === 'cut') {
      // the sweep starts pointing at the longest line the crown was reading
      const longest = [...sim.links].filter((l) => l.valid).sort((x, y) => y.length - x.length)[0];
      const tgt = longest ? lerp(sim.needle(longest.a).pos, sim.needle(longest.b).pos, 0.5) : sim.player.pos;
      const d = sub(tgt, this.body.pos);
      this.attack = sim.spawnAttack({ kind: 'cut', owner: 'crown', sig: 'Void', capturable: true, harmful: true, phase: 'active', p: { ang: datan2(d.y, d.x) } });
    }
    this.go(sim, 'act');
  }

  private openWindow(sim: Sim, sig: 'Void' | 'Impact' | 'Wave'): void {
    this.receptive = sig;
    this.windowT = CROWN.window;
    sim.record(`B08 window ${sig}`);
  }

  onAttackLink(sim: Sim, a: Attack, l: Link) {
    if (a.kind === 'cut') return l.length > CROWN.cutLimit ? ('cut' as const) : ('capture' as const);
    void sim;
    return undefined;
  }

  onPulseDelivered(sim: Sim, d: DeliveryInfo): PulseResult | undefined {
    if (this.coreExposed) {
      // bait it into your own small net: it presses into the centroid; discharge that Impact while it sits inside
      if (d.pulse.sig !== 'Impact' || this.receptive !== 'Impact' || !sim.lattice.formed) return undefined;
      const [A, B, C] = [sim.needle('A').pos, sim.needle('B').pos, sim.needle('C').pos];
      if (pointInTriangle(this.body.pos, A, B, C)) {
        sim.requestVictory(d.t, d.pos);
        return 'success';
      }
      sim.emit({ type: 'sealRejected', id: 'net', pos: d.pos, text: 'outside' });
      return 'fail';
    }
    if (d.receiver !== 'gem') return undefined;
    const map = { Void: 'void', Impact: 'impact', Wave: 'wave' } as const;
    const sig = d.pulse.sig as keyof typeof map;
    const sealId = map[sig];
    if (!sealId || this.receptive !== d.pulse.sig) {
      sim.emit({ type: 'sealRejected', id: 'gem', pos: d.pos, text: this.receptive ? 'signature' : 'closed' });
      return 'fail';
    }
    const seal = this.seals.find((s) => s.id === sealId)!;
    if (seal.broken) return 'none';
    if (sim.breakSeal(sealId, `pulse${d.pulse.id}`, d.pos)) {
      this.receptive = null;
      sim.setBossPhase(this.coreExposed ? 'full' : `jewel${this.seals.filter((s) => s.broken).length}`);
      return 'success';
    }
    return 'none';
  }

  updateDefeated(sim: Sim): void {
    this.view.pose = 'defeat';
    this.view.poseT += DT;
    this.body.pos = { x: this.body.pos.x, y: Math.min(this.body.pos.y + DT * 20, 200) };
    void sim;
  }

  private syncView(sim: Sim): void {
    const v = this.view;
    const pose = this.state === 'tell' ? `tell_${this.answer}` : this.state === 'act' ? `act_${this.answer}` : this.receptive ? 'open' : 'idle';
    if (v.pose !== pose && v.pose !== 'defeat') {
      v.pose = pose;
      v.poseT = 0;
    } else v.poseT += DT;
    v.parts.body = { x: this.body.pos.x, y: this.body.pos.y };
    v.parts.gem = { x: this.body.pos.x, y: this.body.pos.y + 16, f: this.receptive === 'Void' ? 1 : this.receptive === 'Impact' ? 2 : this.receptive === 'Wave' ? 3 : 0 };
    v.parts.read = { x: this.scores.long, y: this.scores.tri, f: this.scores.anchor };
    v.parts.press = { x: this.pressAt.x, y: this.pressAt.y, on: this.answer === 'press' && this.state === 'tell' };
    v.flash = this.seals.some((s) => s.brokenTick === sim.tick) ? 0.3 : Math.max(0, v.flash - DT);
  }

  debugInfo() {
    return { state: this.state, answer: this.answer, rec: this.receptive ?? '-', long: +this.scores.long.toFixed(2), tri: +this.scores.tri.toFixed(2), anc: +this.scores.anchor.toFixed(2) };
  }
}
