// World navigation for QA bots: BFS over an 8px grid of positions where the player circle fits (same collision as
// the sim), then walk the path with ordinary move input. Also a generic solver for the region resonance gates.
import { emptyInput, type InputFrame } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import type { Vec } from '../../core/math/vec.ts';
import { resolveCircle } from '../../core/sim/bodies.ts';
import { areaSize } from '../../world/buildArea.ts';
import type { Rect } from '../../world/areaTypes.ts';
import { isEmbedded } from '../../resonance/needle.ts';
import { clearShot, shapePos } from './botKit.ts';
import type { AnyBot } from './index.ts';
import { dhypot } from '../../core/math/dmath.ts';

const CELL = 8;
const CLEAR = 6.5; // player radius 5 + margin

export function fits(sim: Sim, p: Vec): boolean {
  const q = resolveCircle(sim.bodies, p, CLEAR, 2);
  return Math.abs(q.x - p.x) < 0.01 && Math.abs(q.y - p.y) < 0.01;
}

const inRect = (p: Vec, r: Rect, m = 0): boolean => p.x > r.x - m && p.x < r.x + r.w + m && p.y > r.y - m && p.y < r.y + r.h + m;

/** BFS from `from` to any cell accepted by `goal`; returns cell-centre waypoints (collinear points removed). */
export function findPath(sim: Sim, from: Vec, goal: (p: Vec) => boolean): Vec[] | null {
  const { w, h } = areaSize(sim.area);
  const cols = Math.ceil(w / CELL);
  const rows = Math.ceil(h / CELL);
  const ok = new Int8Array(cols * rows).fill(-1);
  const center = (i: number): Vec => ({ x: (i % cols) * CELL + CELL / 2, y: Math.floor(i / cols) * CELL + CELL / 2 });
  const free = (i: number): boolean => {
    if (ok[i] === -1) ok[i] = fits(sim, center(i)) ? 1 : 0;
    return ok[i] === 1;
  };
  const sx = Math.min(cols - 1, Math.max(0, Math.floor(from.x / CELL)));
  const sy = Math.min(rows - 1, Math.max(0, Math.floor(from.y / CELL)));
  const start = sy * cols + sx;
  const prev = new Int32Array(cols * rows).fill(-2);
  prev[start] = -1;
  const queue = [start];
  let found = -1;
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi]!;
    if (i !== start && goal(center(i))) {
      found = i;
      break;
    }
    const x = i % cols;
    const y = Math.floor(i / cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (prev[j] !== -2 || !free(j)) continue;
      // no corner cutting on diagonals
      if (dx !== 0 && dy !== 0 && (!free(y * cols + nx) || !free(ny * cols + x))) continue;
      prev[j] = i;
      queue.push(j);
    }
  }
  if (found < 0) return null;
  const cells: number[] = [];
  for (let i = found; i !== -1; i = prev[i]!) cells.push(i);
  cells.reverse();
  cells.shift(); // the start cell may itself be too close to a wall (e.g. pressed against a sealed door)
  const pts = cells.map(center);
  const out: Vec[] = [];
  for (let k = 0; k < pts.length; k++) {
    const a = out[out.length - 1];
    const b = pts[k]!;
    const c = pts[k + 1];
    if (a && c && Math.sign(b.x - a.x) === Math.sign(c.x - b.x) && Math.sign(b.y - a.y) === Math.sign(c.y - b.y) && (b.x - a.x) * (c.y - b.y) === (b.y - a.y) * (c.x - b.x)) continue;
    out.push(b);
  }
  return out;
}

export type NavTarget = { kind: 'exit'; id: string } | { kind: 'interact'; id: string } | { kind: 'point'; p: Vec };

/** Walks to an exit (until the area changes), an interactable (until inside its radius) or a point. */
export class NavBot implements AnyBot {
  name: string;
  log: string[] = [];
  private path: Vec[] | null = null;
  private idx = 0;
  private area = '';
  private finished = false;
  private lastPos: Vec = { x: NaN, y: NaN };
  private still = 0;
  private replans = 0;
  private push: Vec | null = null;
  private readonly target: NavTarget;
  failed = false;

  constructor(target: NavTarget) {
    this.target = target;
    this.name = `go:${target.kind === 'point' ? `${target.p.x},${target.p.y}` : target.id}`;
  }

