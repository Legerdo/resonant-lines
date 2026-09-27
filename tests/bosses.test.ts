import { describe, expect, it } from 'vitest';
import { Sim } from '../src/core/sim/sim.ts';
import { areaById } from '../src/world/areas/index.ts';
import { bossEntry, BOSS_ENTRIES, isBossImplemented } from '../src/bosses/registry.ts';
import { BOTS } from '../src/debug/bots/index.ts';
import type { DeliveryInfo, Pulse } from '../src/core/sim/types.ts';
import { GramBoss } from '../src/bosses/definitions/b01Gram.ts';

export function runBoss(id: string, opts: { invulnerable?: boolean; maxSeconds?: number; tunings?: string[] } = {}) {
  const e = bossEntry(id)!;
  const sim = new Sim({ area: areaById(e.areaId)!, seed: 0x5eed + id.charCodeAt(1), boss: e.create(), invulnerable: opts.invulnerable ?? false, tunings: (opts.tunings ?? []) as never });
  const bot = BOTS[id]!();
  const max = (opts.maxSeconds ?? 300) * 60;
  for (let i = 0; i < max; i++) {
    sim.step(bot.next(sim));
    const r = sim.fight?.result;
    if (r === 'victory' || r === 'defeat') break;
  }
  return sim;
}

const implemented = BOSS_ENTRIES.filter((b) => isBossImplemented(b.id) && areaById(b.areaId) && BOTS[b.id]);

describe('A16 every implemented boss is clearable with zero tunings (input-only bots)', () => {
  for (const b of implemented) {
    it(`${b.id} ${b.nameKey}`, () => {
      const sim = runBoss(b.id);
      expect(sim.tunings.length).toBe(0);
      expect(sim.fight!.result, `log tail: ${sim.log.slice(-12).join(' | ')}`).toBe('victory');
      expect(sim.boss!.seals.every((s) => s.broken || s.optional)).toBe(true);
    });
  }
});

describe('A15 boss determinism', () => {
  for (const b of implemented) {
    it(`${b.id} same seed + inputs => same transitions`, () => {
      const a = runBoss(b.id, { invulnerable: true, maxSeconds: 60 });
      const c = runBoss(b.id, { invulnerable: true, maxSeconds: 60 });
      expect(c.log).toEqual(a.log);
    });
  }
});

function fakeDelivery(sim: Sim, receiver: string, dir: { x: number; y: number }, sig: Pulse['sig'] = 'Impact'): DeliveryInfo {
  const pulse = { id: sim.nextId(), dir, sig, tone: -1, power: 1 } as unknown as Pulse;
  return { pulse, needle: sim.needle('A'), bodyId: 'world', shapeId: `p:${receiver}`, receiver, t: 0.5, pos: { x: 0, y: 0 } };
}

describe('B01 rules', () => {
  function fresh() {
    const boss = new GramBoss();
    const sim = new Sim({ area: areaById('arena_B01')!, seed: 1, boss });
    for (let i = 0; i < 80; i++) sim.step({ move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, recall: false, recallAll: false, selNext: false, selPrev: false, selIndex: -1, pulse: false, dash: false });
    return { sim, boss };
  }
  it('seal faces: energy must arrive through the carved face', () => {
    const { sim, boss } = fresh();
    // sealW faces east: a pulse travelling east (from the west) is rejected, travelling west is accepted
    expect(boss.onPulseDelivered(sim, fakeDelivery(sim, 'sealW', { x: 1, y: 0 }))).toBe('fail');
    expect(boss.seals[1]!.broken).toBe(false);
    expect(boss.onPulseDelivered(sim, fakeDelivery(sim, 'sealW', { x: -1, y: 0 }))).toBe('success');
    expect(boss.seals[1]!.broken).toBe(true);
  });
  it('wrong signature never breaks a seal (A07)', () => {
    const { sim, boss } = fresh();
    expect(boss.onPulseDelivered(sim, fakeDelivery(sim, 'sealN', { x: 0, y: -1 }, 'Wave'))).toBe('fail');
    expect(boss.seals[0]!.broken).toBe(false);
  });
  it('core only converges while pinned; unpinned core hits merely stagger', () => {
    const { sim, boss } = fresh();
    for (const s of ['sealN', 'sealW', 'sealE']) boss.onPulseDelivered(sim, fakeDelivery(sim, s, s === 'sealN' ? { x: 0, y: -1 } : s === 'sealW' ? { x: -1, y: 0 } : { x: 0, y: 1 }));
    expect(boss.coreExposed).toBe(true);
    expect(boss.onPulseDelivered(sim, fakeDelivery(sim, 'core', { x: 1, y: 0 }))).toBe('success');
    expect(sim.pendingVictory).toBeNull();
    expect(boss.state).toBe('crash');
  });
  it('death -> retry builds a clean arena (A14)', () => {
    const played = runBoss('B01', { maxSeconds: 8 });
    const e = bossEntry('B01')!;
    const retry = new Sim({ area: areaById(e.areaId)!, seed: 0x5eed + 48, boss: e.create() });
    expect(played.tick).toBeGreaterThan(0);
    expect(retry.boss!.seals.every((s) => !s.broken)).toBe(true);
    expect(retry.attacks.length).toBe(0);
    expect(retry.needles.every((n) => n.state === 'Held')).toBe(true);
    expect(retry.player.shield).toBe(2);
  });
});
