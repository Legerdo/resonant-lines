// The authoritative fixed-step simulation. One Sim instance == one area / arena attempt.
// Retrying a boss creates a brand new Sim from the same definition, so no gameplay state can leak between attempts.
import { DT } from '../clock/fixedStep.ts';
import { Rng } from '../rng/rng.ts';
import { type Vec, copy, norm, sub, len } from '../math/vec.ts';
import { CFG, type Mods } from './config.ts';
import { saveTransforms, findShape } from './bodies.ts';
import {
  type Attack, type Body, type FightState, type InputFrame, type Lattice, type Link, type Needle, type PlayerState,
  type Pulse, type SimEvent, LINK_DEFS, NEEDLE_IDS, type NeedleId, type LinkId, type DeliveryInfo, type PulseResult,
} from './types.ts';
import type { AreaDef } from '../../world/areaTypes.ts';
import { buildWorldBody } from '../../world/buildArea.ts';
import { modsFor, type TuningId } from '../../progression/tunings.ts';
import type { BossController, SealState } from '../../bosses/framework/boss.ts';
import { requiredSealsBroken } from '../../bosses/framework/boss.ts';
import { makeAttack, updateAttack, cloneShape } from '../../bosses/framework/attacks.ts';
import { handleCombatInput, updatePlayerMovement } from '../../player/movement.ts';
import { detectPlayerHits, resolveHits, tryShieldRecovery } from '../../player/guard.ts';
import { updateNeedles } from '../../resonance/needle.ts';
import { updateLinks, threadStep } from '../../resonance/link.ts';
import { updateCapture } from '../../resonance/capture.ts';
import { updatePulses } from '../../resonance/pulse.ts';

export interface AreaLogic {
  setup(sim: Sim): void;
  update(sim: Sim): void;
  onPulseDelivered?(sim: Sim, d: DeliveryInfo): PulseResult | undefined;
  view: Record<string, number>;
}

export interface SimOptions {
  area: AreaDef;
  seed?: number;
  flags?: Iterable<string>;
  tunings?: readonly TuningId[];
  spawn?: string;
  boss?: BossController | null;
  logic?: AreaLogic | null;
  invulnerable?: boolean;
}

export interface PendingHit {
  t: number;
  attack: Attack;
  lethal: boolean;
}

export class Sim {
  readonly area: AreaDef;
  readonly flags: Set<string>;
  readonly mods: Mods;
  readonly tunings: readonly TuningId[];
  readonly rng: Rng;
  readonly seed: number;
  tick = 0;
  bodies: Body[] = [];
  player: PlayerState;
  needles: Needle[];
  links: Link[];
  lattice: Lattice = { formed: false, area: 0, centroid: { x: 0, y: 0 }, formedTick: -1 };
  pulses: Pulse[] = [];
  attacks: Attack[] = [];
  boss: BossController | null;
  logic: AreaLogic | null;
  fight: FightState | null = null;
  events: SimEvent[] = [];
  /** boss/state transition log used by determinism tests */
  readonly log: string[] = [];
  debug = { invulnerable: false };
  pendingHits: PendingHit[] = [];
  pendingVictory: { t: number; pos: Vec } | null = null;
  pendingPulse = false;
  stableNetUsed = false;
  private nextIdValue = 1;
  private committedEvents = new Set<string>();

  constructor(opts: SimOptions) {
    this.area = opts.area;
    this.seed = opts.seed ?? 1;
    this.rng = new Rng(this.seed);
    this.flags = new Set(opts.flags ?? []);
    this.tunings = [...(opts.tunings ?? [])];
    this.mods = modsFor(this.tunings);
    this.debug.invulnerable = opts.invulnerable ?? false;
    const spawn = this.area.spawns[opts.spawn ?? 'default'] ?? this.area.spawns.default ?? { x: 64, y: 64 };
    this.player = {
      pos: copy(spawn),
      prevPos: copy(spawn),
      vel: { x: 0, y: 0 },
      facing: { x: 0, y: 1 },
      aim: { x: spawn.x, y: spawn.y + 32 },
      aimDir: { x: 0, y: 1 },
      radius: CFG.player.radius,
      shield: 2,
      dead: false,
      deathTick: -1,
      invuln: 0,
      hitFlash: 0,
      dash: { active: false, t: 0, dur: CFG.player.dashDuration, dir: { x: 0, y: 1 }, cd: 0 },
      selected: 0,
      fireCd: 0,
      pulseStartup: 0,
      pulseCd: 0,
      throwAnim: 0,
      recallAnim: 0,
      pulseAnim: 0,
      moving: false,
      lastHitTick: -1,
    };
    this.needles = NEEDLE_IDS.map((id) => ({
      id,
      state: 'Held' as const,
      pos: copy(spawn),
      prevPos: copy(spawn),
      dir: { x: 0, y: 1 },
      speed: 0,
      traveled: 0,
      host: null,
      normal: { x: 0, y: -1 },
      timer: 0,
      recallLocked: false,
      bounces: 0,
      stateTick: 0,
    }));
    this.links = LINK_DEFS.map((d) => ({
      id: d.id, a: d.a, b: d.b, valid: false, blocked: 'state' as const, state: 'Idle' as const, sig: null, tone: -1, power: 0,
      progress: 0, chargingSig: null, chargingTone: -1, overloadT: 0, brokenT: 0, echoT: 0, captured: [], formedTick: -1,
      stateTick: 0, threadCd: 0, length: 0,
    }));
    this.bodies.push(buildWorldBody(this.area, this.flags));
    this.boss = opts.boss ?? null;
    this.logic = opts.logic ?? null;
    if (this.boss) {
      this.fight = {
        bossId: this.boss.id, elapsed: 0, pulseSuccesses: 0, recoveriesUsed: 0, result: 'intro', resultTick: -1, introT: 1.1,
        stableNetUsed: false, deathCause: '',
      };
      this.boss.setup(this);
    }
    this.logic?.setup(this);
  }

