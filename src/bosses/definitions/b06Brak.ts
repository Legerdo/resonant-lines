// B06 재굴착자 브락 — "자원을 빼앗기는 상황을 공략으로 바꿀 수 있는가?"
// Brak tunnels under the quarry and swallows a planted needle; the swallowed needle stays linkable (an internal
// endpoint that travels with Brak). Deliver energy INTO it:
//  A: Impact while Brak is underground.  B: Heat whose stream ran along the line (spit aligned with the link).
//  C: Impact while Brak is surfaced (the short window after an eruption).
// Core: the drill jams at the surface and spits the needle back; its drill core opens. Close a lattice with two
// needles on columns; quakes charge the lines; when the whole triangle resonates, pulse into the drill core.
import { DT } from '../../core/clock/fixedStep.ts';
import { type Vec, copy, sub, norm, len, add, scale, dot } from '../../core/math/vec.ts';
import { makeBody, circle } from '../../core/sim/bodies.ts';
import type { Attack, Body, DeliveryInfo, Link, Needle, PulseResult } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { type BossController, makeSeals, newView } from '../framework/boss.ts';
import { isEmbedded } from '../../resonance/needle.ts';
import { datan2, dcos, dsin } from '../../core/math/dmath.ts';

type State = 'burrow' | 'tele' | 'surface' | 'jam';

export const BRAK = {
  start: { x: 208, y: 150 },
  digSpeed: 64,
  stealSpeed: 80,
  hunt: 2.4,
  tele: 0.9,
  surface: 1.5,
  quakeEvery: 2.8,
  alignCos: dcos((22 * Math.PI) / 180),
};

export class BrakBoss implements BossController {
  readonly id = 'B06';
  phase = 'hunt';
  seals = makeSeals([{ id: 'gutA', glyph: 0 }, { id: 'gutB', glyph: 1 }, { id: 'gutC', glyph: 2 }], 'B06');
  coreExposed = false;
  defeated = false;
  view = newView();
  body!: Body;
  belly!: Body;
  state: State = 'burrow';
  t = 0;
  target: Vec = copy(BRAK.start);
  eruption: Attack | null = null;
  quakeT = 1.5;
  spitDone = false;
  trail: Vec[] = [];

  setup(sim: Sim): void {
    this.body = sim.addBody(makeBody('brak', 'boss', copy(BRAK.start), [
      circle('brak:hide', { x: 0, y: 0 }, 15, 'NonAnchorable', { blocksMove: true }),
      circle('brak:drill', { x: 0, y: -14 }, 6, 'BossAnchorable', { enabled: false, blocksMove: false, receiver: 'drill' }),
    ]));
    this.body.enabled = false;
    // internal socket: never hit by needles, only filled by swallowing one; always follows Brak
    this.belly = sim.addBody(makeBody('brak:gut', 'boss', copy(BRAK.start), [
      circle('brak:belly', { x: 0, y: 0 }, 4, 'BossAnchorable', { blocksMove: false, blocksNeedle: false, receiver: 'belly' }),
    ]));
    this.syncView(sim);
  }

  stolen(sim: Sim): Needle | undefined {
    return sim.needles.find((n) => isEmbedded(n) && n.host?.shapeId === 'brak:belly');
  }

  private go(sim: Sim, s: State): void {
    this.state = s;
    this.t = 0;
    sim.record(`B06 ${s}`);
  }

  private move(to: Vec, speed: number): boolean {
    const d = sub(to, this.body.pos);
    const l = len(d);
    const step = speed * DT;
    if (l <= step) {
      this.body.pos = copy(to);
      return true;
    }
    this.body.pos = add(this.body.pos, scale(d, step / l));
    return false;
  }

