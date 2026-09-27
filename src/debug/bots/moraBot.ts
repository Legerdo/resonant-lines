// B04 fixture bot: A bridge c0 + lure a slam onto it -> c0a; B tip -> c3a charged by the slamming tip;
// C fork-in (c1b and a root tip both into c1a); core: heart <- powered c0a.
import { emptyInput, type InputFrame } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { Placer, survive, steerTo, shapePos } from './botKit.ts';
import type { MoraBoss } from '../../bosses/definitions/b04Mora.ts';
import type { AnyBot } from './index.ts';

const charged = (sim: Sim, a: 'A' | 'B' | 'C', b: 'A' | 'B' | 'C') => {
  const l = sim.linkBetween(a, b);
  return l.valid && l.sig === 'Impact' && (l.state === 'Charged' || l.state === 'Overloaded');
};

export class MoraBot implements AnyBot {
  name = 'B04';
  log: string[] = [];
  private placer = new Placer();
  private finished = false;
  get done(): boolean {
    return this.finished;
  }

  next(sim: Sim): InputFrame {
    const f = emptyInput(this.placer.aim);
    const fight = sim.fight;
    if (!fight || fight.result === 'intro') return f;
    if (fight.result !== 'ongoing') {
      this.finished = fight.result === 'victory';
      return f;
    }
    const boss = sim.boss as MoraBoss;
    const avoid = [boss.core.pos];
    const seal = boss.seals.findIndex((s) => !s.broken);
    let pulseAt: Vec | null = null;
    const tipOf = (i: number) => `mora:tip${i}`;
    if (!boss.coreExposed && seal === 0) {
      const okA = this.placer.place(sim, f, 'A', { shape: 'p:c0a' }, avoid);
      const okB = okA && this.placer.place(sim, f, 'B', { shape: 'p:c0b' }, avoid);
      if (okA && okB) {
        if (charged(sim, 'A', 'B')) pulseAt = shapePos(sim, 'p:c0a');
        else steerTo(sim, f, { x: 66, y: 148 }, 3); // stand on the bridge: the slam lands on it
      }
    } else if (!boss.coreExposed && seal === 1) {
      // a needle on a root tip (the west arm slams at us when we stand west), the other on c3a
      const okA = this.placer.place(sim, f, 'A', { shape: 'p:c3a' }, avoid);
      const arm = boss.arms[1]!;
      const onTip = sim.needle('B').host?.shapeId?.startsWith('mora:tip') ?? false;
      if (okA && !onTip) {
        if (arm.state === 'down') this.placer.place(sim, f, 'B', { shape: tipOf(1) }, []);
        else steerTo(sim, f, { x: 330, y: 170 }, 4);
      }
      if (okA && onTip) {
        if (charged(sim, 'A', 'B')) pulseAt = shapePos(sim, 'p:c3a');
        else steerTo(sim, f, { x: 320, y: 150 }, 4);
      }
    } else if (!boss.coreExposed && seal === 2) {
      const okA = this.placer.place(sim, f, 'A', { shape: 'p:c1a' }, avoid);
      const okB = okA && this.placer.place(sim, f, 'B', { shape: 'p:c1b' }, avoid);
      const arm = boss.arms[0]!;
      const cOnTip = sim.needle('C').host?.shapeId === tipOf(0);
      if (okA && okB && !cOnTip) {
        if (arm.state === 'down' && sim.needle('C').state === 'Held') this.placer.place(sim, f, 'C', { shape: tipOf(0) }, []);
        else if (sim.needle('C').state !== 'Held' && sim.needle('C').state !== 'Returning' && sim.needle('C').state !== 'Flying') {
          if (sim.player.selected !== 2) f.selIndex = 2;
          else f.recall = true;
        } else steerTo(sim, f, { x: 150, y: 214 }, 4);
      }
      if (okA && okB && cOnTip) {
        if (charged(sim, 'A', 'B') && charged(sim, 'A', 'C')) pulseAt = shapePos(sim, 'p:c1a');
        else steerTo(sim, f, { x: 146, y: 234 }, 4);
      }
    } else if (boss.coreExposed) {
      const okA = this.placer.place(sim, f, 'A', { shape: 'mora:heart' }, []);
      const okB = okA && this.placer.place(sim, f, 'B', { shape: 'p:c0a' }, avoid);
      if (okA && okB) {
        if (charged(sim, 'A', 'B')) pulseAt = sim.needle('A').pos;
        else steerTo(sim, f, { x: 120, y: 200 }, 6);
      }
    }
    if (pulseAt && sim.player.pulseCd <= 0 && !sim.pendingPulse) {
      this.placer.aim = pulseAt;
      f.pulse = true;
      f.fire = false;
    }
    survive(sim, f);
    f.aim = { ...this.placer.aim };
    return f;
  }
}
