import { emptyInput, type InputFrame, type NeedleId } from '../src/core/sim/types.ts';
import type { Sim } from '../src/core/sim/sim.ts';
import type { Vec } from '../src/core/math/vec.ts';

export function input(sim: Sim, over: Partial<InputFrame> = {}): InputFrame {
  return { ...emptyInput(sim.player.aim), ...over };
}

export function stepN(sim: Sim, n: number, over: Partial<InputFrame> = {}): void {
  for (let i = 0; i < n; i++) sim.step(input(sim, over));
}

export function waitUntil(sim: Sim, pred: () => boolean, max = 600, over: Partial<InputFrame> = {}): number {
  for (let i = 0; i < max; i++) {
    if (pred()) return i;
    sim.step(input(sim, over));
  }
  if (pred()) return max;
  throw new Error(`condition not reached in ${max} ticks (tick ${sim.tick})`);
}

/** Fire a specific needle toward a world point and wait until it settles. */
export function throwNeedle(sim: Sim, id: NeedleId, target: Vec): void {
  const idx = ['A', 'B', 'C'].indexOf(id);
  sim.step(input(sim, { selIndex: idx, aim: target }));
  sim.step(input(sim, { fire: true, aim: target }));
  const n = sim.needle(id);
  waitUntil(sim, () => n.state !== 'Flying', 300, { aim: target });
}

export function checkNeedleInvariant(sim: Sim): void {
  const ids = sim.needles.map((n) => n.id).join('');
  if (ids !== 'ABC' || sim.needles.length !== 3) throw new Error(`needle invariant broken: ${ids}`);
  for (const n of sim.needles) {
    if (!Number.isFinite(n.pos.x) || !Number.isFinite(n.pos.y)) throw new Error(`NaN needle ${n.id}`);
    if (n.state.startsWith('Embedded') && !n.host) throw new Error(`embedded without host ${n.id}`);
  }
  for (const l of sim.links) {
    if (!l.valid) continue;
    const a = sim.needle(l.a);
    const b = sim.needle(l.b);
    const ok = (x: typeof a) => x.state === 'EmbeddedWorld' || x.state === 'EmbeddedBoss';
    if (!ok(a) || !ok(b)) throw new Error(`orphan link ${l.id}`);
  }
}
