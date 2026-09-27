// B08 fixture bot: bait each counter on purpose, then exploit its window.
//  Void: gem needle + short line + long bait line -> CUT.   Impact: small net including the gem -> PRESS.
//  Wave: ride the prongs -> EJECT -> ring.   Core: small net of posts -> PRESS into it -> discharge.
import { emptyInput, type InputFrame, type NeedleId } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { Placer, survive, steerTo } from './botKit.ts';
import type { CrownBoss } from '../../bosses/definitions/b08Crown.ts';
import type { AnyBot } from './index.ts';
import { isEmbedded } from '../../resonance/needle.ts';

export class CrownBot implements AnyBot {
  name = 'B08';
  log: string[] = [];
  private placer = new Placer();
  private finished = false;
  get done(): boolean {
    return this.finished;
  }

  private free(sim: Sim, f: InputFrame, id: NeedleId): boolean {
    const n = sim.needle(id);
    if (n.state === 'Held') return true;
    if (n.state === 'Flying' || n.state === 'Returning') return false;
    if (sim.player.selected !== ['A', 'B', 'C'].indexOf(id)) f.selIndex = ['A', 'B', 'C'].indexOf(id);
    else f.recall = true;
    return false;
  }

  next(sim: Sim): InputFrame {
    const f = emptyInput(this.placer.aim);
    const fight = sim.fight;
    if (!fight || fight.result === 'intro') return f;
    if (fight.result !== 'ongoing') {
      this.finished = fight.result === 'victory';
      return f;
    }
    const boss = sim.boss as CrownBoss;
    const next = boss.seals.find((s) => !s.broken)?.id;
    let pulseAt: Vec | null = null;
    const chargedWith = (a: NeedleId, b: NeedleId, sig: string) => {
      const l = sim.linkBetween(a, b);
      return l.valid && l.sig === sig && (l.state === 'Charged' || l.state === 'Overloaded');
    };
    const gemOk = () => sim.needle('A').host?.shapeId === 'crown:gem';
    if (next === 'void') {
      const okB = this.placer.place(sim, f, 'B', { shape: 'p:postW' }, []);
      const okC = okB && this.placer.place(sim, f, 'C', { point: { x: 392 + 12, y: 104 }, tol: 20 }, []);
      const okA = okC && this.placer.place(sim, f, 'A', { shape: 'crown:gem' }, []);
      if (okA && okB && okC) {
        if (boss.receptive === 'Void' && chargedWith('A', 'B', 'Void')) pulseAt = sim.needle('A').pos;
        else steerTo(sim, f, { x: 60, y: 244 }, 8);
      }
    } else if (next === 'impact') {
      const okB = this.placer.place(sim, f, 'B', { shape: 'p:postW' }, []);
      const okC = okB && this.placer.place(sim, f, 'C', { shape: 'p:postE' }, []);
      const okA = okC && (gemOk() || this.placer.place(sim, f, 'A', { shape: 'crown:gem' }, []));
      if (okA && okB && okC) {
        const charged = chargedWith('A', 'B', 'Impact') || chargedWith('A', 'C', 'Impact');
        if (boss.receptive === 'Impact' && charged) pulseAt = sim.needle('A').pos;
        else steerTo(sim, f, { x: 60, y: 244 }, 8);
      }
    } else if (next === 'wave') {
      const okC = this.placer.place(sim, f, 'C', { shape: 'p:postS' }, []);
      const okA = okC && (gemOk() || this.placer.place(sim, f, 'A', { shape: 'crown:gem' }, []));
      if (okA && okC) {
        const bOn = sim.needle('B').host?.shapeId === 'crown:prong';
        if (!bOn && boss.receptive !== 'Wave' && boss.answer !== 'eject') this.placer.place(sim, f, 'B', { shape: 'crown:prong' }, []);
        if (boss.receptive === 'Wave' && chargedWith('A', 'C', 'Wave')) pulseAt = sim.needle('A').pos;
        else if (bOn || boss.answer === 'eject') steerTo(sim, f, { x: 60, y: 244 }, 8);
      }
    } else {
      // core: a small net of the three posts; wait for the press to land inside it
      if (sim.needle('A').host?.shapeId === 'crown:gem' || sim.needle('A').host?.bodyId === 'crown') this.free(sim, f, 'A');
      const okA = !isEmbedded(sim.needle('A')) || sim.needle('A').host?.shapeId === 'p:postW' ? this.placer.place(sim, f, 'A', { shape: 'p:postW' }, []) : false;
      const okB = okA && this.placer.place(sim, f, 'B', { shape: 'p:postE' }, []);
      const okC = okB && this.placer.place(sim, f, 'C', { shape: 'p:postS' }, []);
      if (okA && okB && okC) {
        const anyImpact = sim.links.some((l) => l.valid && l.sig === 'Impact' && (l.state === 'Charged' || l.state === 'Overloaded'));
        if (boss.receptive === 'Impact' && anyImpact && sim.lattice.formed) {
          const l = sim.links.find((k) => k.valid && k.sig === 'Impact' && (k.state === 'Charged' || k.state === 'Overloaded'))!;
          pulseAt = sim.needle(l.a).pos;
        } else steerTo(sim, f, { x: 60, y: 244 }, 8);
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
