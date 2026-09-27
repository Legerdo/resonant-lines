// Authoritative gameplay state types. Presentation/audio/UI only read these.
import type { Vec } from '../math/vec.ts';

export type NeedleId = 'A' | 'B' | 'C';
export const NEEDLE_IDS: readonly NeedleId[] = ['A', 'B', 'C'];
export type NeedleState = 'Held' | 'Flying' | 'EmbeddedWorld' | 'EmbeddedBoss' | 'Disabled' | 'Returning';

export type LinkId = 'AB' | 'BC' | 'CA';
export const LINK_DEFS: readonly { id: LinkId; a: NeedleId; b: NeedleId }[] = [
  { id: 'AB', a: 'A', b: 'B' },
  { id: 'BC', a: 'B', b: 'C' },
  { id: 'CA', a: 'C', b: 'A' },
];
export type LinkState = 'Idle' | 'Charging' | 'Charged' | 'Overloaded' | 'Broken';

export type Signature = 'Impact' | 'Wave' | 'Heat' | 'Void' | 'Rotational';
export const SIGNATURES: readonly Signature[] = ['Impact', 'Wave', 'Heat', 'Void', 'Rotational'];

export type SurfaceTag = 'Anchorable' | 'NonAnchorable' | 'BossAnchorable' | 'TemporaryAnchor' | 'MovingAnchor' | 'HazardAnchor';

export const isAnchorTag = (t: SurfaceTag): boolean => t !== 'NonAnchorable';

interface ShapeBase {
  id: string;
  tag: SurfaceTag;
  blocksLink: boolean;
  blocksMove: boolean;
  blocksNeedle: boolean;
  /** receives pulse deliveries (boss / area routing key) */
  receiver?: string;
  enabled: boolean;
  /** hurts the player on contact (used for hazards) */
  hazard?: boolean;
}
export interface SegShape extends ShapeBase {
  kind: 'seg';
  a: Vec;
  b: Vec;
  /** unit normal pointing into open space (local coords) */
  n: Vec;
}
export interface CircleShape extends ShapeBase {
  kind: 'circle';
  c: Vec;
  r: number;
}
export type Shape = SegShape | CircleShape;

export type BodyKind = 'world' | 'boss' | 'mechanism';
export interface Body {
  id: string;
  kind: BodyKind;
  pos: Vec;
  angle: number;
  prevPos: Vec;
  prevAngle: number;
  shapes: Shape[];
  enabled: boolean;
}

export interface NeedleHost {
  bodyId: string;
  shapeId: string;
  local: Vec; // position in body local space
  localNormal: Vec;
}

export interface Needle {
  id: NeedleId;
  state: NeedleState;
  pos: Vec;
  prevPos: Vec;
  dir: Vec;
  speed: number;
  traveled: number;
  host: NeedleHost | null;
  normal: Vec; // world normal of host surface (for rendering orientation)
  timer: number;
  recallLocked: boolean;
  bounces: number;
  stateTick: number;
}

export interface Link {
  id: LinkId;
  a: NeedleId;
  b: NeedleId;
  valid: boolean;
  /** why a pair within range is not linked (presentation hint) */
  blocked: 'none' | 'distance' | 'los' | 'broken' | 'state';
  state: LinkState;
  sig: Signature | null;
  tone: number;
  power: number;
  progress: number;
  chargingSig: Signature | null;
  chargingTone: number;
  overloadT: number;
  brokenT: number;
  echoT: number;
  captured: number[];
  formedTick: number;
  stateTick: number;
  threadCd: number;
  length: number;
}

export interface Lattice {
  formed: boolean;
  area: number;
  centroid: Vec;
  formedTick: number;
}

export interface Pulse {
  id: number;
  group: number;
  linkId: LinkId;
  from: NeedleId;
  to: NeedleId;
  sig: Signature;
  tone: number;
  power: number;
  d: number;
  prevD: number;
  length: number;
  speed: number;
  width: number;
  done: boolean;
  pathHits: string[];
  /** unit direction source->target at release */
  dir: Vec;
  /** Echo tuning: seconds the delivered pulse keeps sweeping the whole link */
  linger: number;
  delivered: boolean;
}

