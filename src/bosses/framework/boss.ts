import type { Vec } from '../../core/math/vec.ts';
import type { RayHit } from '../../core/sim/bodies.ts';
import type { Attack, Body, DeliveryInfo, Link, Needle, Pulse, PulseResult, Shape } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';

export interface SealState {
  id: string;
  nameKey: string;
  broken: boolean;
  brokenTick: number;
  /** HUD glyph family 0..3 (shape differs per seal kind) */
  glyph: number;
  /** optional seals (mastery routes) are not required for Core exposure */
  optional?: boolean;
}

/** Plain view-model data for presentation (pose names, timers, part offsets). Never read by gameplay. */
export interface BossView {
  pose: string;
  poseT: number;
  facing: number; // 1 right, -1 left
  flash: number;
  parts: Record<string, { x: number; y: number; a?: number; f?: number; on?: boolean }>;
  tells: { kind: string; pos: Vec; value?: number }[];
  /** arena prop id -> visual state name (e.g. 'broken', 'flash') */
  props: Record<string, string>;
}

export type NeedleHitResponse = 'embed' | 'bounce' | 'pass' | 'disable';
export type AttackLinkResponse = 'capture' | 'cut' | 'ignore';

export interface BossController {
  readonly id: string;
  phase: string;
  seals: SealState[];
  coreExposed: boolean;
  defeated: boolean;
  view: BossView;
  /** add bodies (boss parts, arena mechanisms). Called once from the Sim constructor. */
  setup(sim: Sim): void;
  update(sim: Sim): void;
  /** Story combat advances one seal per successful counter, independent of signal type or target. */
  onSimpleProgress?(sim: Sim, brokenSeals: number): void;
  /** after victory, animate the defeat (no attacks) */
  updateDefeated?(sim: Sim): void;
  onPulseDelivered?(sim: Sim, d: DeliveryInfo): PulseResult | undefined;
  onPulsePath?(sim: Sim, pulse: Pulse, body: Body, shape: Shape, t: number): void;
  onNeedleHit?(sim: Sim, needle: Needle, hit: RayHit): NeedleHitResponse | undefined;
  onAttackLink?(sim: Sim, attack: Attack, link: Link): AttackLinkResponse | undefined;
  /** can a needle hosted on this shape be recalled right now? */
  canRecall?(sim: Sim, needle: Needle): boolean;
  debugInfo(): Record<string, string | number | boolean>;
}

export function newView(): BossView {
  return { pose: 'idle', poseT: 0, facing: 1, flash: 0, parts: {}, tells: [], props: {} };
}

export function makeSeals(defs: { id: string; glyph: number; optional?: boolean }[], bossId: string): SealState[] {
  return defs.map((d) => {
    const s: SealState = { id: d.id, nameKey: `seal.${bossId}.${d.id}`, broken: false, brokenTick: -1, glyph: d.glyph };
    if (d.optional) s.optional = true;
    return s;
  });
}

export const requiredSealsBroken = (seals: readonly SealState[]): boolean => seals.every((s) => s.optional || s.broken);
