// B01 벽쇄자 그람 — "돌진을 피하기만 하지 말고 공명선에 통과시키면?"
// Seals: three carved monoliths. Each breaks only from Impact delivered INTO a needle planted in it, arriving
// through its carved face (N face=south, W face=east, E face=north). Then the back core opens: plant a needle in the
// core socket, close a lattice around Gram to pin him; the core charges the pinned lines; deliver it into the core.
import { DT } from '../../core/clock/fixedStep.ts';
import { type Vec, dot, add, scale, sub, len, copy } from '../../core/math/vec.ts';
import { makeBody, circle } from '../../core/sim/bodies.ts';
import type { Attack, Body, DeliveryInfo, Link, PulseResult } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { type BossController, makeSeals, newView } from '../framework/boss.ts';
import { dirTo, dislodgeNear, embeddedOn, moveBody, wallDistance } from '../behaviors/helpers.ts';
import { applyCapture, breakLink } from '../../resonance/link.ts';

type State = 'idle' | 'windup' | 'charge' | 'crash' | 'recover' | 'rear' | 'stomp' | 'pinned' | 'reel';

export const GRAM_FACES: Record<string, Vec> = {
  sealN: { x: 0, y: 1 }, // carved face looks south: pulse must travel north into it
  sealW: { x: 1, y: 0 }, // looks east: pulse must travel west into it
  sealE: { x: 0, y: -1 }, // looks north: pulse must travel south into it
};
const FACE_COS = 0.34;

export const GRAM = {
  radius: 16,
  home: { x: 208, y: 112 },
  idle: 0.75,
  windup: 0.9,
  windupExposed: 0.72,
  lock: 0.28,
  speed: 300,
  speedExposed: 340,
  stun: 1.05,
  stunExposed: 1.35,
  recover: 0.4,
  rear: 0.7,
  stompCd: 3.5,
  nearDist: 70,
  pinCharge: 0.6,
  pinTime: 4.2,
};

export class GramBoss implements BossController {
  readonly id = 'B01';
  phase = 'hunt';
  seals = makeSeals([{ id: 'sealN', glyph: 0 }, { id: 'sealW', glyph: 1 }, { id: 'sealE', glyph: 2 }], 'B01');
  coreExposed = false;
  defeated = false;
  view = newView();
  body!: Body;
  state: State = 'idle';
  t = 0;
  dir: Vec = { x: 0, y: 1 };
  facing = 1;
  charge: Attack | null = null;
  stompCd = 1.5;
  nearT = 0;
  pinCharged = false;
  crashPoint: Vec | null = null;
  faceFlash: Record<string, number> = {};

  setup(sim: Sim): void {
    // colliders match the sprite: ground footprint + raised shoulder boulder + head; the core socket sits on the
    // upper back (reachable from above/behind), enabled only once all three seals are broken.
    this.body = sim.addBody(
      makeBody('gram', 'boss', copy(GRAM.home), [
        circle('gram:body', { x: 0, y: 0 }, GRAM.radius, 'NonAnchorable', { blocksMove: true, blocksNeedle: true }),
        circle('gram:hump', { x: 2, y: -19 }, 10, 'NonAnchorable', { blocksMove: false, blocksNeedle: true }),
        circle('gram:head', { x: 19, y: -7 }, 7, 'NonAnchorable', { blocksMove: false, blocksNeedle: true }),
        circle('gram:socket', { x: -12, y: -20 }, 6, 'BossAnchorable', { enabled: false, blocksMove: false, receiver: 'core' }),
      ]),
    );
    this.syncView(sim);
  }

  private socket() {
    return this.body.shapes.find((s) => s.id === 'gram:socket')!;
  }

  private setFacing(sim: Sim, f: number): void {
    if (f === this.facing || f === 0) return;
    this.facing = f;
    for (const s of this.body.shapes) if (s.kind === 'circle' && s.id !== 'gram:body') s.c = { x: -s.c.x, y: s.c.y };
    // a needle in the socket stays in the socket when Gram turns
    for (const n of sim.needlesOn('gram', 'gram:socket')) n.host!.local = { x: -n.host!.local.x, y: n.host!.local.y };
  }

  private go(sim: Sim, s: State): void {
    this.state = s;
    this.t = 0;
    sim.record(`B01 ${s}`);
  }