  get done(): boolean {
    return this.finished;
  }

  private fail(why: string): void {
    this.failed = true;
    this.finished = true;
    this.log.push(`fail: ${why}`);
  }

  private plan(sim: Sim): void {
    const t = this.target;
    this.push = null;
    if (t.kind === 'exit') {
      const ex = sim.area.exits.find((e) => e.id === t.id);
      if (!ex) return this.fail(`no exit ${t.id} in ${sim.area.id}`);
      this.path = findPath(sim, sim.player.pos, (p) => inRect(p, ex.rect, 4));
      this.push = { x: ex.rect.x + ex.rect.w / 2, y: ex.rect.y + ex.rect.h / 2 };
    } else if (t.kind === 'interact') {
      const it = sim.area.interactables.find((e) => e.id === t.id);
      if (!it) return this.fail(`no interactable ${t.id}`);
      this.path = findPath(sim, sim.player.pos, (p) => dhypot(p.x - it.pos.x, p.y - it.pos.y) < it.r - 6);
    } else {
      const g = t.p;
      this.path = findPath(sim, sim.player.pos, (p) => dhypot(p.x - g.x, p.y - g.y) < CELL);
    }
    this.idx = 0;
    if (!this.path) this.fail(`no path in ${sim.area.id} to ${this.name}`);
  }

  next(sim: Sim): InputFrame {
    const f = emptyInput(sim.player.aim);
    if (this.finished) return f;
    if (!this.area) this.area = sim.area.id;
    if (sim.area.id !== this.area) {
      this.finished = true;
      return f;
    }
    const t = this.target;
    if (t.kind === 'interact') {
      const it = sim.area.interactables.find((e) => e.id === t.id);
      if (it && dhypot(sim.player.pos.x - it.pos.x, sim.player.pos.y - it.pos.y) < it.r - 4) {
        this.finished = true;
        return f;
      }
    }
    if (!this.path) this.plan(sim);
    if (!this.path) return f;
    // stuck (pushed by something dynamic): replan a few times, then report failure
    const here = sim.player.pos;
    if (!Number.isFinite(this.lastPos.x) || dhypot(here.x - this.lastPos.x, here.y - this.lastPos.y) > 0.4) {
      this.lastPos = { ...here };
      this.still = 0;
    } else if (++this.still > 60) {
      this.still = 0;
      if (++this.replans > 3) {
        this.fail(`stuck at ${here.x.toFixed(0)},${here.y.toFixed(0)}`);
        return f;
      }
      this.path = null;
      return f;
    }
    let goal = this.path[this.idx];
    if (goal && dhypot(goal.x - here.x, goal.y - here.y) < 3) {
      this.idx++;
      goal = this.path[this.idx];
    }
    if (!goal) {
      if (t.kind === 'exit' && this.push) goal = this.push; // lean into the exit until the area changes
      else {
        this.finished = true;
        return f;
      }
    }
    const dx = goal.x - here.x;
    const dy = goal.y - here.y;
    const d = dhypot(dx, dy) || 1;
    f.move = { x: dx / d, y: dy / d };
    return f;
  }
}

/**
 * Solves the first unsolved resonance gate of the current region exactly as a player would: needle A on the region's
 * anchor post, needle B in the gate socket, wait for the environmental emitter to charge A-B with the gate's
 * signature, then pulse aimed at B (energy flows A->B, into the socket).
 */
export class GateBot implements AnyBot {
  name = 'solve';
  log: string[] = [];
  private placer = { aim: { x: 0, y: 0 } as Vec };
  private step: 'place' | 'charge' | 'pulse' | 'resolve' | 'recall' | 'done' = 'place';
  private t = 0;
  private flag = '';
  private route: Vec[] | null = null;
  private routeFor = '';
  private routeIdx = 0;
  private fireCd = 0;
  failed = false;

  get done(): boolean {
    return this.step === 'done';
  }

  private go(s: GateBot['step']): void {
    this.step = s;
    this.t = 0;
    this.log.push(s);
  }