  update(sim: Sim): void {
    this.t += DT;
    const gut = this.stolen(sim);
    switch (this.state) {
      case 'burrow': {
        if (!gut) {
          // hunt the nearest planted needle and swallow it
          const prey = sim.needles.filter((n) => n.state === 'EmbeddedWorld').sort((a, b) => len(sub(a.pos, this.body.pos)) - len(sub(b.pos, this.body.pos)))[0];
          if (prey) {
            if (this.move(prey.pos, BRAK.stealSpeed)) this.swallow(sim, prey);
          } else if (this.move(sim.player.pos, BRAK.digSpeed) || this.t > BRAK.hunt + 1) this.startEruption(sim);
        } else {
          this.move(sim.player.pos, BRAK.digSpeed);
          if (this.t >= BRAK.hunt) this.startEruption(sim);
        }
        break;
      }
      case 'tele':
        this.body.pos = copy(this.target);
        if (this.eruption && this.eruption.phase === 'active') {
          this.body.enabled = true;
          sim.emit({ type: 'shake', value: 4 });
          this.go(sim, 'surface');
          this.spitDone = false;
        }
        break;
      case 'surface': {
        // after the first seal Brak answers every eruption with a molten stream toward the player
        if (this.seals[0]!.broken && !this.spitDone && this.t >= 0.25) {
          this.spitDone = true;
          const d = norm(sub(sim.player.pos, this.body.pos));
          sim.spawnAttack({ kind: 'beam', owner: 'brak', sig: 'Heat', capturable: true, continuous: true, harmful: true, p: { x: this.body.pos.x, y: this.body.pos.y, ang: datan2(d.y, d.x), len: 230, w: 3, spin: 0, tele: 0.55, active: 0.9, spit: 1 } });
        }
        if (this.t >= BRAK.surface + (this.spitDone ? 0.9 : 0)) {
          this.body.enabled = false;
          this.go(sim, 'burrow');
        }
        break;
      }
      case 'jam': {
        this.quakeT -= DT;
        if (this.quakeT <= 0) {
          this.quakeT = BRAK.quakeEvery;
          sim.spawnAttack({ kind: 'ring', owner: 'brak', sig: 'Impact', capturable: true, harmful: true, p: { x: this.body.pos.x, y: this.body.pos.y, r: 18, speed: 150, rMax: 210, th: 7, tele: 0.6 } });
          sim.emit({ type: 'shake', value: 3 });
        }
        break;
      }
    }
    this.belly.pos = copy(this.body.pos);
    if (this.state === 'burrow' && sim.tick % 6 === 0) {
      this.trail.push(copy(this.body.pos));
      if (this.trail.length > 12) this.trail.shift();
    }
    this.syncView(sim);
  }

  private swallow(sim: Sim, n: Needle): void {
    n.host = { bodyId: 'brak:gut', shapeId: 'brak:belly', local: { x: 0, y: 0 }, localNormal: { x: 0, y: -1 } };
    n.state = 'EmbeddedBoss';
    n.recallLocked = true;
    n.stateTick = sim.tick;
    n.pos = copy(this.belly.pos);
    sim.record(`B06 swallow ${n.id}`);
    sim.emit({ type: 'sfx', text: 'swallow', needle: n.id, pos: copy(n.pos) });
  }

  private startEruption(sim: Sim): void {
    this.target = { x: Math.max(30, Math.min(386, sim.player.pos.x)), y: Math.max(44, Math.min(244, sim.player.pos.y)) };
    this.eruption = sim.spawnAttack({ kind: 'zone', owner: 'brak', sig: 'Impact', capturable: true, harmful: true, p: { x: this.target.x, y: this.target.y, r: 22, tele: BRAK.tele, active: 0.22 } });
    sim.emit({ type: 'telegraph', id: 'slam', sig: 'Impact', pos: copy(this.target) });
    this.go(sim, 'tele');
  }

  canRecall(sim: Sim, n: Needle): boolean {
    void sim;
    return n.host?.shapeId !== 'brak:belly';
  }

