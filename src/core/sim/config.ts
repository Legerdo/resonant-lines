// TUNABLE gameplay constants (see ProjectState/progress.md "변경한 TUNABLE").

export const CFG = {
  player: {
    radius: 5,
    moveSpeed: 108,
    dashSpeed: 245,
    dashDuration: 0.2,
    dashCooldown: 0.42,
    dashIFrames: 0.12,
    hitInvuln: 0.65,
    fireCooldown: 0.12,
    handOffset: 6,
  },
  needle: {
    speed: 420,
    maxFlight: 300,
    recallSpeed: 560,
    catchRadius: 9,
    embedOffset: 1.5,
    disabledTime: 0.8,
    hazardTime: 2.5,
  },
  link: {
    maxDistance: 180,
    minDistance: 10,
    chargeTime: 0.35,
    overloadDuration: 3.0,
    brokenDuration: 1.5,
    captureTolerance: 1.5,
    latticeMinArea: 300,
  },
  pulse: {
    speed: 720,
    startup: 0.1,
    cooldown: 0.45,
    width: 4,
  },
  thread: {
    extend: 0.06,
    cooldown: 1.0,
  },
  recovery: {
    successesNeeded: 2,
    maxPerFight: 1,
  },
  /** substeps used for continuous overlap tests (attacks vs player / links) */
  substeps: 4,
  /** tie window (fraction of a tick): same-time Convergence vs lethal hit resolves as player death */
  tieEpsilon: 1e-6,
} as const;

export interface Mods {
  maxLinkDistance: number;
  chargeTime: number;
  needleSpeed: number;
  recallSpeed: number;
  overloadDuration: number;
  bounces: number;
  stableNet: boolean;
  pulseCooldown: number;
  echo: number;
  pulseStartup: number;
  pulseWidth: number;
  pulseSpeed: number;
  captureTolerance: number;
  threadExtend: number;
  threadCooldown: number;
  dashCooldown: number;
}

export function baseMods(): Mods {
  return {
    maxLinkDistance: CFG.link.maxDistance,
    chargeTime: CFG.link.chargeTime,
    needleSpeed: CFG.needle.speed,
    recallSpeed: CFG.needle.recallSpeed,
    overloadDuration: CFG.link.overloadDuration,
    bounces: 0,
    stableNet: false,
    pulseCooldown: CFG.pulse.cooldown,
    echo: 0,
    pulseStartup: CFG.pulse.startup,
    pulseWidth: CFG.pulse.width,
    pulseSpeed: CFG.pulse.speed,
    captureTolerance: CFG.link.captureTolerance,
    threadExtend: CFG.thread.extend,
    threadCooldown: CFG.thread.cooldown,
    dashCooldown: CFG.player.dashCooldown,
  };
}
