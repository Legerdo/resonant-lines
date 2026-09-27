// B06 fixture bot: bait a needle to be swallowed, then feed the swallowed needle through a column link.
import { emptyInput, type InputFrame, type NeedleId } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { Placer, survive, steerTo, shapePos } from './botKit.ts';
import type { BrakBoss } from '../../bosses/definitions/b06Brak.ts';
import type { AnyBot } from './index.ts';
import { isEmbedded } from '../../resonance/needle.ts';
import { dhypot } from '../../core/math/dmath.ts';

const COLS = ['p:colNW', 'p:colNE', 'p:colSW', 'p:colSE'];

export class BrakBot implements AnyBot {
  name = 'B06';
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
    const boss = sim.boss as BrakBoss;
    const brak = boss.body.pos;
    let pulseAt: Vec | null = null;
    const charged = (a: NeedleId, b: NeedleId, sig: string) => {
      const l = sim.linkBetween(a, b);
      return l.valid && l.sig === sig && (l.state === 'Charged' || l.state === 'Overloaded');
    };
    if (!boss.coreExposed) {
      const gut = boss.stolen(sim);
      if (!gut) {
        // bait: plant A on the south-west column and wait for Brak to swallow it
        if (!(isEmbedded(sim.needle('A')) || sim.needle('A').host?.shapeId === 'brak:belly')) this.placer.place(sim, f, 'A', { shape: 'p:colSW' }, []);
        steerTo(sim, f, { x: 208, y: 236 }, 8);
      } else {
        const col = 'p:colSW';
        const other: NeedleId = gut.id === 'B' ? 'C' : 'B';
        const ok = this.placer.place(sim, f, other, { shape: col }, [brak]);
        if (ok) {
          const next = boss.seals.find((s) => !s.broken)!.id;
          const B = sim.needle(other).pos;
          if (next === 'gutA') {
            if (charged(other, gut.id, 'Impact') && boss.state === 'burrow' && boss.t > 0.1) pulseAt = gut.pos;
            else if (!charged(other, gut.id, 'Impact')) steerTo(sim, f, { x: B.x + 50, y: B.y - 20 }, 8);
          } else if (next === 'gutB') {
            // lure the eruption west of the column, then cross to the east so the stream runs along Brak->column
            if (charged(other, gut.id, 'Heat')) pulseAt = gut.pos;
            else if (boss.state === 'burrow') steerTo(sim, f, { x: B.x - 46, y: B.y }, 3);
            else steerTo(sim, f, { x: B.x + 42, y: B.y }, 2);
          } else if (next === 'gutC') {
            if (charged(other, gut.id, 'Impact') && boss.state === 'surface') pulseAt = gut.pos;
            else steerTo(sim, f, { x: B.x + 50, y: B.y - 20 }, 8);
          }
        }
      }
    } else {
      // pick the two columns nearest the jammed body
      const cols = COLS.map((id) => ({ id, p: shapePos(sim, id)! })).sort((a, b) => dhypot(a.p.x - brak.x, a.p.y - brak.y) - dhypot(b.p.x - brak.x, b.p.y - brak.y));
      const okA = this.placer.place(sim, f, 'A', { shape: cols[0]!.id }, [brak]);
      const okB = okA && this.placer.place(sim, f, 'B', { shape: cols[1]!.id }, [brak]);
      const okC = okB && this.placer.place(sim, f, 'C', { shape: 'brak:drill' }, []);
      if (okA && okB && okC) {
        const all = sim.links.every((l) => l.valid && l.sig === 'Impact' && (l.state === 'Charged' || l.state === 'Overloaded'));
        if (all && sim.lattice.formed) pulseAt = sim.needle('C').pos;
        else steerTo(sim, f, { x: brak.x < 208 ? 360 : 56, y: 236 }, 8);
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
