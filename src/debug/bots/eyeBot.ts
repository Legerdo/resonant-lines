// B05 fixture bot: raft-anchored lines into the lids/duct, waiting for alignment; respects the reversed tide.
import { emptyInput, type InputFrame, type NeedleId } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { Placer, survive, steerTo, lurePoint } from './botKit.ts';
import type { EyeBoss } from '../../bosses/definitions/b05Eye.ts';
import type { AnyBot } from './index.ts';

export class EyeBot implements AnyBot {
  name = 'B05';
  log: string[] = [];
  private placer = new Placer();
  private finished = false;
  get done(): boolean {
    return this.finished;
  }

  /** aim so that energy flows INTO `into` from `from` given the current tide */
  private aimInto(sim: Sim, into: NeedleId, from: NeedleId): Vec {
    return sim.flowInverted ? sim.needle(from).pos : sim.needle(into).pos;
  }

  next(sim: Sim): InputFrame {
    const f = emptyInput(this.placer.aim);
    const fight = sim.fight;
    if (!fight || fight.result === 'intro') return f;
    if (fight.result !== 'ongoing') {
      this.finished = fight.result === 'victory';
      return f;
    }
    const boss = sim.boss as EyeBoss;
    const ab = sim.link('AB');
    const next = boss.seals.find((s) => !s.broken);
    let pulseAt: Vec | null = null;
    const charged = (l = ab) => l.valid && (l.state === 'Charged' || l.state === 'Overloaded');
    if (next) {
      const socket = next.id === 'lidUp' ? 'eye:lidUp' : next.id === 'lidLow' ? 'eye:lidLow' : 'eye:duct';
      const okA = this.placer.place(sim, f, 'A', { shape: socket }, []);
      const okB = okA && this.placer.place(sim, f, 'B', { shape: 'raft0:pad' }, []);
      if (okA && okB) {
        const want =
          next.id === 'lidLow' ? charged() && ab.sig === 'Impact' : next.id === 'duct' ? ab.state === 'Overloaded' && ab.sig === 'Wave' : charged() && ab.sig === 'Wave';
        if (want) pulseAt = this.aimInto(sim, 'A', 'B');
        else if (next.id === 'lidLow') {
          // lure a jet across the raft line: stand beyond it, away from the eye
          const lp = lurePoint(sim.needle('A').pos, sim.needle('B').pos, boss.eye.pos, 46);
          steerTo(sim, f, { x: Math.max(30, Math.min(386, lp.x)), y: Math.max(90, Math.min(240, lp.y)) }, 6);
        } else steerTo(sim, f, { x: 208, y: 200 }, 8);
      }
    } else {
      const okA = this.placer.place(sim, f, 'A', { shape: 'eye:pupil' }, []);
      const okB = okA && this.placer.place(sim, f, 'B', { shape: 'raft0:pad' }, []);
      const okC = okB && this.placer.place(sim, f, 'C', { shape: 'raft2:pad' }, []);
      if (okA && okB && okC) {
        const into = sim.links.find((l) => charged(l) && l.sig === 'Wave' && (l.a === 'A' || l.b === 'A'));
        if (into && sim.lattice.formed) {
          const other = (into.a === 'A' ? into.b : into.a) as NeedleId;
          pulseAt = this.aimInto(sim, 'A', other);
        } else steerTo(sim, f, { x: 208, y: 236 }, 8);
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
