// B02 fixture bot: answer each bell with its own pitch, then feed the chord into the swinging clapper.
import { emptyInput, type InputFrame } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { Placer, survive, shapePos, steerTo } from './botKit.ts';
import type { HummingBoss } from '../../bosses/definitions/b02Humming.ts';
import type { AnyBot } from './index.ts';

const PANEL: Record<number, Vec> = { 0: { x: 112, y: 20 }, 1: { x: 304, y: 20 }, 2: { x: 112, y: 270 } };
const WAIT: Record<number, Vec> = { 0: { x: 64, y: 170 }, 1: { x: 352, y: 170 }, 2: { x: 80, y: 226 } };

export class HumBot implements AnyBot {
  name = 'B02';
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
    const boss = sim.boss as HummingBoss;
    const avoid = [boss.body.pos];
    let pulseAt: Vec | null = null;
    const ab = sim.link('AB');
    const ca = sim.link('CA');
    if (!boss.coreExposed) {
      const k = boss.seals.findIndex((s) => !s.broken);
      const bell = `p:bell${k}`;
      const okA = this.placer.place(sim, f, 'A', { shape: bell }, avoid);
      const okB = okA && this.placer.place(sim, f, 'B', { point: { x: PANEL[k]!.x, y: k === 2 ? 256 : 32 }, tol: 18 }, avoid);
      if (okA && okB) {
        if (ab.valid && (ab.state === 'Charged' || ab.state === 'Overloaded') && ab.sig === 'Wave' && ab.tone === k) pulseAt = shapePos(sim, bell);
        else steerTo(sim, f, WAIT[k]!, 6);
      }
    } else {
      // A on the small bell, C on the clapper while it glows; wait for the chord
      const okA = this.placer.place(sim, f, 'A', { shape: 'p:bell2' }, avoid);
      const clap = boss.clapper.shapes[0]!;
      const cOn = sim.needle('C').host?.shapeId === 'hum:clapper';
      if (okA && !cOn && clap.enabled) this.placer.place(sim, f, 'C', { shape: 'hum:clapper' }, []);
      else if (okA && !cOn) steerTo(sim, f, { x: 208, y: 224 }, 6);
      if (cOn && ca.valid && (ca.state === 'Charged' || ca.state === 'Overloaded') && ca.tone === 3) pulseAt = sim.needle('C').pos;
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
