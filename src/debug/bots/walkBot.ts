// Route walker: follows waypoints (open straight segments in each area) until the area changes.
import { emptyInput, type InputFrame } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import type { AnyBot } from './index.ts';
import { dhypot } from '../../core/math/dmath.ts';

export const ROUTES: Record<string, { area: string; points: Vec[] }> = {
  'hub>quarry': { area: 'hub', points: [{ x: 360, y: 300 }, { x: 520, y: 120 }, { x: 520, y: -6 }] },
  'hub>garden': { area: 'hub', points: [{ x: 300, y: 250 }, { x: 60, y: 168 }, { x: -6, y: 168 }] },
  'hub>belfry': { area: 'hub', points: [{ x: 300, y: 250 }, { x: 120, y: 120 }, { x: 120, y: -6 }] },
  'hub>marsh': { area: 'hub', points: [{ x: 340, y: 250 }, { x: 580, y: 168 }, { x: 646, y: 168 }] },
  'hub>heart': { area: 'hub', points: [{ x: 320, y: 250 }, { x: 320, y: 60 }, { x: 320, y: 32 }] },
  'hub>records': { area: 'hub', points: [{ x: 360, y: 250 }, { x: 432, y: 196 }] },
  'hub>altar': { area: 'hub', points: [{ x: 280, y: 250 }, { x: 208, y: 196 }] },
  'quarry>B01': { area: 'quarry', points: [{ x: 250, y: 330 }, { x: 104, y: 60 }, { x: 104, y: -6 }] },
  'quarry>hub': { area: 'quarry', points: [{ x: 200, y: 200 }, { x: 328, y: 400 }, { x: 328, y: 452 }] },
};

export class WalkBot implements AnyBot {
  name: string;
  log: string[] = [];
  private idx = 0;
  private finished = false;
  private lastPos: Vec = { x: NaN, y: NaN };
  private still = 0;
  private readonly route: { area: string; points: Vec[] };
  constructor(route: string) {
    this.name = `walk:${route}`;
    this.route = ROUTES[route]!;
  }
  get done(): boolean {
    return this.finished;
  }
  next(sim: Sim): InputFrame {
    const f = emptyInput(sim.player.aim);
    if (sim.area.id !== this.route.area) {
      this.finished = true;
      return f;
    }
    // stuck against something (e.g. a sealed door): give up after ~0.75s without progress
    const here = sim.player.pos;
    if (!Number.isFinite(this.lastPos.x) || dhypot(here.x - this.lastPos.x, here.y - this.lastPos.y) > 0.5) {
      this.lastPos = { ...here };
      this.still = 0;
    } else if (++this.still > 45) {
      this.finished = true;
      this.log.push(`stuck at ${here.x.toFixed(0)},${here.y.toFixed(0)}`);
      return f;
    }
    const p = this.route.points[Math.min(this.idx, this.route.points.length - 1)]!;
    const dx = p.x - sim.player.pos.x;
    const dy = p.y - sim.player.pos.y;
    const d = dhypot(dx, dy);
    if (d < 4) {
      if (this.idx < this.route.points.length - 1) this.idx++;
      else this.finished = true;
    }
    f.move = d > 0.01 ? { x: dx / d, y: dy / d } : { x: 0, y: 0 };
    return f;
  }
}

/** does nothing but press E (for interactables) */
export class PressBot implements AnyBot {
  name = 'press';
  log: string[] = [];
  private n = 0;
  get done(): boolean {
    return this.n > 2;
  }
  next(sim: Sim): InputFrame {
    const f = emptyInput(sim.player.aim);
    f.pulse = this.n++ === 1;
    return f;
  }
}

/** stands in the open and lets the boss win (death/retry tests) */
export class IdleBot implements AnyBot {
  name = 'idle';
  log: string[] = [];
  get done(): boolean {
    return false;
  }
  next(sim: Sim): InputFrame {
    return emptyInput(sim.player.aim);
  }
}