export type AttackShape =
  | { kind: 'circle'; c: Vec; r: number }
  | { kind: 'ring'; c: Vec; rIn: number; rOut: number; arcAng?: number; arcHalf?: number }
  | { kind: 'capsule'; a: Vec; b: Vec; r: number };

export type AttackPhase = 'telegraph' | 'active' | 'recovery' | 'done';

export interface Attack {
  id: number;
  kind: string;
  owner: string;
  sig: Signature | null;
  tone: number;
  phase: AttackPhase;
  t: number;
  age: number;
  shape: AttackShape | null;
  prevShape: AttackShape | null;
  /** telegraph geometry shown before activation (never larger than the real hit shape) */
  tele: AttackShape | null;
  harmful: boolean;
  lethal: boolean;
  capturable: boolean;
  continuous: boolean;
  hitPlayer: boolean;
  /** kind specific numeric parameters */
  p: Record<string, number>;
}

export interface DashState {
  active: boolean;
  t: number;
  dur: number;
  dir: Vec;
  cd: number;
}

export interface PlayerState {
  pos: Vec;
  prevPos: Vec;
  vel: Vec;
  facing: Vec;
  aim: Vec;
  aimDir: Vec;
  radius: number;
  shield: number; // 2,1 = shields, 0 = Core only
  dead: boolean;
  deathTick: number;
  invuln: number;
  hitFlash: number;
  dash: DashState;
  selected: number; // 0..2
  fireCd: number;
  pulseStartup: number;
  pulseCd: number;
  throwAnim: number;
  recallAnim: number;
  pulseAnim: number;
  moving: boolean;
  lastHitTick: number;
}

export interface FightState {
  bossId: string;
  elapsed: number;
  pulseSuccesses: number;
  recoveriesUsed: number;
  result: 'intro' | 'ongoing' | 'victory' | 'defeat';
  resultTick: number;
  introT: number;
  stableNetUsed: boolean;
  deathCause: string;
}

export type SimEventType =
  | 'needleFired' | 'needleEmbedded' | 'needleBounced' | 'needleDisabled' | 'needleRecalled' | 'needleCaught' | 'recallDenied'
  | 'linkFormed' | 'linkLost' | 'linkBroken' | 'capture' | 'overload' | 'chargeLost'
  | 'pulseFired' | 'pulseDelivered' | 'pulseFizzled' | 'pulsePathHit' | 'pulseEmpty'
  | 'playerHit' | 'playerDied' | 'shieldRestored' | 'dash' | 'threadStep'
  | 'sealBroken' | 'sealRejected' | 'coreExposed' | 'bossPhase' | 'bossVictory' | 'bossStagger'
  | 'telegraph' | 'attack' | 'shake' | 'sfx' | 'interact' | 'exit' | 'doorOpened' | 'hint' | 'latticeFormed' | 'latticeLost';

export interface SimEvent {
  type: SimEventType;
  pos?: Vec;
  dir?: Vec;
  id?: string;
  needle?: NeedleId;
  link?: LinkId;
  sig?: Signature | null;
  value?: number;
  text?: string;
  result?: 'success' | 'fail' | 'none';
}

export interface InputFrame {
  move: Vec;
  aim: Vec; // world coordinates
  fire: boolean;
  recall: boolean;
  recallAll: boolean;
  selNext: boolean;
  selPrev: boolean;
  selIndex: number; // -1 none
  pulse: boolean;
  dash: boolean;
}

export const emptyInput = (aim: Vec = { x: 0, y: 0 }): InputFrame => ({
  move: { x: 0, y: 0 },
  aim,
  fire: false,
  recall: false,
  recallAll: false,
  selNext: false,
  selPrev: false,
  selIndex: -1,
  pulse: false,
  dash: false,
});

export type PulseResult = 'success' | 'fail' | 'none';

export interface DeliveryInfo {
  pulse: Pulse;
  needle: Needle;
  bodyId: string;
  shapeId: string;
  receiver: string | undefined;
  /** fraction of the tick at which the front reached the endpoint */
  t: number;
  pos: Vec;
}
