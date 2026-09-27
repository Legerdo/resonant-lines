// B01 fixture bot: beats Gram with zero tunings using only inputs (A16). Route:
// sealN (link sealW->sealN), sealW (same line, pulse the other way), sealE (link sealN->sealE),
// then crash Gram near the north wall, plant a needle in the exposed core, close the lattice, pulse into the core.
import { emptyInput, type InputFrame, type NeedleId } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { NIDX, clearShot, danger, embeddedIn, lurePoint, shapePos, steerTo, throwSpots } from './botKit.ts';
import { isEmbedded } from '../../resonance/needle.ts';
import type { GramBoss } from '../../bosses/definitions/b01Gram.ts';
import { dhypot } from '../../core/math/dmath.ts';

type Step = 'sealN' | 'sealW' | 'sealE' | 'core' | 'done';

export interface Bot {
  name: string;
  readonly done: boolean;
  next(sim: Sim): InputFrame;
  log: string[];
}

export class GramBot implements Bot {
  name = 'B01';
  step: Step = 'sealN';
  log: string[] = [];
  private aim: Vec = { x: 208, y: 100 };
  private spot: Vec | null = null;
  private cooldown = 0;
  get done(): boolean {
    return this.step === 'done';
  }

  private say(sim: Sim, s: string): void {
    this.log.push(`${sim.tick} ${s}`);
  }

  /** make needle `id` embedded in shape `shape`; returns true when satisfied */
  private place(sim: Sim, f: InputFrame, id: NeedleId, shape: string, avoid: Vec[]): boolean {
    const n = sim.needle(id);
    if (embeddedIn(sim, id, shape)) return true;
    const target = shapePos(sim, shape);
    if (!target) return false;
    if (n.state === 'Flying' || n.state === 'Returning') return false;
    if (n.state !== 'Held') {
      // wrong place: pull it back
      if (sim.player.selected !== NIDX[id]) f.selIndex = NIDX[id];
      else f.recall = true;
      return false;
    }
    const me = sim.player.pos;
    if (clearShot(sim, me, target, shape) && this.cooldown <= 0) {
      if (sim.player.selected !== NIDX[id]) {
        f.selIndex = NIDX[id];
        return false;
      }
      this.aim = target;
      f.fire = true;
      this.cooldown = 10;
      this.spot = null;
      return false;
    }
    if (!this.spot || !clearShot(sim, this.spot, target, shape)) this.spot = throwSpots(sim, target, shape, avoid)[0] ?? null;
    if (this.spot) steerTo(sim, f, this.spot);
    this.aim = target;
    return false;
  }

  /** stand where Gram's charge toward us must cross segment a-b */
  private lure(sim: Sim, f: InputFrame, a: Vec, b: Vec, gram: Vec): void {
    const lp = lurePoint(a, b, gram, 44);
    const clamped = { x: Math.max(40, Math.min(376, lp.x)), y: Math.max(56, Math.min(236, lp.y)) };
    steerTo(sim, f, clamped, 4);
  }

