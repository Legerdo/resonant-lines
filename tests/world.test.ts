// World traversal: every door of the hub and the four regions is reachable on foot, and every region resonance gate
// is solvable with the environment's own emitter (input-only bots over the authoritative sim).
import { describe, it, expect } from 'vitest';
import { Sim } from '../src/core/sim/sim.ts';
import { areaById } from '../src/world/areas/index.ts';
import { MechanismLogic } from '../src/world/interactables/mechanisms.ts';
import { NavBot, GateBot } from '../src/debug/bots/navBot.ts';
import type { AnyBot } from '../src/debug/bots/index.ts';
import type { SimEvent } from '../src/core/sim/types.ts';
import { checkNeedleInvariant } from './helpers.ts';

const STORY_FLAGS = ['tutorialDone', 'region:garden', 'region:belfry', 'region:quarry', 'region:marsh'];

function region(area: string, spawn: string, extra: string[] = []): Sim {
  return new Sim({ area: areaById(area)!, seed: 7, flags: new Set([...STORY_FLAGS, ...extra]), spawn, boss: null, logic: new MechanismLogic() });
}

/** run a bot until it finishes or an `exit` event fires; returns the exit target (`area|spawn`) if any */
function drive(sim: Sim, bot: AnyBot, maxTicks = 60 * 90): { exit: string | null; events: SimEvent[]; ticks: number } {
  const events: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const ev = sim.step(bot.next(sim));
    checkNeedleInvariant(sim);
    events.push(...ev.filter((e) => e.type === 'exit' || e.type === 'doorOpened' || e.type === 'exitLocked'));
    const exit = ev.find((e) => e.type === 'exit');
    if (exit) return { exit: exit.text ?? '', events, ticks: i };
    if (bot.done) return { exit: null, events, ticks: i };
  }
  return { exit: null, events, ticks: maxTicks };
}

describe('world traversal (on foot, no teleports)', () => {
  const hubExits: [string, string][] = [['toGarden', 'garden'], ['toMarsh', 'marsh'], ['toBelfry', 'belfry'], ['toQuarry', 'quarry']];
  for (const [id, to] of hubExits) {
    it(`hub -> ${to}`, () => {
      const sim = region('hub', 'center');
      const r = drive(sim, new NavBot({ kind: 'exit', id }));
      expect(r.exit).toBe(`${to}|fromHub`);
    });
  }

  it('hub tutorial door keeps the antechamber sealed until the device is solved', () => {
    const sim = new Sim({ area: areaById('hub')!, seed: 7, flags: new Set(), spawn: 'default', boss: null, logic: new MechanismLogic() });
    const bot = new NavBot({ kind: 'exit', id: 'toQuarry' });
    const r = drive(sim, bot, 60 * 20);
    expect(r.exit).toBeNull();
    expect((bot as NavBot).failed).toBe(true);
  });

  it('heart door is sealed before the final gate and open after it', () => {
    const locked = region('hub', 'center');
    expect(drive(locked, new NavBot({ kind: 'exit', id: 'toHeart' }), 60 * 20).exit).toBeNull();
    const open = region('hub', 'center', ['finalGate']);
    expect(drive(open, new NavBot({ kind: 'exit', id: 'toHeart' })).exit).toBe('arena_FINAL|default');
  });

  const regions: { area: string; free: [string, string]; gated: [string, string]; flag: string }[] = [
    { area: 'quarry', free: ['toB01', 'arena_B01'], gated: ['toB06', 'arena_B06'], flag: 'puzzle:quarry' },
    { area: 'garden', free: ['toB04', 'arena_B04'], gated: ['toB07', 'arena_B07'], flag: 'puzzle:garden' },
    { area: 'belfry', free: ['toB02', 'arena_B02'], gated: ['toB08', 'arena_B08'], flag: 'puzzle:belfry' },
    { area: 'marsh', free: ['toB03', 'arena_B03'], gated: ['toB05', 'arena_B05'], flag: 'puzzle:marsh' },
  ];
  for (const r of regions) {
    it(`${r.area}: first boss door, back to the hub`, () => {
      expect(drive(region(r.area, 'fromHub'), new NavBot({ kind: 'exit', id: r.free[0] })).exit).toBe(`${r.free[1]}|default`);
      expect(drive(region(r.area, `from${r.free[0].slice(2)}`), new NavBot({ kind: 'exit', id: 'toHub' })).exit).toMatch(/^hub\|from/);
    });
    it(`${r.area}: gate is sealed, the resonance puzzle opens it, then the second boss door`, () => {
      const sealed = new NavBot({ kind: 'exit', id: r.gated[0] });
      expect(drive(region(r.area, 'fromHub'), sealed, 60 * 25).exit).toBeNull();
      expect(sealed.failed).toBe(true);
      const sim = region(r.area, 'fromHub');
      const solver = new GateBot();
      const s = drive(sim, solver, 60 * 60);
      expect(solver.failed, solver.log.join(' / ')).toBe(false);
      expect(sim.flags.has(r.flag)).toBe(true);
      expect(s.events.some((e) => e.type === 'doorOpened' && e.text === r.flag)).toBe(true);
      expect(sim.log.some((l) => /pulse A->B/.test(l))).toBe(true);
      expect(drive(sim, new NavBot({ kind: 'exit', id: r.gated[0] })).exit).toBe(`${r.gated[1]}|default`);
      // a solved gate stays open when the region is rebuilt from save flags
      expect(drive(region(r.area, 'fromHub', [r.flag]), new NavBot({ kind: 'exit', id: r.gated[0] })).exit).toBe(`${r.gated[1]}|default`);
    });
  }

  it('records stele and tuning altar are reachable in the hub', () => {
    for (const id of ['records', 'altar']) {
      const sim = region('hub', 'center');
      const bot = new NavBot({ kind: 'interact', id });
      drive(sim, bot, 60 * 20);
      expect(bot.failed, bot.log.join()).toBe(false);
      expect(bot.done).toBe(true);
    }
  });
});