  // ---------------------------------------------------------------- helpers used by subsystems & bosses
  get time(): number {
    return this.tick * DT;
  }
  nextId(): number {
    return this.nextIdValue++;
  }
  emit(e: SimEvent): void {
    this.events.push(e);
  }
  record(line: string): void {
    this.log.push(`${this.tick}:${line}`);
  }
  needle(id: NeedleId): Needle {
    const n = this.needles[NEEDLE_IDS.indexOf(id)];
    if (!n) throw new Error(`no needle ${id}`);
    return n;
  }
  link(id: LinkId): Link {
    const l = this.links.find((k) => k.id === id);
    if (!l) throw new Error(`no link ${id}`);
    return l;
  }
  linkBetween(a: NeedleId, b: NeedleId): Link {
    const l = this.links.find((k) => (k.a === a && k.b === b) || (k.a === b && k.b === a));
    if (!l) throw new Error(`no link ${a}${b}`);
    return l;
  }
  body(id: string): Body | undefined {
    return this.bodies.find((b) => b.id === id);
  }
  addBody(b: Body): Body {
    this.bodies.push(b);
    return b;
  }
  shape(id: string) {
    return findShape(this.bodies, id);
  }
  get fightOngoing(): boolean {
    return !!this.fight && this.fight.result === 'ongoing';
  }
  get inCombat(): boolean {
    return !!this.fight && (this.fight.result === 'ongoing' || this.fight.result === 'intro');
  }
  spawnAttack(init: Partial<Attack> & { kind: string; owner: string }): Attack {
    const a = makeAttack(this.nextId(), init);
    this.attacks.push(a);
    if (a.phase === 'telegraph') this.emit({ type: 'telegraph', id: a.kind, sig: a.sig, value: a.id });
    return a;
  }
  /** Needles currently embedded in a given body. */
  needlesOn(bodyId: string, shapeId?: string): Needle[] {
    return this.needles.filter(
      (n) => (n.state === 'EmbeddedBoss' || n.state === 'EmbeddedWorld') && n.host?.bodyId === bodyId && (!shapeId || n.host.shapeId === shapeId),
    );
  }
  disableNeedle(n: Needle, time: number = CFG.needle.disabledTime): void {
    if (n.state === 'Held' || n.state === 'Returning') return;
    n.state = 'Disabled';
    n.host = null;
    n.timer = time;
    n.recallLocked = false;
    n.stateTick = this.tick;
    this.emit({ type: 'needleDisabled', needle: n.id, pos: copy(n.pos) });
  }
  /** Break a seal exactly once. Re-processing the same event key (or an already broken seal) is a no-op. */
  breakSeal(sealId: string, eventKey: string, pos?: Vec): boolean {
    if (!this.boss || !this.fightOngoing) return false;
    const key = `seal:${sealId}:${eventKey}`;
    if (this.committedEvents.has(key)) return false;
    this.committedEvents.add(key);
    const seal: SealState | undefined = this.boss.seals.find((s) => s.id === sealId);
    if (!seal || seal.broken) return false;
    seal.broken = true;
    seal.brokenTick = this.tick;
    this.record(`seal ${sealId}`);
    this.emit({ type: 'sealBroken', id: sealId, value: this.boss.seals.indexOf(seal), ...(pos ? { pos: copy(pos) } : {}) });
    this.emit({ type: 'shake', value: 3 });
    if (!this.boss.coreExposed && requiredSealsBroken(this.boss.seals)) {
      this.boss.coreExposed = true;
      this.record('coreExposed');
      this.emit({ type: 'coreExposed', ...(pos ? { pos: copy(pos) } : {}) });
    }
    return true;
  }
  /** Boss completion request at sub-tick time t (0..1). Resolved against lethal hits at the end of the tick. */
  requestVictory(t: number, pos: Vec): void {
    if (!this.fightOngoing || !this.boss?.coreExposed) return;
    if (!this.pendingVictory || t < this.pendingVictory.t) this.pendingVictory = { t, pos: copy(pos) };
  }
  pulseSucceeded(): void {
    if (!this.fight) return;
    this.fight.pulseSuccesses++;
    tryShieldRecovery(this);
  }
  setBossPhase(phase: string): void {
    if (!this.boss || this.boss.phase === phase) return;
    this.boss.phase = phase;
    this.record(`phase ${phase}`);
    this.emit({ type: 'bossPhase', text: phase });
  }
  aimDir(): Vec {
    const d = sub(this.player.aim, this.player.pos);
    return len(d) > 0.5 ? norm(d) : this.player.facing;
  }