  next(sim: Sim): InputFrame {
    const f = emptyInput(this.aim);
    this.cooldown--;
    const fight = sim.fight;
    if (!fight || fight.result === 'intro') return f;
    if (fight.result !== 'ongoing') {
      if (fight.result === 'victory') this.step = 'done';
      return f;
    }
    const boss = sim.boss as GramBoss;
    const gram = boss.body.pos;
    const esc = danger(sim);
    const charged = (a: NeedleId, b: NeedleId) => {
      const l = sim.linkBetween(a, b);
      return l.valid && (l.state === 'Charged' || l.state === 'Overloaded') && l.sig === 'Impact';
    };
    const avoid = [gram];
    // ---------------------------------------------------------------- plan
    const N = shapePos(sim, 'p:sealN')!;
    const W = shapePos(sim, 'p:sealW')!;
    const E = shapePos(sim, 'p:sealE')!;
    if (this.step === 'sealN' && boss.seals[0]!.broken) {
      this.step = 'sealW';
      this.say(sim, 'sealN done');
    }
    if (this.step === 'sealW' && boss.seals[1]!.broken) {
      this.step = 'sealE';
      this.say(sim, 'sealW done');
    }
    if (this.step === 'sealE' && boss.seals[2]!.broken) {
      this.step = 'core';
      this.say(sim, 'sealE done');
    }
    let wantPulse: Vec | null = null;
    switch (this.step) {
      case 'sealN':
      case 'sealW': {
        const okA = this.place(sim, f, 'A', 'p:sealN', avoid);
        const okB = okA && this.place(sim, f, 'B', 'p:sealW', avoid);
        if (okA && okB) {
          if (charged('A', 'B')) wantPulse = this.step === 'sealN' ? N : W;
          else this.lure(sim, f, N, W, gram);
        }
        break;
      }
      case 'sealE': {
        const okA = this.place(sim, f, 'A', 'p:sealN', avoid);
        const okC = okA && this.place(sim, f, 'C', 'p:sealE', avoid);
        if (okA && okC) {
          if (charged('A', 'C')) wantPulse = E;
          else this.lure(sim, f, N, E, gram);
        }
        break;
      }
      case 'core': {
        const okA = this.place(sim, f, 'A', 'p:sealN', avoid);
        const okC = okA && this.place(sim, f, 'C', 'p:sealE', avoid);
        if (!okA || !okC) break;
        const b = sim.needle('B');
        const inSocket = embeddedIn(sim, 'B', 'gram:socket');
        if (inSocket) {
          if (boss.state === 'pinned' && (charged('A', 'B') || charged('B', 'C'))) wantPulse = b.pos;
          else steerTo(sim, f, { x: 208, y: 200 });
          break;
        }
        if (b.state !== 'Held') {
          if (b.state === 'Flying' || b.state === 'Returning') break;
          if (sim.player.selected !== 1) f.selIndex = 1;
          else f.recall = true;
          break;
        }
        // bait a crash near the north wall between sealN and sealE, then shoot the socket while Gram is dazed
        const socket = shapePos(sim, 'gram:socket')!;
        const between = dhypot(gram.x - N.x, gram.y - N.y) < 165 && dhypot(gram.x - E.x, gram.y - E.y) < 165;
        if (boss.state === 'crash' && between) {
          const me = sim.player.pos;
          if (clearShot(sim, me, socket, 'gram:socket')) {
            if (sim.player.selected !== 1) f.selIndex = 1;
            else if (this.cooldown <= 0) {
              this.aim = socket;
              f.fire = true;
              this.cooldown = 10;
            }
          } else {
            const spot = throwSpots(sim, socket, 'gram:socket', [], 0)[0];
            if (spot) steerTo(sim, f, spot);
          }
          this.aim = socket;
        } else if (boss.state !== 'crash') {
          steerTo(sim, f, { x: 292, y: 52 }, 4);
        }
        break;
      }
      default:
        break;
    }
    if (wantPulse && sim.player.pulseCd <= 0 && !sim.pendingPulse) {
      this.aim = wantPulse;
      f.pulse = true;
      f.fire = false;
    }
    // ---------------------------------------------------------------- survive (overrides movement)
    if (esc) {
      if (esc.x === 0 && esc.y === 0) {
        // ring about to pass: dash through toward its centre
        const ring = sim.attacks.find((a) => a.phase === 'active' && a.shape?.kind === 'ring');
        if (ring && ring.shape?.kind === 'ring') {
          const d = dhypot(sim.player.pos.x - ring.shape.c.x, sim.player.pos.y - ring.shape.c.y);
          if (d - ring.shape.rOut < 14 && d > ring.shape.rIn - 6) {
            f.move = { x: (ring.shape.c.x - sim.player.pos.x) / (d || 1), y: (ring.shape.c.y - sim.player.pos.y) / (d || 1) };
            f.dash = true;
          }
        }
      } else {
        f.move = esc;
        const locked = sim.attacks.some((a) => a.kind === 'charge' && (a.phase === 'active' || a.p.lock === 1));
        if (locked) f.dash = true;
      }
    }
    f.aim = { ...this.aim };
    void isEmbedded;
    return f;
  }
}
