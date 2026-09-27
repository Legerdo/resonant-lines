// Minimal boss used to test framework rules (seals, direction, tie resolution) independent of real boss content.
import { makeBody, circle } from '../../src/core/sim/bodies.ts';
import type { DeliveryInfo, PulseResult } from '../../src/core/sim/types.ts';
import type { Sim } from '../../src/core/sim/sim.ts';
import { type BossController, makeSeals, newView } from '../../src/bosses/framework/boss.ts';

export class TestBoss implements BossController {
  readonly id = 'test';
  phase = 'idle';
  seals = makeSeals([{ id: 'S1', glyph: 0 }], 'test');
  coreExposed = false;
  defeated = false;
  view = newView();
  delivered: string[] = [];
  /** scripted hook for tie tests */
  onTick: ((sim: Sim) => void) | null = null;

  setup(sim: Sim): void {
    // two anchorable stones inside the sandbox: stoneL (left) and stoneR (right)
    sim.addBody(
      makeBody('stones', 'mechanism', { x: 0, y: 0 }, [
        circle('stoneL', { x: 120, y: 140 }, 6, 'Anchorable', { receiver: 'stoneL' }),
        circle('stoneR', { x: 264, y: 140 }, 6, 'Anchorable', { receiver: 'stoneR' }),
      ]),
    );
  }

  update(sim: Sim): void {
    this.onTick?.(sim);
  }

  onPulseDelivered(sim: Sim, d: DeliveryInfo): PulseResult | undefined {
    this.delivered.push(`${d.receiver ?? d.shapeId}:${d.pulse.sig}`);
    if (d.receiver === 'stoneR') {
      if (d.pulse.sig !== 'Impact') return 'fail';
      return sim.breakSeal('S1', `p${d.pulse.id}`, d.pos) ? 'success' : 'none';
    }
    if (d.receiver === 'stoneL' && this.coreExposed && d.pulse.sig === 'Impact') {
      sim.requestVictory(d.t, d.pos);
      return 'success';
    }
    return undefined;
  }

  debugInfo() {
    return { phase: this.phase };
  }
}
