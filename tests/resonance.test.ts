import { describe, expect, it } from 'vitest';
import { Sim } from '../src/core/sim/sim.ts';
import { SANDBOX } from '../src/world/areas/sandbox.ts';
import { FixedStepClock } from '../src/core/clock/fixedStep.ts';
import { makeBody, circle } from '../src/core/sim/bodies.ts';
import type { AreaLogic } from '../src/core/sim/sim.ts';
import { input, stepN, throwNeedle, waitUntil, checkNeedleInvariant } from './helpers.ts';
import { TestBoss } from './fixtures/testBoss.ts';

const sandbox = (extra: Partial<ConstructorParameters<typeof Sim>[0]> = {}) => new Sim({ area: SANDBOX, seed: 7, ...extra });

function startFight(sim: Sim): void {
  waitUntil(sim, () => sim.fight?.result === 'ongoing', 200);
}

function chargeLinkAt(sim: Sim, x: number, y: number, sig: 'Impact' | 'Wave' = 'Impact') {
  sim.spawnAttack({ kind: 'zone', owner: 'test', sig, capturable: true, harmful: false, p: { x, y, r: 8, tele: 0, active: 0.1 } });
  stepN(sim, 2);
}

describe('A01 needle ownership', () => {
  it('fire/recall/death/reset 100 cycles never exceeds three needles', () => {
    let sim = sandbox();
    const targets = [{ x: 130, y: 0 }, { x: 0, y: 96 }, { x: 384, y: 96 }];
    for (let cycle = 0; cycle < 100; cycle++) {
      for (let i = 0; i < 3; i++) {
        sim.step(input(sim, { selIndex: i, aim: targets[i]! }));
        sim.step(input(sim, { fire: true, aim: targets[i]! }));
        stepN(sim, 8);
        checkNeedleInvariant(sim);
      }
      // extra fire attempts with nothing in hand must not create needles
      stepN(sim, 3, { fire: true });
      checkNeedleInvariant(sim);
      if (cycle % 3 === 0) sim.step(input(sim, { recall: true, selIndex: cycle % 3 }));
      sim.step(input(sim, { recallAll: true }));
      waitUntil(sim, () => sim.needles.every((n) => n.state === 'Held'), 400);
      checkNeedleInvariant(sim);
      if (cycle % 10 === 9) sim = sandbox(); // reset == new Sim
    }
    expect(sim.needles.map((n) => n.id)).toEqual(['A', 'B', 'C']);
  });
});

describe('A02-A04 link lifecycle, distance and line of sight', () => {
  it('forms AB when both are embedded within range and drops it on recall', () => {
    const sim = sandbox();
    throwNeedle(sim, 'A', { x: 128, y: 20 });
    throwNeedle(sim, 'B', { x: 0, y: 96 });
    expect(sim.needle('A').state).toBe('EmbeddedWorld');
    expect(sim.needle('B').state).toBe('EmbeddedWorld');
    stepN(sim, 1);
    expect(sim.link('AB').valid).toBe(true);
    expect(sim.link('BC').valid).toBe(false);
    sim.step(input(sim, { selIndex: 0 }));
    sim.step(input(sim, { recall: true }));
    stepN(sim, 1);
    expect(sim.link('AB').valid).toBe(false);
    checkNeedleInvariant(sim);
  });

  it('refuses links beyond maxLinkDistance', () => {
    const sim = sandbox();
    throwNeedle(sim, 'A', { x: 128, y: 20 });
    throwNeedle(sim, 'C', { x: 384, y: 96 });
    stepN(sim, 1);
    const l = sim.link('CA');
    expect(l.length).toBeGreaterThan(sim.mods.maxLinkDistance);
    expect(l.valid).toBe(false);
    expect(l.blocked).toBe('distance');
  });

  it('refuses links through a blocking wall', () => {
    const sim = sandbox();
    sim.player.pos = { x: 150, y: 150 };
    throwNeedle(sim, 'A', { x: 145, y: 0 });
    sim.player.pos = { x: 250, y: 150 };
    throwNeedle(sim, 'B', { x: 265, y: 200 });
    stepN(sim, 1);
    const l = sim.link('AB');
    expect(sim.needle('A').state).toBe('EmbeddedWorld');
    expect(sim.needle('B').state).toBe('EmbeddedWorld');
    expect(l.length).toBeLessThan(sim.mods.maxLinkDistance);
    expect(l.blocked).toBe('los');
    expect(l.valid).toBe(false);
  });
});

