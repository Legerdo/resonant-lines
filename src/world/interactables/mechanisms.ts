// Non-combat resonance mechanisms: harmless emitters + barriers that open when the right energy is delivered
// into their socket. Used by the hub tutorial device and the region puzzles.
import { DT } from '../../core/clock/fixedStep.ts';
import { makeBody, seg, circle } from '../../core/sim/bodies.ts';
import type { DeliveryInfo, PulseResult } from '../../core/sim/types.ts';
import type { AreaLogic, Sim } from '../../core/sim/sim.ts';
import type { MechDef } from '../areaTypes.ts';

export class MechanismLogic implements AreaLogic {
  view: Record<string, number> = {};
  private timers = new Map<string, number>();
  private mechs: MechDef[] = [];

  setup(sim: Sim): void {
    this.mechs = sim.area.mechs ?? [];
    for (const m of this.mechs) {
      if (m.kind === 'barrier') {
        const open = sim.flags.has(m.flag);
        this.view[m.id] = open ? 1 : 0;
        if (open) continue;
        const r = m.rect;
        const pts = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
        const ns = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
        const shapes = [0, 1, 2, 3].map((i) => seg(`mech:${m.id}:${i}`, pts[i]!, pts[(i + 1) % 4]!, ns[i]!, 'NonAnchorable'));
        sim.addBody(makeBody(`mech:${m.id}`, 'mechanism', { x: 0, y: 0 }, [
          ...shapes,
          circle(`mech:${m.id}:socket`, { ...m.socket }, 6, 'Anchorable', { receiver: m.id, blocksMove: false }),
        ]));
      } else {
        this.timers.set(m.id, m.period * 0.4);
        this.view[m.id] = 0;
      }
    }
  }

  update(sim: Sim): void {
    for (const m of this.mechs) {
      if (m.kind !== 'emitter') continue;
      if (m.unlessFlag && sim.flags.has(m.unlessFlag)) continue;
      let t = (this.timers.get(m.id) ?? 0) - DT;
      this.view[m.id] = t < 0.5 ? 1 : 0;
      if (t <= 0) {
        t = m.period;
        const base = { owner: `mech:${m.id}`, sig: m.sig, tone: m.tone ?? -1, capturable: true, harmful: false };
        if (m.shape === 'ring') sim.spawnAttack({ ...base, kind: 'ring', p: { x: m.pos.x, y: m.pos.y, r: 6, speed: 70, rMax: m.range, th: 6, tele: 0.4 } });
        else if (m.shape === 'drop') sim.spawnAttack({ ...base, kind: 'zone', p: { x: m.pos.x, y: m.pos.y, r: 11, tele: 0.9, active: 0.18, rock: 1 } });
        else sim.spawnAttack({ ...base, kind: 'beam', continuous: true, p: { x: m.pos.x, y: m.pos.y, ang: m.angle ?? 0, len: m.range, w: 3, spin: 0, tele: 0.5, active: 1.0 } });
      }
      this.timers.set(m.id, t);
    }
  }

  onPulseDelivered(sim: Sim, d: DeliveryInfo): PulseResult | undefined {
    const m = this.mechs.find((x) => x.kind === 'barrier' && x.id === d.receiver);
    if (!m || m.kind !== 'barrier') return undefined;
    if (sim.flags.has(m.flag)) return 'none';
    if (d.pulse.sig !== m.sig || (m.tone !== undefined && d.pulse.tone !== m.tone)) {
      sim.emit({ type: 'sealRejected', id: m.id, pos: d.pos, text: 'signature' });
      return 'fail';
    }
    sim.flags.add(m.flag);
    const b = sim.body(`mech:${m.id}`);
    if (b) b.enabled = false;
    this.view[m.id] = 1;
    sim.record(`open ${m.id}`);
    sim.emit({ type: 'doorOpened', id: m.id, text: m.flag, pos: d.pos });
    sim.emit({ type: 'shake', value: 3 });
    return 'success';
  }
}
