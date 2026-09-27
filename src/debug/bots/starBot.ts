// FINAL fixture bot: circuits clockwise, anti-phase aware sockets, then the moving three-point net.
import { emptyInput, type InputFrame, type NeedleId } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { Placer, survive, steerTo } from './botKit.ts';
import type { StarBoss } from '../../bosses/definitions/finalStar.ts';
import type { AnyBot } from './index.ts';
import { isEmbedded } from '../../resonance/needle.ts';

export class StarBot implements AnyBot {
  name = 'FINAL';
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
    const boss = sim.boss as StarBoss;
    let pulseAt: Vec | null = null;
    const charged = (a: NeedleId, b: NeedleId, sig: string) => {
      const l = sim.linkBetween(a, b);
      return l.valid && l.sig === sig && (l.state === 'Charged' || l.state === 'Overloaded');
    };
    if (boss.stage === 'A') {
      const k = boss.restored.findIndex((r) => !r);
      const okA = this.placer.place(sim, f, 'A', { shape: `ring:t${2 * k}` }, [boss.star.pos]);
      const okB = okA && this.placer.place(sim, f, 'B', { shape: `ring:t${2 * k + 1}` }, [boss.star.pos]);
      if (okA && okB) {
        if (charged('A', 'B', 'Heat')) pulseAt = sim.needle('B').pos;
        else steerTo(sim, f, { x: 208, y: 250 }, 10);
      }
    } else if (boss.stage === 'B') {
      const nDone = boss.seals.find((s) => s.id === 'antiN')!.broken;
      if (!nDone) {
        const okA = this.placer.place(sim, f, 'A', { shape: 'star:sockN' }, []);
        const okB = okA && this.placer.place(sim, f, 'B', { shape: 'ring:t4' }, []);
        if (okA && okB) {
          // Heat through an anti-phased line: aim at the far end, energy flows into the socket
          if (charged('A', 'B', 'Heat') && sim.invertedLinks.has('AB')) pulseAt = sim.needle('B').pos;
          else steerTo(sim, f, { x: 60, y: 240 }, 10);
        }
      } else {
        const okC = this.placer.place(sim, f, 'C', { shape: 'star:sockS' }, []);
        const okB = okC && this.placer.place(sim, f, 'B', { shape: 'ring:t1' }, []);
        if (okB && okC) {
          if (charged('B', 'C', 'Impact') && !sim.invertedLinks.has('BC')) pulseAt = sim.needle('C').pos;
          else steerTo(sim, f, { x: 360, y: 240 }, 10);
        }
      }
    } else {
      const okA = this.placer.place(sim, f, 'A', { shape: 'star:sockN' }, []);
      const lit = boss.debris.map((d, i) => ({ i, d })).filter(({ d }) => d.shapes[0]!.enabled);
      const onDeb = (id: NeedleId) => (sim.needle(id).host?.bodyId ?? '').startsWith('debris') || sim.needle(id).host?.bodyId === 'coreShard';
      for (const id of ['B', 'C'] as NeedleId[]) {
        if (!okA || onDeb(id)) continue;
        const other = id === 'B' ? 'C' : 'B';
        const taken = sim.needle(other).host?.bodyId;
        const pick = lit.find(({ i }) => `debris${i}` !== taken);
        if (pick && (sim.needle(id).state === 'Held' || !isEmbedded(sim.needle(id)))) this.placer.place(sim, f, id, { shape: `debris${pick.i}:c` }, []);
        break;
      }
      const wave = sim.links.find((l) => l.valid && l.sig === 'Wave' && (l.state === 'Charged' || l.state === 'Overloaded') && (l.a === 'A' || l.b === 'A'));
      if (okA && onDeb('B') && onDeb('C') && sim.lattice.formed && wave) pulseAt = sim.needle('A').pos;
      else if (!pulseAt) steerTo(sim, f, { x: 208, y: 250 }, 10);
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