  // ---------------------------------------------------------------- the tick
  step(input: InputFrame): SimEvent[] {
    this.events = [];
    this.tick++;
    this.pendingHits = [];
    this.pendingVictory = null;
    saveTransforms(this.bodies);
    const p = this.player;
    p.prevPos = copy(p.pos);
    for (const n of this.needles) n.prevPos = copy(n.pos);
    for (const a of this.attacks) a.prevShape = a.phase === 'active' ? cloneShape(a.shape) : null;

    const f = this.fight;
    if (f && f.result === 'intro') {
      f.introT -= DT;
      if (f.introT <= 0) {
        f.result = 'ongoing';
        this.record('fightStart');
      }
    }
    if (f && f.result === 'ongoing') f.elapsed += DT;

    const canAct = !p.dead && (!f || f.result === 'ongoing' || f.result === 'intro');
    if (canAct) handleCombatInput(this, input);
    updatePlayerMovement(this, canAct ? input : null);

    if (this.boss) {
      if (f && f.result === 'ongoing') this.boss.update(this);
      else if (f && f.result === 'victory') this.boss.updateDefeated?.(this);
    }
    this.logic?.update(this);

    for (const a of this.attacks) updateAttack(this, a);
    updateNeedles(this);
    updateLinks(this);
    threadStep(this);
    updateCapture(this);
    updatePulses(this);
    detectPlayerHits(this);
    this.resolveDecisive();
    this.attacks = this.attacks.filter((a) => a.phase !== 'done');
    this.pulses = this.pulses.filter((q) => !q.done);
    if (!this.inCombat) this.checkAreaTriggers(input);
    return this.events;
  }

  /** LOCKED tie rule: Convergence strictly earlier than the lethal hit wins; equal (within epsilon) => player death. */
  private resolveDecisive(): void {
    const f = this.fight;
    const hits = this.pendingHits.sort((a, b) => a.t - b.t || a.attack.id - b.attack.id);
    const v = this.pendingVictory;
    if (f && f.result === 'ongoing' && v) {
      // does any hit this tick kill the player at or before the victory time?
      const lethalFirst = hits.find((h) => h.t <= v.t + CFG.tieEpsilon && this.hitWouldKill(h));
      if (!lethalFirst) {
        this.declareVictory(v.pos);
        return;
      }
    }
    resolveHits(this, hits);
  }

  hitWouldKill(h: PendingHit): boolean {
    if (this.debug.invulnerable) return false;
    return h.lethal || this.player.shield <= 0;
  }

  private declareVictory(pos: Vec): void {
    const f = this.fight;
    if (!f || !this.boss) return;
    f.result = 'victory';
    f.resultTick = this.tick;
    this.boss.defeated = true;
    this.record('victory');
    this.emit({ type: 'bossVictory', pos: copy(pos) });
    this.emit({ type: 'shake', value: 6 });
    for (const a of this.attacks) a.phase = 'done';
    for (const q of this.pulses) q.done = true;
    for (const n of this.needles) {
      if (n.state !== 'Held') {
        n.state = 'Returning';
        n.host = null;
        n.recallLocked = false;
        n.stateTick = this.tick;
      }
    }
  }

  private checkAreaTriggers(input: InputFrame): void {
    const p = this.player;
    if (p.dead) return;
    for (const ex of this.area.exits) {
      if (ex.requires && !this.flags.has(ex.requires)) continue;
      const r = ex.rect;
      if (p.pos.x > r.x && p.pos.x < r.x + r.w && p.pos.y > r.y && p.pos.y < r.y + r.h) {
        this.emit({ type: 'exit', id: ex.id, text: `${ex.to}|${ex.spawn}` });
        return;
      }
    }
    if (input.pulse) {
      for (const it of this.area.interactables) {
        if ((p.pos.x - it.pos.x) ** 2 + (p.pos.y - it.pos.y) ** 2 <= it.r * it.r) {
          this.emit({ type: 'interact', id: it.id, text: it.kind });
          return;
        }
      }
    }
  }
}