  update(sim: Sim): void {
    const p = sim.player;
    const b = this.body;
    this.t += DT;
    this.stompCd -= DT;
    for (const k of Object.keys(this.faceFlash)) this.faceFlash[k] = Math.max(0, this.faceFlash[k]! - DT);
    const toP = sub(p.pos, b.pos);
    const dP = len(toP);
    const sealsBroken = this.seals.filter((s) => s.broken).length;
    const socketNeedle = embeddedOn(sim, 'gram:socket');

    if (this.coreExposed && this.state !== 'pinned' && socketNeedle && sim.lattice.formed) this.enterPin(sim);

    switch (this.state) {
      case 'idle': {
        if (Math.abs(toP.x) > 6) this.setFacing(sim, Math.sign(toP.x));
        this.nearT = dP < GRAM.nearDist ? this.nearT + DT : 0;
        const wait = this.coreExposed ? GRAM.idle * 0.7 : GRAM.idle;
        if (this.t >= wait) {
          if ((this.nearT > 0.35 || sealsBroken >= 2) && this.stompCd <= 0 && dP < GRAM.nearDist + 30) this.go(sim, 'rear');
          else this.startWindup(sim);
        }
        break;
      }
      case 'windup': {
        const wind = this.coreExposed ? GRAM.windupExposed : GRAM.windup;
        if (this.t < wind - GRAM.lock) {
          this.dir = dirTo(b.pos, p.pos, this.dir);
          if (Math.abs(this.dir.x) > 0.15) this.setFacing(sim, Math.sign(this.dir.x));
        }
        const c = this.charge!;
        const dist = wallDistance(sim, b.pos, this.dir);
        c.tele = { kind: 'capsule', a: copy(b.pos), b: add(b.pos, scale(this.dir, Math.max(8, dist - GRAM.radius))), r: 1 };
        c.p.lock = this.t >= wind - GRAM.lock ? 1 : 0;
        if (this.t >= wind) {
          c.phase = 'active';
          c.t = 0;
          c.shape = { kind: 'circle', c: add(b.pos, scale(this.dir, 6)), r: GRAM.radius + 1 };
          sim.emit({ type: 'attack', id: 'charge', sig: 'Impact', value: c.id, pos: copy(b.pos) });
          this.go(sim, 'charge');
        }
        break;
      }
      case 'charge': {
        const hit = moveBody(sim, b, this.dir, this.coreExposed ? GRAM.speedExposed : GRAM.speed, GRAM.radius);
        if (this.charge) this.charge.shape = { kind: 'circle', c: add(b.pos, scale(this.dir, 6)), r: GRAM.radius + 1 };
        if (hit || this.t > 3) this.crash(sim, hit ?? b.pos);
        break;
      }
      case 'crash':
        if (this.t >= (this.coreExposed ? GRAM.stunExposed : GRAM.stun)) this.go(sim, 'recover');
        break;
      case 'recover':
        if (this.t >= GRAM.recover) this.go(sim, 'idle');
        break;
      case 'rear':
        if (this.t >= GRAM.rear) {
          sim.spawnAttack({
            kind: 'ring', owner: 'gram', sig: 'Impact', capturable: true, harmful: true,
            p: { x: b.pos.x, y: b.pos.y, r: 14, speed: 210, rMax: 125, th: 8, tele: 0 },
          });
          sim.emit({ type: 'shake', value: 4 });
          this.stompCd = GRAM.stompCd;
          this.go(sim, 'stomp');
        }
        break;
      case 'stomp':
        if (this.t >= 0.45) this.go(sim, 'idle');
        break;
      case 'pinned': {
        if (!socketNeedle || !sim.lattice.formed) {
          this.breakFree(sim, 'lattice');
          break;
        }
        if (!this.pinCharged && this.t >= GRAM.pinCharge) {
          this.pinCharged = true;
          for (const l of sim.links) {
            if (!l.valid || (l.a !== socketNeedle.id && l.b !== socketNeedle.id)) continue;
            if (l.state === 'Idle' || l.state === 'Charging') applyCapture(sim, l, 'Impact', -1, -1);
          }
          sim.emit({ type: 'sfx', text: 'coreHum', pos: copy(b.pos) });
        }
        if (this.t >= GRAM.pinTime) this.breakFree(sim, 'timeout');
        break;
      }
      case 'reel':
        if (this.t >= 1.2) this.go(sim, 'idle');
        break;
    }
    this.syncView(sim);
  }

  private startWindup(sim: Sim): void {
    this.dir = dirTo(this.body.pos, sim.player.pos, this.dir);
    this.charge = sim.spawnAttack({ kind: 'charge', owner: 'gram', sig: 'Impact', capturable: true, harmful: true, p: { tele: this.coreExposed ? GRAM.windupExposed : GRAM.windup, w: GRAM.radius, ring: 1 } });
    this.go(sim, 'windup');
  }

