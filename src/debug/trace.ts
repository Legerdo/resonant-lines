// Per-tick state fingerprint (debug): used to compare browser and headless runs of the same inputs.
import type { Sim } from '../core/sim/sim.ts';
import type { InputFrame } from '../core/sim/types.ts';

const n = (v: number): string => String(v);

export function traceLine(sim: Sim, input: InputFrame): string {
  const p = sim.player;
  const parts = [
    sim.tick,
    `in:${n(input.move.x)},${n(input.move.y)},${n(input.aim.x)},${n(input.aim.y)},${+input.fire}${+input.recall}${+input.recallAll}${+input.pulse}${+input.dash}${input.selIndex}`,
    `p:${n(p.pos.x)},${n(p.pos.y)},${p.shield}`,
    `n:${sim.needles.map((x) => `${x.state[0]}${n(x.pos.x)},${n(x.pos.y)}`).join(';')}`,
    `b:${sim.bodies.map((b) => `${b.enabled ? 1 : 0}${n(b.pos.x)},${n(b.pos.y)},${n(b.angle)}`).join(';')}`,
    `a:${sim.attacks.map((a) => `${a.id}${a.phase[0]}`).join(',')}`,
    `r:${sim.rng.state}`,
  ];
  return parts.join('|');
}