  /** walk (pathfinding) to the nearest reachable spot with a clear shot, then throw; true once embedded there */
  private place(sim: Sim, f: InputFrame, id: 'A' | 'B', shapeId: string): boolean {
    const n = sim.needle(id);
    const idx = id === 'A' ? 0 : 1;
    if (isEmbedded(n) && n.host?.shapeId === shapeId) return true;
    if (n.state === 'Flying' || n.state === 'Returning') return false;
    if (n.state !== 'Held') {
      if (sim.player.selected !== idx) f.selIndex = idx;
      else f.recall = true;
      return false;
    }
    const target = shapePos(sim, shapeId);
    if (!target) return false;
    this.placer.aim = { ...target };
    const me = sim.player.pos;
    if (clearShot(sim, me, target, shapeId)) {
      this.route = null;
      if (sim.player.selected !== idx) f.selIndex = idx;
      else if (--this.fireCd <= 0 && sim.player.fireCd <= 0) {
        f.fire = true;
        this.fireCd = 10;
      }
      return false;
    }
    if (!this.route || this.routeFor !== `${id}:${shapeId}`) {
      this.routeFor = `${id}:${shapeId}`;
      this.route = findPath(sim, me, (p) => clearShot(sim, p, target, shapeId));
      this.routeIdx = 0;
      if (!this.route) {
        this.log.push(`no throwing spot for ${id} -> ${shapeId}`);
        this.failed = true;
        this.go('done');
        return false;
      }
    }
    let wp = this.route[this.routeIdx];
    if (wp && dhypot(wp.x - me.x, wp.y - me.y) < (this.routeIdx === this.route.length - 1 ? 1 : 3)) wp = this.route[++this.routeIdx];
    if (!wp) {
      this.route = null; // arrived but the exact position is not clear: search again from here
      return false;
    }
    const dx = wp.x - me.x;
    const dy = wp.y - me.y;
    const d = dhypot(dx, dy) || 1;
    const k = d < 4 ? Math.max(0.25, d / 4) : 1;
    f.move = { x: (dx / d) * k, y: (dy / d) * k };
    return false;
  }

  next(sim: Sim): InputFrame {
    const f = emptyInput(this.placer.aim);
    this.t++;
    const gate = (sim.area.mechs ?? []).find((m) => m.kind === 'barrier' && (m.flag === this.flag || !sim.flags.has(m.flag)));
    if (!gate || gate.kind !== 'barrier') {
      if (this.step !== 'recall' && this.step !== 'done') this.go('recall');
    } else this.flag = gate.flag;
    const socket = gate ? `mech:${gate.id}:socket` : '';
    const ab = sim.link('AB');
    const charged = ab.valid && (ab.state === 'Charged' || ab.state === 'Overloaded') && ab.sig === gate?.sig && (gate?.kind !== 'barrier' || gate.tone === undefined || ab.tone === gate.tone);
    switch (this.step) {
      case 'place': {
        if (!this.place(sim, f, 'A', 'p:post')) break;
        if (!this.place(sim, f, 'B', socket)) break;
        this.go('charge');
        break;
      }
      case 'charge':
        if (!isEmbedded(sim.needle('A')) || !isEmbedded(sim.needle('B'))) this.go('place');
        else if (charged) this.go('pulse');
        else if (this.t > 60 * 20) {
          this.log.push(`never charged: AB ${ab.valid ? 'valid' : `blocked=${ab.blocked}`} ${ab.state} ${ab.sig ?? ''} len=${ab.length.toFixed(0)}`);
          this.failed = true;
          this.go('done');
        }
        break;
      case 'pulse': {
        const b = sim.needle('B').pos;
        this.placer.aim = { ...b };
        f.aim = { ...b };
        if (!charged) this.go('charge');
        else if (sim.player.pulseCd <= 0 && !sim.pendingPulse) {
          f.pulse = true;
          this.go('resolve');
        }
        break;
      }
      case 'resolve':
        f.aim = { ...sim.needle('B').pos };
        if (sim.flags.has(this.flag)) this.go('recall');
        else if (this.t > 60 && !sim.pendingPulse && sim.pulses.length === 0) this.go('charge');
        break;
      case 'recall':
        if (sim.needles.every((n) => n.state === 'Held')) this.go('done');
        else if (this.t % 20 === 1) f.recallAll = true;
        break;
      case 'done':
        break;
    }
    return f;
  }
}
