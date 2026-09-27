// B03 fixture bot: hook the true body, feed it reflection glare (Heat), from behind, then overloaded;
// finally trap the swimming body inside a post lattice and discharge Heat.
import { emptyInput, type InputFrame } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { Placer, survive, steerTo, lurePoint, shapePos } from './botKit.ts';
import { pointInTriangle } from '../../core/geometry/geom.ts';
import type { NeraBoss } from '../../bosses/definitions/b03Nera.ts';
import type { AnyBot } from './index.ts';

export class NeraBot implements AnyBot {
  name = 'B03';
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
    const boss = sim.boss as NeraBoss;
    const T = boss.trueFig.body;
    const trueShape = T.shapes[0]!.id;
    const ab = sim.link('AB');
    const heat = ab.valid && ab.sig === 'Heat' && (ab.state === 'Charged' || ab.state === 'Overloaded');
    let pulseAt: Vec | null = null;
    if (!boss.coreExposed) {
      const next = boss.seals.find((s) => !s.broken)!;
      const okA = this.placer.place(sim, f, 'A', { shape: trueShape }, []);
      // B on the post farthest from the player-side so beams can cross A-B
      const posts = ['p:postW', 'p:postE', 'p:postN', 'p:postS'].map((id) => ({ id, p: shapePos(sim, id)! }));
      posts.sort((a, b) => Math.hypot(a.p.x - T.pos.x, a.p.y - T.pos.y) - Math.hypot(b.p.x - T.pos.x, b.p.y - T.pos.y));
      const bPost = posts[0]!;
      const okB = okA && this.placer.place(sim, f, 'B', { shape: bPost.id }, [T.pos]);
      if (okA && okB) {
        const A = sim.needle('A').pos;
        const B = sim.needle('B').pos;
        const need = next.id === 'scaleC' ? ab.state === 'Overloaded' : heat;
        if (need) {
          if (next.id === 'scaleB') {
            // stand beyond Nera, opposite B, so the energy reaches her back
            const dx = A.x - B.x;
            const dy = A.y - B.y;
            const l = Math.hypot(dx, dy) || 1;
            const behind = { x: A.x + (dx / l) * 64, y: A.y + (dy / l) * 64 };
            const at = steerTo(sim, f, { x: Math.max(30, Math.min(386, behind.x)), y: Math.max(40, Math.min(250, behind.y)) }, 10);
            const fx = boss.view.parts.face;
            const aligned = fx ? (dx / l) * fx.x + (dy / l) * fx.y > 0.45 : false;
            if (at || aligned) pulseAt = A;
          } else pulseAt = A;
        } else {
          // lure the next glare across A-B: stand on the far side of the line from the firing figure
          const live = boss.figs.filter((x) => x.body.enabled);
          const shooter = live[boss.beamIdx % Math.max(1, live.length)]?.body.pos ?? T.pos;
          const lp = lurePoint(A, B, shooter, 50);
          steerTo(sim, f, { x: Math.max(30, Math.min(386, lp.x)), y: Math.max(40, Math.min(250, lp.y)) }, 6);
        }
      }
    } else {
      const okA = this.placer.place(sim, f, 'A', { shape: 'p:postW' }, [T.pos]);
      const okB = okA && this.placer.place(sim, f, 'B', { shape: 'p:postE' }, [T.pos]);
      const okC = okB && this.placer.place(sim, f, 'C', { shape: 'p:postS' }, [T.pos]);
      if (okA && okB && okC) {
        const A = sim.needle('A').pos;
        const B = sim.needle('B').pos;
        const C = sim.needle('C').pos;
        const charged = sim.links.some((l) => l.valid && l.sig === 'Heat' && (l.state === 'Charged' || l.state === 'Overloaded'));
        const lead = { x: T.pos.x + (T.pos.x - T.prevPos.x) * 14, y: T.pos.y + (T.pos.y - T.prevPos.y) * 14 };
        if (charged && sim.lattice.formed && pointInTriangle(T.pos, A, B, C) && pointInTriangle(lead, A, B, C)) pulseAt = A;
        else if (!charged) {
          const lp = lurePoint(A, B, T.pos, 44);
          steerTo(sim, f, { x: Math.max(30, Math.min(386, lp.x)), y: Math.max(40, Math.min(250, lp.y)) }, 6);
        } else steerTo(sim, f, { x: 208, y: 40 }, 8);
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
