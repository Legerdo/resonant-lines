// B07 fixture bot: needles on Ar, Or and the pedestal; release into the pedestal so it lands in the asked configuration.
import { emptyInput, type InputFrame } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { Placer, survive, steerTo } from './botKit.ts';
import { ORBIT, type OrbitBoss } from '../../bosses/definitions/b07Orbit.ts';
import type { AnyBot } from './index.ts';

export class OrbitBot implements AnyBot {
  name = 'B07';
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
    const boss = sim.boss as OrbitBoss;
    let pulseAt: Vec | null = null;
    const okC = this.placer.place(sim, f, 'C', { shape: 'p:pedestal' }, []);
    const okA = okC && this.placer.place(sim, f, 'A', { shape: 'ar:orb' }, []);
    const okB = okA && this.placer.place(sim, f, 'B', { shape: 'or:orb' }, []);
    if (okA && okB && okC) {
      const charged = (id: 'AB' | 'BC' | 'CA') => {
        const l = sim.link(id);
        return l.valid && l.sig === 'Rotational' && (l.state === 'Charged' || l.state === 'Overloaded');
      };
      // predict the configuration when a pulse released now would land (startup + travel ~0.2 s)
      const lead = 0.2 * ((Math.PI * 2) / ORBIT.pAr + (Math.PI * 2) / ORBIT.pOr) * (boss.coreExposed ? 1.25 : 1);
      const sepNow = boss.separation();
      const rel = Math.atan2(Math.sin(boss.aAr - boss.aOr), Math.cos(boss.aAr - boss.aOr));
      const future = Math.abs(Math.atan2(Math.sin(rel + lead), Math.cos(rel + lead)));
      void sepNow;
      const want = boss.seals.find((s) => !s.broken)?.id;
      const target = want === 'opp' ? Math.PI : want === 'conj' ? 0 : want === 'quad' ? Math.PI / 2 : -1;
      if (!boss.coreExposed) {
        if ((charged('CA') || charged('BC')) && target >= 0 && Math.abs(future - target) < ORBIT.tol * 0.6) pulseAt = sim.needle('C').pos;
      } else if (charged('AB') && sim.lattice.formed) pulseAt = sim.needle('A').pos;
      if (!pulseAt) steerTo(sim, f, { x: 40, y: 246 }, 8);
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