describe('A05 swept needle collision is render-rate independent', () => {
  function runAt(fps: number) {
    const sim = sandbox();
    const clock = new FixedStepClock(20);
    sim.step(input(sim, { selIndex: 0, aim: { x: 384, y: 150 } }));
    sim.step(input(sim, { fire: true, aim: { x: 384, y: 150 } }));
    let frames = 0;
    while (sim.needle('A').state === 'Flying' && frames < 2000) {
      const n = clock.advance(1 / fps);
      for (let i = 0; i < n; i++) sim.step(input(sim));
      frames++;
    }
    const nd = sim.needle('A');
    return { state: nd.state, tick: nd.stateTick, x: nd.pos.x, y: nd.pos.y };
  }
  it('30/60/144 fps produce the identical first hit', () => {
    const a = runAt(30);
    const b = runAt(60);
    const c = runAt(144);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('a fast needle cannot tunnel through a thin moving collider', () => {
    const mover: AreaLogic = {
      view: {},
      setup(sim) {
        sim.addBody(makeBody('thin', 'mechanism', { x: 300, y: 60 }, [circle('thinC', { x: 0, y: 0 }, 2, 'Anchorable')]));
      },
      update(sim) {
        const b = sim.body('thin')!;
        b.pos = { x: 300, y: b.pos.y + 3 }; // sweeps down across the needle path
      },
    };
    const sim = new Sim({ area: SANDBOX, seed: 1, logic: mover, tunings: [] });
    sim.mods.needleSpeed = 2400; // ~40px per tick, far larger than the 4px collider
    sim.player.pos = { x: 40, y: 150 };
    stepN(sim, 1);
    sim.step(input(sim, { selIndex: 0, aim: { x: 380, y: 150 } }));
    const startY = sim.body('thin')!.pos.y;
    // launch so that the collider crosses y=150 while the needle passes x=300
    const ticksToCross = Math.round((150 - startY) / 3);
    const flightTicks = Math.round(260 / 40);
    stepN(sim, Math.max(0, ticksToCross - flightTicks));
    sim.step(input(sim, { fire: true, aim: { x: 380, y: 150 } }));
    waitUntil(sim, () => sim.needle('A').state !== 'Flying', 200);
    const n = sim.needle('A');
    expect(n.host?.shapeId).toBe('thinC');
  });
});

describe('A06 capture provenance & A07 signature & A08 direction', () => {
  function stonesSim() {
    const boss = new TestBoss();
    const sim = new Sim({ area: SANDBOX, seed: 3, boss });
    startFight(sim);
    throwNeedle(sim, 'A', { x: 120, y: 140 });
    throwNeedle(sim, 'B', { x: 264, y: 140 });
    stepN(sim, 1);
    return { sim, boss };
  }

  it('only attacks that really cross the link charge it, once per attack', () => {
    const { sim } = stonesSim();
    const l = sim.link('AB');
    expect(l.valid).toBe(true);
    sim.spawnAttack({ kind: 'zone', owner: 't', sig: 'Impact', capturable: true, harmful: false, p: { x: 192, y: 60, r: 8, tele: 0, active: 0.3 } });
    stepN(sim, 20);
    expect(l.state).toBe('Idle');
    sim.spawnAttack({ kind: 'zone', owner: 't', sig: 'Impact', capturable: true, harmful: false, p: { x: 192, y: 140, r: 8, tele: 0, active: 0.3 } });
    stepN(sim, 20); // overlapping for many ticks must not self-overload
    expect(l.state).toBe('Charged');
    expect(l.sig).toBe('Impact');
    // non-capturable (signature-less) attacks never charge
    const l2 = sim.link('AB');
    sim.spawnAttack({ kind: 'zone', owner: 't', sig: null, capturable: false, harmful: false, p: { x: 192, y: 140, r: 8, tele: 0, active: 0.3 } });
    stepN(sim, 5);
    expect(l2.state).toBe('Charged');
    // a second Impact attack overloads
    chargeLinkAt(sim, 192, 140);
    expect(l.state).toBe('Overloaded');
  });

  it('wrong signature cannot break the seal', () => {
    const { sim, boss } = stonesSim();
    chargeLinkAt(sim, 192, 140, 'Wave');
    sim.step(input(sim, { pulse: true, aim: { x: 264, y: 140 } }));
    stepN(sim, 30, { aim: { x: 264, y: 140 } });
    expect(boss.delivered).toContain('stoneR:Wave');
    expect(boss.seals[0]!.broken).toBe(false);
    chargeLinkAt(sim, 192, 140, 'Impact');
    sim.step(input(sim, { pulse: true, aim: { x: 264, y: 140 } }));
    stepN(sim, 30, { aim: { x: 264, y: 140 } });
    expect(boss.seals[0]!.broken).toBe(true);
  });

  it('A->B and B->A deliver to different targets', () => {
    const { sim, boss } = stonesSim();
    chargeLinkAt(sim, 192, 140, 'Wave');
    sim.step(input(sim, { pulse: true, aim: { x: 110, y: 140 } })); // aim at A (stoneL): B->A
    stepN(sim, 30, { aim: { x: 110, y: 140 } });
    chargeLinkAt(sim, 192, 140, 'Wave');
    sim.step(input(sim, { pulse: true, aim: { x: 270, y: 140 } })); // aim at B (stoneR): A->B
    stepN(sim, 30, { aim: { x: 270, y: 140 } });
    expect(boss.delivered).toEqual(['stoneL:Wave', 'stoneR:Wave']);
    const pulses = sim.log.filter((l) => l.includes('pulse '));
    expect(pulses[0]).toContain('B->A');
    expect(pulses[1]).toContain('A->B');
  });
});

describe('A09 seal idempotency', () => {
  it('re-processing a seal break event commits exactly once', () => {
    const boss = new TestBoss();
    const sim = new Sim({ area: SANDBOX, seed: 3, boss });
    startFight(sim);
    let commits = 0;
    for (let i = 0; i < 10; i++) if (sim.breakSeal('S1', 'evt-1')) commits++;
    for (let i = 0; i < 10; i++) if (sim.breakSeal('S1', `other-${i}`)) commits++;
    expect(commits).toBe(1);
    expect(sim.log.filter((l) => l.endsWith('seal S1')).length).toBe(1);
    expect(boss.coreExposed).toBe(true);
  });
});

describe('A10 shield / A11 recovery', () => {
  function hitPlayer(sim: Sim, lethal = false) {
    const p = sim.player.pos;
    sim.spawnAttack({ kind: 'zone', owner: 't', lethal, p: { x: p.x, y: p.y, r: 6, tele: 0, active: 0.05 } });
    stepN(sim, 2);
    stepN(sim, 45); // clear invulnerability
  }
  it('normal hits go 2 -> 1 -> Core -> Dead', () => {
    const sim = new Sim({ area: SANDBOX, seed: 3, boss: new TestBoss() });
    startFight(sim);
    expect(sim.player.shield).toBe(2);
    hitPlayer(sim);
    expect(sim.player.shield).toBe(1);
    hitPlayer(sim);
    expect(sim.player.shield).toBe(0);
    expect(sim.player.dead).toBe(false);
    hitPlayer(sim);
    expect(sim.player.dead).toBe(true);
    expect(sim.fight!.result).toBe('defeat');
  });
  it('lethal hits destroy the Core through shields', () => {
    const sim = new Sim({ area: SANDBOX, seed: 3, boss: new TestBoss() });
    startFight(sim);
    hitPlayer(sim, true);
    expect(sim.player.dead).toBe(true);
  });
  it('invulnerability window prevents double hits', () => {
    const sim = new Sim({ area: SANDBOX, seed: 3, boss: new TestBoss() });
    startFight(sim);
    const p = sim.player.pos;
    sim.spawnAttack({ kind: 'zone', owner: 't', p: { x: p.x, y: p.y, r: 6, tele: 0, active: 0.05 } });
    sim.spawnAttack({ kind: 'zone', owner: 't', p: { x: p.x, y: p.y, r: 6, tele: 0, active: 0.05 } });
    stepN(sim, 3);
    expect(sim.player.shield).toBe(1);
  });
  it('two successes restore one shield, at most once per fight', () => {
    const sim = new Sim({ area: SANDBOX, seed: 3, boss: new TestBoss() });
    startFight(sim);
    hitPlayer(sim);
    hitPlayer(sim);
    expect(sim.player.shield).toBe(0);
    sim.pulseSucceeded();
    expect(sim.player.shield).toBe(0);
    sim.pulseSucceeded();
    expect(sim.player.shield).toBe(1);
    for (let i = 0; i < 6; i++) sim.pulseSucceeded();
    expect(sim.player.shield).toBe(1);
    expect(sim.fight!.recoveriesUsed).toBe(1);
  });
});

describe('A12 same-tick Convergence vs lethal hit', () => {
  function tie(victoryT: number) {
    const boss = new TestBoss();
    const sim = new Sim({ area: SANDBOX, seed: 3, boss });
    startFight(sim);
    boss.coreExposed = true;
    boss.onTick = (s) => {
      if (s.tick !== 200) return;
      const p = s.player.pos;
      // lethal attack active this tick => first sampled overlap at t = 1/substeps (0.25)
      s.spawnAttack({ kind: 'zone', owner: 't', lethal: true, p: { x: p.x, y: p.y, r: 6, tele: 0, active: 0.2 } });
      s.requestVictory(victoryT, p);
    };
    waitUntil(sim, () => sim.tick >= 201, 400);
    return sim.fight!.result;
  }
  it('convergence strictly earlier wins', () => expect(tie(0.1)).toBe('victory'));
  it('exact tie resolves as player death', () => expect(tie(0.25)).toBe('defeat'));
  it('lethal earlier wins', () => expect(tie(0.6)).toBe('defeat'));
});

describe('A13 moving anchor', () => {
  it('needle and link endpoint track a moving body exactly', () => {
    let moving = false;
    let t0 = 0;
    const logic: AreaLogic = {
      view: {},
      setup(sim) {
        sim.addBody(makeBody('float', 'mechanism', { x: 300, y: 60 }, [circle('floatC', { x: 0, y: 0 }, 6, 'MovingAnchor')]));
      },
      update(sim) {
        if (!moving) return;
        const b = sim.body('float')!;
        const t = sim.tick - t0;
        b.pos = { x: 300 + Math.sin(t / 30) * 30, y: 60 + Math.sin(t / 45) * 20 };
        b.angle = t / 50;
      },
    };
    const sim = new Sim({ area: SANDBOX, seed: 1, logic });
    sim.player.pos = { x: 300, y: 150 };
    throwNeedle(sim, 'A', { x: 300, y: 60 });
    expect(sim.needle('A').host?.shapeId).toBe('floatC');
    sim.player.pos = { x: 230, y: 150 };
    throwNeedle(sim, 'B', { x: 270, y: 0 });
    moving = true;
    t0 = sim.tick;
    const lens: number[] = [];
    for (let i = 0; i < 120; i++) {
      sim.step(input(sim));
      const b = sim.body('float')!;
      const n = sim.needle('A');
      const c = Math.cos(b.angle);
      const s = Math.sin(b.angle);
      const wx = b.pos.x + n.host!.local.x * c - n.host!.local.y * s;
      const wy = b.pos.y + n.host!.local.x * s + n.host!.local.y * c;
      expect(Math.abs(wx - n.pos.x)).toBeLessThan(1e-9);
      expect(Math.abs(wy - n.pos.y)).toBeLessThan(1e-9);
      if (sim.link('AB').valid) lens.push(sim.link('AB').length);
    }
    expect(lens.length).toBeGreaterThan(10);
    expect(Math.max(...lens) - Math.min(...lens)).toBeGreaterThan(5);
  });
});

describe('A14 reset / A15 determinism', () => {
  function script(sim: Sim) {
    const aims = [{ x: 120, y: 140 }, { x: 264, y: 140 }, { x: 0, y: 96 }];
    for (let t = 0; t < 900; t++) {
      const k = t % 97;
      sim.step(input(sim, {
        move: { x: Math.sin(t / 40), y: Math.cos(t / 55) },
        aim: aims[Math.floor(t / 97) % 3]!,
        fire: k === 3,
        selNext: k === 50,
        recallAll: t % 311 === 300,
        dash: t % 120 === 60,
        pulse: t % 150 === 149,
      }));
      if (t % 77 === 5) sim.spawnAttack({ kind: 'ring', owner: 't', sig: 'Wave', capturable: true, harmful: true, p: { x: 192, y: 96, r: 4, speed: 120, rMax: 200, th: 6, tele: 0.3 } });
    }
  }
  it('same seed + inputs => identical transition log', () => {
    const a = new Sim({ area: SANDBOX, seed: 42, boss: new TestBoss() });
    const b = new Sim({ area: SANDBOX, seed: 42, boss: new TestBoss() });
    script(a);
    script(b);
    expect(a.log.length).toBeGreaterThan(10);
    expect(b.log).toEqual(a.log);
    expect(b.player.pos).toEqual(a.player.pos);
  });
  it('a fresh Sim after heavy play has no residual gameplay state', () => {
    const played = new Sim({ area: SANDBOX, seed: 42, boss: new TestBoss() });
    script(played);
    const fresh = new Sim({ area: SANDBOX, seed: 42, boss: new TestBoss() });
    expect(fresh.attacks.length).toBe(0);
    expect(fresh.pulses.length).toBe(0);
    expect(fresh.needles.every((n) => n.state === 'Held')).toBe(true);
    expect(fresh.links.every((l) => !l.valid && l.state === 'Idle')).toBe(true);
    expect(fresh.player.shield).toBe(2);
    expect(fresh.boss!.seals.every((s) => !s.broken)).toBe(true);
    expect(fresh.log.length).toBe(0);
  });
});