  private crash(sim: Sim, at: Vec): void {
    if (this.charge) this.charge.phase = 'done';
    this.charge = null;
    this.crashPoint = copy(at);
    sim.emit({ type: 'shake', value: 5 });
    sim.emit({ type: 'sfx', text: 'crash', pos: copy(at) });
    dislodgeNear(sim, at, 22);
    const broken = this.seals.filter((s) => s.broken).length;
    if (broken >= 1) {
      // rubble shaken loose from the ceiling near the player (telegraphed shadows)
      const n = broken >= 2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = sim.rng.range(0, Math.PI * 2);
        const d = sim.rng.range(10, 46);
        const x = Math.max(28, Math.min(388, sim.player.pos.x + Math.cos(a) * d));
        const y = Math.max(44, Math.min(244, sim.player.pos.y + Math.sin(a) * d));
        sim.spawnAttack({ kind: 'zone', owner: 'gram', harmful: true, p: { x, y, r: 10, tele: 1.0 + i * 0.18, active: 0.12, rock: 1 } });
      }
    }
    this.go(sim, 'crash');
  }

  private enterPin(sim: Sim): void {
    if (this.charge) this.charge.phase = 'done';
    this.charge = null;
    this.pinCharged = false;
    sim.setBossPhase('pinned');
    this.go(sim, 'pinned');
  }

  private breakFree(sim: Sim, why: string): void {
    const n = embeddedOn(sim, 'gram:socket');
    if (n) {
      for (const l of sim.links) if (l.a === n.id || l.b === n.id) if (l.valid) breakLink(sim, l, 'breakFree');
      sim.disableNeedle(n, 1.2);
    }
    sim.emit({ type: 'shake', value: 4 });
    sim.record(`B01 breakFree ${why}`);
    sim.setBossPhase('exposed');
    this.stompCd = 0;
    this.go(sim, why === 'timeout' ? 'rear' : 'reel');
  }

  onAttackLink(sim: Sim, _a: Attack, l: Link) {
    // Gram's own body cannot charge lines anchored to itself
    const onGram = (id: 'A' | 'B' | 'C') => sim.needle(id).host?.bodyId === 'gram';
    if (onGram(l.a) || onGram(l.b)) return 'ignore' as const;
    return undefined;
  }

  onPulseDelivered(sim: Sim, d: DeliveryInfo): PulseResult | undefined {
    const r = d.receiver;
    if (r && GRAM_FACES[r]) {
      const seal = this.seals.find((s) => s.id === r)!;
      if (seal.broken) return 'none';
      const face = GRAM_FACES[r]!;
      const through = -dot(d.pulse.dir, face);
      if (d.pulse.sig !== 'Impact' || through < FACE_COS) {
        this.faceFlash[r] = 0.8;
        sim.emit({ type: 'sealRejected', id: r, pos: d.pos, text: d.pulse.sig !== 'Impact' ? 'signature' : 'face' });
        return 'fail';
      }
      if (sim.breakSeal(r, `pulse${d.pulse.id}`, d.pos)) {
        const broken = this.seals.filter((s) => s.broken).length;
        sim.setBossPhase(this.coreExposed ? 'exposed' : broken === 1 ? 'cracked' : 'fractured');
        if (this.coreExposed) this.socket().enabled = true;
        if (this.state === 'idle' || this.state === 'recover') this.go(sim, 'reel');
        return 'success';
      }
      return 'none';
    }
    if (r === 'core') {
      if (d.pulse.sig !== 'Impact') return 'fail';
      if (this.state === 'pinned') {
        sim.requestVictory(d.t, d.pos);
        return 'success';
      }
      // unpinned hit staggers but cannot finish
      if (this.charge) this.charge.phase = 'done';
      this.charge = null;
      this.go(sim, 'crash');
      return 'success';
    }
    return undefined;
  }

  updateDefeated(sim: Sim): void {
    this.state = 'crash';
    this.t += DT;
    this.view.pose = 'defeat';
    this.view.poseT += DT;
    this.syncProps(sim);
  }

  private syncProps(_sim: Sim): void {
    for (const s of this.seals) {
      const flash = (this.faceFlash[s.id] ?? 0) > 0;
      this.view.props[s.id] = s.broken ? 'broken' : flash ? 'flash' : 'intact';
    }
  }

  private syncView(sim: Sim): void {
    const v = this.view;
    const pose = this.state === 'crash' || this.state === 'reel' ? 'crash' : this.state;
    if (v.pose !== pose) {
      v.pose = pose;
      v.poseT = 0;
    } else v.poseT += DT;
    v.facing = this.facing;
    v.parts.body = { x: this.body.pos.x, y: this.body.pos.y };
    v.parts.core = { x: this.body.pos.x - 12 * this.facing, y: this.body.pos.y - 20, on: this.coreExposed };
    v.parts.lock = { x: 0, y: 0, on: !!this.charge?.p.lock };
    v.flash = this.seals.some((s) => s.brokenTick === sim.tick) ? 0.25 : Math.max(0, v.flash - DT);
    this.syncProps(sim);
  }

  debugInfo() {
    return { state: this.state, t: +this.t.toFixed(2), phase: this.phase, core: this.coreExposed, pinCharged: this.pinCharged };
  }
}
