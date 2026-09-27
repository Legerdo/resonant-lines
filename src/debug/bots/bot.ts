// Scripted input bots used by automated tests and E2E. Bots only produce InputFrames (the same path as a human);
// they read Sim state to decide, but never mutate it.
import { emptyInput, type InputFrame, type NeedleId } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { isEmbedded } from '../../resonance/needle.ts';
import { dhypot } from '../../core/math/dmath.ts';

export type Task = (sim: Sim, f: InputFrame, bot: ScriptBot) => boolean;

export class ScriptBot {
  tasks: Task[] = [];
  aim: Vec = { x: 0, y: 0 };
  t = 0; // ticks in current task
  log: string[] = [];
  readonly name: string;
  constructor(name: string, tasks: Task[] = []) {
    this.name = name;
    this.tasks = tasks;
  }
  push(...t: Task[]): this {
    this.tasks.push(...t);
    return this;
  }
  get done(): boolean {
    return this.tasks.length === 0;
  }
  next(sim: Sim): InputFrame {
    const f = emptyInput(this.aim);
    for (let guard = 0; guard < 8 && this.tasks.length; guard++) {
      const task = this.tasks[0]!;
      const finished = task(sim, f, this);
      this.t++;
      if (!finished) break;
      this.tasks.shift();
      this.t = 0;
      if (f.fire || f.pulse || f.recall || f.recallAll || f.dash || f.selIndex >= 0) break; // one action per tick
    }
    f.aim = { ...this.aim };
    return f;
  }
}

export const dist = (a: Vec, b: Vec): number => dhypot(a.x - b.x, a.y - b.y);

export function steer(sim: Sim, f: InputFrame, target: Vec, tol = 2.5): boolean {
  const p = sim.player.pos;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const d = dhypot(dx, dy);
  if (d <= tol) return true;
  const k = d < 6 ? d / 6 : 1;
  f.move = { x: (dx / d) * k, y: (dy / d) * k };
  return false;
}

export const moveTo = (target: Vec, tol = 2.5, maxTicks = 900): Task => (sim, f, bot) => steer(sim, f, target, tol) || bot.t > maxTicks;

export const wait = (ticks: number): Task => (_s, _f, bot) => bot.t >= ticks;

export const until = (pred: (sim: Sim) => boolean, maxTicks = 3600): Task => (sim, _f, bot) => pred(sim) || bot.t > maxTicks;

export const aimAt = (target: Vec): Task => (_s, _f, bot) => {
  bot.aim = { ...target };
  return true;
};

/** Select a needle, aim, fire, and wait until it has settled. */
export function throwAt(id: NeedleId, target: Vec): Task {
  let fired = false;
  return (sim, f, bot) => {
    const idx = ['A', 'B', 'C'].indexOf(id);
    const n = sim.needle(id);
    bot.aim = { ...target };
    if (!fired) {
      if (n.state !== 'Held') {
        if (n.state === 'Returning' || n.state === 'Flying') return false;
        f.recall = true; // bring it back first
        f.selIndex = idx;
        return false;
      }
      if (sim.player.selected !== idx) {
        f.selIndex = idx;
        return false;
      }
      if (sim.player.fireCd > 0) return false;
      f.fire = true;
      fired = true;
      return false;
    }
    if (n.state === 'Flying') return false;
    return true;
  };
}

/** Press E aiming at a world point and wait until the pulse is resolved. */
export function pulseAt(target: Vec): Task {
  let pressed = false;
  return (sim, f, bot) => {
    bot.aim = { ...target };
    if (!pressed) {
      if (sim.player.pulseCd > 0 || sim.pendingPulse) return false;
      f.pulse = true;
      pressed = true;
      return false;
    }
    return !sim.pendingPulse && !sim.pulses.some((q) => !q.done && !q.delivered);
  };
}

export const recallAll = (): Task => {
  let sent = false;
  return (sim, f) => {
    if (!sent) {
      f.recallAll = true;
      sent = true;
      return false;
    }
    return sim.needles.every((n) => n.state === 'Held');
  };
};

export const embedded = (sim: Sim, id: NeedleId): boolean => isEmbedded(sim.needle(id));
export const hostOf = (sim: Sim, id: NeedleId): string | null => sim.needle(id).host?.shapeId ?? null;

/** Run a task only when the predicate holds (re-evaluated each tick), otherwise idle. */
export const when = (pred: (sim: Sim) => boolean, task: Task): Task => (sim, f, bot) => (pred(sim) ? task(sim, f, bot) : false);
