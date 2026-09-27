// A17 save/load, progression rules (5-boss final gate, records) and tuning side-grades (§23).
import { describe, expect, it } from 'vitest';
import { newSave, sanitize, SaveStore, SAVE_KEY, SCHEMA_VERSION, type Storage } from '../src/save/save.ts';
import { completeBoss, discoverBoss, recordDeath, setFlag, storyBossesDone, flagsOf, FINAL_GATE_REQUIRED } from '../src/progression/progress.ts';
import { TUNINGS, MAX_EQUIPPED_TUNINGS, modsFor, type TuningId } from '../src/progression/tunings.ts';
import { baseMods, CFG, type Mods } from '../src/core/sim/config.ts';
import { BOSS_ENTRIES, STORY_BOSSES } from '../src/bosses/registry.ts';
import { Sim } from '../src/core/sim/sim.ts';
import { SANDBOX } from '../src/world/areas/sandbox.ts';
import type { AreaDef } from '../src/world/areaTypes.ts';
import { TestBoss } from './fixtures/testBoss.ts';
import { input, stepN, throwNeedle, waitUntil } from './helpers.ts';

class MemoryStorage implements Storage {
  map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

describe('A17 save / load', () => {
  it('restores discovery, completion, tunings, final gate, ending, records, settings and bindings exactly', () => {
    const storage = new MemoryStorage();
    const a = new SaveStore(storage);
    const d = a.data;
    discoverBoss(d, 'B03');
    for (const id of ['B01', 'B02', 'B04', 'B06', 'B07']) completeBoss(d, id, 42.5);
    completeBoss(d, 'FINAL', 61.25);
    recordDeath(d, 'B03');
    recordDeath(d, 'B03');
    setFlag(d, 'tutorialDone');
    setFlag(d, 'heartRestarted');
    d.unlockedRegions = ['garden', 'belfry', 'quarry', 'marsh'];
    d.equippedTunings = [d.unlockedTunings[0]!, d.unlockedTunings[2]!];
    d.endingSeen = true;
    d.fullClearBestTime = 3021.5;
    d.storyTime = 3100;
    d.lastArea = 'garden';
    d.lastSpawn = 'fromB04';
    d.settings.uiScale = 1.5;
    d.settings.volume.boss = 0.25;
    d.settings.highContrast = true;
    d.settings.slowMode = true;
    d.bindings.pulse = ['KeyF'];
    expect(a.write()).toBe(true);

    const b = new SaveStore(storage);
    expect(b.data).toEqual(d);
    expect(b.data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(b.data.finalGateUnlocked).toBe(true);
    expect(b.data.completedBossIds).toEqual(['B01', 'B02', 'B04', 'B06', 'B07', 'FINAL']);
    expect(b.data.discoveredBossIds).toContain('B03');
    expect(b.data.bossDeathCounts.B03).toBe(2);
    expect(b.hasProgress()).toBe(true);
    // derived world flags come back too (region state, cleared regions, gate, ending)
    const f = flagsOf(b.data);
    for (const k of ['boss:B01', 'seen:B03', 'finalGate', 'ending', 'region:marsh', 'cleared:garden']) expect(f.has(k), k).toBe(true);
    expect(f.has('cleared:marsh')).toBe(false);
  });

  it('untrusted / corrupted data is sanitised instead of crashing or leaking bad values', () => {
    expect(sanitize(null)).toEqual(newSave());
    expect(sanitize(42)).toEqual(newSave());
    const s = sanitize({
      completedBossIds: ['B01', 7, null],
      unlockedTunings: ['longLine', 'damageUp', 'echo'],
      equippedTunings: ['echo', 'swiftNeedle', 'longLine', 'longLine'], // swiftNeedle not unlocked
      bossBestTimes: { B01: 12.3, B02: 'fast', B03: Number.NaN },
      fullClearBestTime: 'never',
      settings: { uiScale: 2, shake: 9, volume: { master: -3, music: 0.5 }, deadzone: 0.9, aimSensitivity: 0 },
      bindings: { pulse: ['KeyF', 3], up: 'KeyW' },
      injected: '<script>',
    });
    expect(s.completedBossIds).toEqual(['B01']);
    expect(s.unlockedTunings).toEqual(['longLine', 'echo']);
    expect(s.equippedTunings).toEqual(['echo', 'longLine']);
    expect(s.equippedTunings.length).toBeLessThanOrEqual(MAX_EQUIPPED_TUNINGS);
    expect(s.bossBestTimes).toEqual({ B01: 12.3 });
    expect(s.fullClearBestTime).toBeNull();
    expect(s.settings.uiScale).toBe(1);
    expect(s.settings.shake).toBe(1);
    expect(s.settings.volume.master).toBe(0);
    expect(s.settings.volume.music).toBe(0.5);
    expect(s.settings.deadzone).toBe(0.5);
    expect(s.settings.aimSensitivity).toBe(0.5);
    expect(s.bindings.pulse).toEqual(['KeyF']);
    expect(s.bindings.up).toEqual(newSave().bindings.up);
    expect('injected' in s).toBe(false);
    // a broken JSON string in storage falls back to a fresh save and records the error
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{"completedBossIds": [');
    const store = new SaveStore(storage);
    expect(store.data).toEqual(newSave());
    expect(store.lastError).not.toBe('');
  });

  it('new game keeps settings and key bindings but clears progress', () => {
    const store = new SaveStore(new MemoryStorage());
    completeBoss(store.data, 'B01', 20);
    store.data.settings.uiScale = 1.25;
    store.data.bindings.dash = ['KeyZ'];
    store.reset();
    expect(store.data.completedBossIds).toEqual([]);
    expect(store.data.unlockedTunings).toEqual([]);
    expect(store.data.settings.uiScale).toBe(1.25);
    expect(store.data.bindings.dash).toEqual(['KeyZ']);
  });
});

describe('progression rules', () => {
  it('the heart gate opens exactly once, at the 5th DISTINCT story boss; repeats and FINAL do not count', () => {
    const d = newSave();
    const opened: string[] = [];
    const order = ['B01', 'B01', 'B02', 'B06', 'B02', 'B07', 'B04', 'B08', 'B03', 'B05', 'B04'];
    for (const id of order) {
      const r = completeBoss(d, id, 30);
      if (r.gateOpened) opened.push(`${id}@${storyBossesDone(d)}`);
      expect(d.finalGateUnlocked).toBe(storyBossesDone(d) >= FINAL_GATE_REQUIRED);
    }
    expect(opened).toEqual(['B04@5']);
    const f = newSave();
    for (const id of ['B01', 'B02', 'B03', 'B04']) completeBoss(f, id, 30);
    expect(completeBoss(f, 'FINAL', 30).gateOpened).toBe(false);
    expect(f.finalGateUnlocked).toBe(false);
  });

  it('each story boss unlocks its own tuning once; best times only improve', () => {
    const d = newSave();
    const first = completeBoss(d, 'B01', 40);
    expect(first).toMatchObject({ firstClear: true, newBest: true, tuning: 'elasticNeedle' });
    const again = completeBoss(d, 'B01', 55);
    expect(again).toMatchObject({ firstClear: false, newBest: false, tuning: null });
    expect(d.bossBestTimes.B01).toBe(40);
    expect(completeBoss(d, 'B01', 31.456).newBest).toBe(true);
    expect(d.bossBestTimes.B01).toBe(31.46);
    for (const id of STORY_BOSSES) completeBoss(d, id, 60);
    expect(d.unlockedTunings.length).toBe(STORY_BOSSES.length);
    expect(new Set(d.unlockedTunings).size).toBe(STORY_BOSSES.length);
    expect(new Set(BOSS_ENTRIES.map((b) => b.tuning).filter(Boolean)).size).toBe(TUNINGS.length);
  });
});

describe('§23 tunings are side-grades, capped at two', () => {
  const base = baseMods();
  const changed = (m: Mods) => (Object.keys(base) as (keyof Mods)[]).filter((k) => m[k] !== base[k]);

  it('every tuning changes the rules it documents (an upside and a cost), and nothing else', () => {
    const expected: Record<TuningId, (keyof Mods)[]> = {
      longLine: ['maxLinkDistance', 'chargeTime'],
      swiftNeedle: ['needleSpeed', 'recallSpeed', 'overloadDuration'],
      elasticNeedle: ['needleSpeed', 'bounces'],
      stableNet: ['stableNet', 'pulseCooldown'],
      echo: ['echo'],
      rapidTune: ['pulseStartup', 'pulseWidth'],
      wideCapture: ['pulseSpeed', 'captureTolerance'],
      threadWeaver: ['threadExtend', 'threadCooldown', 'dashCooldown'],
    };
    for (const t of TUNINGS) {
      const m = modsFor([t.id]);
      expect(changed(m).sort(), t.id).toEqual([...expected[t.id]].sort());
    }
    // the costs (spec: chargeRate -10%, needleSpeed -10%, pulse cooldown +15%, pulse width down, line stability -10%)
    expect(modsFor(['longLine']).chargeTime).toBeGreaterThan(base.chargeTime);
    expect(modsFor(['swiftNeedle']).overloadDuration).toBeLessThan(base.overloadDuration);
    expect(modsFor(['elasticNeedle']).needleSpeed).toBeLessThan(base.needleSpeed);
    expect(modsFor(['stableNet']).pulseCooldown).toBeGreaterThan(base.pulseCooldown);
    expect(modsFor(['rapidTune']).pulseWidth).toBeLessThan(base.pulseWidth);
    expect(modsFor(['wideCapture']).pulseSpeed).toBeLessThan(base.pulseSpeed);
    expect(modsFor(['threadWeaver']).dashCooldown).toBeGreaterThan(base.dashCooldown);
  });

  it('at most two apply; duplicates count once', () => {
    expect(MAX_EQUIPPED_TUNINGS).toBe(2);
    const three = modsFor(['longLine', 'echo', 'swiftNeedle']);
    expect(three.needleSpeed).toBe(base.needleSpeed); // the third is ignored
    expect(three.maxLinkDistance).toBeCloseTo(base.maxLinkDistance * 1.2);
    expect(three.echo).toBe(0.5);
    expect(modsFor(['longLine', 'longLine']).maxLinkDistance).toBeCloseTo(base.maxLinkDistance * 1.2);
  });

  // a corridor: the shot hits the rock floor ('#') first; the reflection reaches the anchor panel ('A') on the right
  const CORRIDOR: AreaDef = {
    id: 'corridor', kind: 'sandbox', region: 'hub', nameKey: 'area.sandbox',
    tiles: ['##########', '#........A', '#........A', '#........A', '##########'],
    spawns: { default: { x: 40, y: 40 } }, props: [], exits: [], interactables: [], music: 'none',
  };
  function throwAtFloor(tunings: TuningId[]) {
    const sim = new Sim({ area: CORRIDOR, seed: 1, tunings });
    const target = { x: 112, y: 64 };
    sim.step(input(sim, { selIndex: 0, aim: target }));
    sim.step(input(sim, { fire: true, aim: target }));
    waitUntil(sim, () => sim.needle('A').state !== 'Flying', 120, { aim: target });
    return sim.needle('A');
  }
  it('elastic needle: one wall bounce, then it embeds (without it the needle drops)', () => {
    const plain = throwAtFloor([]);
    expect(plain.state).toBe('Disabled');
    const elastic = throwAtFloor(['elasticNeedle']);
    expect(elastic.state).toBe('EmbeddedWorld');
    expect(elastic.pos.x).toBeGreaterThan(140);
  });

  function chargedPair(tunings: TuningId[]) {
    const sim = new Sim({ area: SANDBOX, seed: 3, boss: new TestBoss(), tunings });
    waitUntil(sim, () => sim.fight?.result === 'ongoing', 200);
    throwNeedle(sim, 'A', { x: 120, y: 140 });
    throwNeedle(sim, 'B', { x: 264, y: 140 });
    stepN(sim, 1);
    return sim;
  }
  const zap = (sim: Sim) => {
    sim.spawnAttack({ kind: 'zone', owner: 't', sig: 'Impact', capturable: true, harmful: false, p: { x: 192, y: 140, r: 8, tele: 0, active: 0.1 } });
    stepN(sim, 2);
  };

  it('stable net absorbs the first overload break of an attempt, only the first', () => {
    const plain = chargedPair([]);
    zap(plain);
    zap(plain);
    expect(plain.link('AB').state).toBe('Overloaded');
    zap(plain);
    expect(plain.link('AB').state).toBe('Broken');
    const net = chargedPair(['stableNet']);
    zap(net);
    zap(net);
    zap(net);
    expect(net.link('AB').state).toBe('Overloaded');
    expect(net.stableNetUsed).toBe(true);
    zap(net);
    expect(net.link('AB').state).toBe('Broken');
  });

  it('echo: the discharged line lingers 0.5 s and cannot take new energy meanwhile', () => {
    for (const [tunings, lingers] of [[[], false], [['echo'], true]] as const) {
      const sim = chargedPair([...tunings]);
      zap(sim);
      expect(sim.link('AB').state).toBe('Charged');
      sim.step(input(sim, { pulse: true, aim: { x: 270, y: 140 } }));
      waitUntil(sim, () => sim.link('AB').state === 'Idle', 60, { aim: { x: 270, y: 140 } });
      zap(sim);
      expect(sim.link('AB').state, `echo=${lingers}`).toBe(lingers ? 'Idle' : 'Charged');
      if (lingers) {
        stepN(sim, 40);
        zap(sim);
        expect(sim.link('AB').state).toBe('Charged');
      }
    }
  });
});

describe('§13 Thread Step', () => {
  function linked(tunings: TuningId[] = []) {
    const sim = new Sim({ area: SANDBOX, seed: 3, boss: new TestBoss(), tunings });
    waitUntil(sim, () => sim.fight?.result === 'ongoing', 200);
    throwNeedle(sim, 'A', { x: 120, y: 140 });
    throwNeedle(sim, 'B', { x: 264, y: 140 });
    stepN(sim, 1);
    return sim;
  }
  const threadSteps = (sim: Sim) => sim.log.filter((x) => x.endsWith('threadStep AB')).length;
  function dashAcross(sim: Sim, dirY: 1 | -1) {
    waitUntil(sim, () => sim.player.dash.cd <= 0 && !sim.player.dash.active, 120);
    sim.step(input(sim, { dash: true, move: { x: 0, y: dirY } }));
    waitUntil(sim, () => !sim.player.dash.active, 60);
  }

  it('a dash across your own live link extends the dash and refreshes an overloaded charge, once per cooldown', () => {
    const sim = linked();
    const l = sim.link('AB');
    expect(l.valid).toBe(true);
    // overload the line, let the overload timer run down for a second
    for (let k = 0; k < 2; k++) {
      sim.spawnAttack({ kind: 'zone', owner: 't', sig: 'Impact', capturable: true, harmful: false, p: { x: 192, y: 140, r: 8, tele: 0, active: 0.1 } });
      stepN(sim, 2);
    }
    expect(l.state).toBe('Overloaded');
    stepN(sim, 60);
    expect(l.overloadT).toBeLessThan(CFG.link.overloadDuration - 0.9);
    sim.player.pos = { x: 192, y: 124 };
    dashAcross(sim, 1);
    expect(threadSteps(sim)).toBe(1);
    expect(sim.player.dash.dur).toBeCloseTo(CFG.player.dashDuration + CFG.thread.extend);
    expect(l.overloadT).toBeGreaterThan(CFG.link.overloadDuration - 0.3);
    expect(l.threadCd).toBeGreaterThan(0);
    // straight back across while that line is still cooling down: no second Thread Step, normal dash length
    dashAcross(sim, -1);
    expect(sim.player.pos.y).toBeLessThan(140);
    expect(threadSteps(sim)).toBe(1);
    expect(sim.player.dash.dur).toBeCloseTo(CFG.player.dashDuration);
    // after the cooldown it works again
    waitUntil(sim, () => l.threadCd <= 0, 120);
    dashAcross(sim, 1);
    expect(threadSteps(sim)).toBe(2);
  });

  it('never triggers on a dash that does not cross the line, and threadWeaver doubles the extension', () => {
    const sim = linked();
    sim.player.pos = { x: 192, y: 60 };
    dashAcross(sim, -1);
    expect(threadSteps(sim)).toBe(0);
    const tw = linked(['threadWeaver']);
    tw.player.pos = { x: 192, y: 124 };
    dashAcross(tw, 1);
    expect(threadSteps(tw)).toBe(1);
    expect(tw.player.dash.dur).toBeCloseTo(CFG.player.dashDuration + CFG.thread.extend * 2);
  });
});