  onAttackLink(sim: Sim, a: Attack, l: Link) {
    if (a.p.spit) {
      // the stream only feeds a line it runs along (from Brak down the line)
      const gutN = [l.a, l.b].find((id) => sim.needle(id).host?.shapeId === 'brak:belly');
      if (!gutN) return undefined;
      const other = sim.needle(gutN === l.a ? l.b : l.a).pos;
      const dirLink = norm(sub(other, this.body.pos));
      const dirBeam = { x: dcos(a.p.ang!), y: dsin(a.p.ang!) };
      return dot(dirLink, dirBeam) >= BRAK.alignCos ? ('capture' as const) : ('ignore' as const);
    }
    return undefined;
  }

  onPulseDelivered(sim: Sim, d: DeliveryInfo): PulseResult | undefined {
    if (d.receiver === 'drill') {
      if (!this.coreExposed || d.pulse.sig !== 'Impact') return 'fail';
      const third = sim.links.find((l) => l.a !== d.needle.id && l.b !== d.needle.id);
      const whole = sim.lattice.formed && !!third && third.valid && (third.state === 'Charged' || third.state === 'Overloaded');
      if (!whole) {
        sim.emit({ type: 'sealRejected', id: 'drill', pos: d.pos, text: 'lattice' });
        return 'fail';
      }
      sim.requestVictory(d.t, d.pos);
      return 'success';
    }
    if (d.receiver !== 'belly') return undefined;
    const next = this.seals.find((s) => !s.broken);
    if (!next) return 'none';
    const under = this.state === 'burrow' || this.state === 'tele';
    let ok = false;
    if (next.id === 'gutA') ok = d.pulse.sig === 'Impact' && under;
    if (next.id === 'gutB') ok = d.pulse.sig === 'Heat';
    if (next.id === 'gutC') ok = d.pulse.sig === 'Impact' && this.state === 'surface';
    if (!ok) {
      sim.emit({ type: 'sealRejected', id: next.id, pos: d.pos, text: under ? 'underground' : 'surface' });
      return 'fail';
    }
    if (sim.breakSeal(next.id, `pulse${d.pulse.id}`, d.pos)) {
      if (this.coreExposed) this.jam(sim);
      else sim.setBossPhase(`gut${this.seals.filter((s) => s.broken).length}`);
      return 'success';
    }
    return 'none';
  }

  private jam(sim: Sim): void {
    const gut = this.stolen(sim);
    if (gut) sim.disableNeedle(gut, 0.6);
    if (this.eruption) this.eruption.phase = 'done';
    // jam where it is (surfacing if needed), drill core opens
    this.body.pos = { x: Math.max(80, Math.min(336, this.body.pos.x)), y: Math.max(80, Math.min(210, this.body.pos.y)) };
    this.body.enabled = true;
    this.body.shapes.find((s) => s.id === 'brak:drill')!.enabled = true;
    this.belly.enabled = false;
    sim.setBossPhase('jammed');
    this.go(sim, 'jam');
  }

  updateDefeated(sim: Sim): void {
    this.view.pose = 'defeat';
    this.view.poseT += DT;
    void sim;
  }

  private syncView(sim: Sim): void {
    const v = this.view;
    const pose = this.state === 'jam' ? 'jam' : this.state === 'surface' ? 'surface' : 'under';
    if (v.pose !== pose) {
      v.pose = pose;
      v.poseT = 0;
    } else v.poseT += DT;
    v.parts.body = { x: this.body.pos.x, y: this.body.pos.y, f: sim.player.pos.x >= this.body.pos.x ? 1 : -1 };
    v.parts.gut = { x: this.belly.pos.x, y: this.belly.pos.y, on: !!this.stolen(sim) };
    v.flash = this.seals.some((s) => s.brokenTick === sim.tick) ? 0.3 : Math.max(0, v.flash - DT);
  }

  debugInfo() {
    return { state: this.state, t: +this.t.toFixed(1) };
  }
}
