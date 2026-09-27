// Resonance tunings: side-grades only. None raises damage (there is no damage stat) and none is required to win.
import { baseMods, type Mods } from '../core/sim/config.ts';

export type TuningId = 'longLine' | 'swiftNeedle' | 'elasticNeedle' | 'stableNet' | 'echo' | 'rapidTune' | 'wideCapture' | 'threadWeaver';

export interface TuningDef {
  id: TuningId;
  nameKey: string;
  descKey: string;
  apply: (m: Mods) => void;
}

export const TUNINGS: readonly TuningDef[] = [
  {
    id: 'longLine', nameKey: 'tuning.longLine', descKey: 'tuning.longLine.desc',
    apply: (m) => { m.maxLinkDistance *= 1.2; m.chargeTime /= 0.9; },
  },
  {
    id: 'swiftNeedle', nameKey: 'tuning.swiftNeedle', descKey: 'tuning.swiftNeedle.desc',
    apply: (m) => { m.needleSpeed *= 1.25; m.recallSpeed *= 1.15; m.overloadDuration *= 0.9; },
  },
  {
    id: 'elasticNeedle', nameKey: 'tuning.elasticNeedle', descKey: 'tuning.elasticNeedle.desc',
    apply: (m) => { m.bounces = 1; m.needleSpeed *= 0.9; },
  },
  {
    id: 'stableNet', nameKey: 'tuning.stableNet', descKey: 'tuning.stableNet.desc',
    apply: (m) => { m.stableNet = true; m.pulseCooldown *= 1.15; },
  },
  {
    id: 'echo', nameKey: 'tuning.echo', descKey: 'tuning.echo.desc',
    apply: (m) => { m.echo = 0.5; },
  },
  {
    id: 'rapidTune', nameKey: 'tuning.rapidTune', descKey: 'tuning.rapidTune.desc',
    apply: (m) => { m.pulseStartup *= 0.4; m.pulseWidth = 2; },
  },
  {
    id: 'wideCapture', nameKey: 'tuning.wideCapture', descKey: 'tuning.wideCapture.desc',
    apply: (m) => { m.captureTolerance += 3; m.pulseSpeed *= 0.8; },
  },
  {
    id: 'threadWeaver', nameKey: 'tuning.threadWeaver', descKey: 'tuning.threadWeaver.desc',
    apply: (m) => { m.threadExtend *= 2; m.threadCooldown *= 0.5; m.dashCooldown *= 1.15; },
  },
];

export const MAX_EQUIPPED_TUNINGS = 2;

export function modsFor(equipped: readonly TuningId[]): Mods {
  const m = baseMods();
  const unique = [...new Set(equipped)].slice(0, MAX_EQUIPPED_TUNINGS);
  for (const id of unique) TUNINGS.find((t) => t.id === id)?.apply(m);
  return m;
}

export const isTuningId = (v: unknown): v is TuningId => typeof v === 'string' && TUNINGS.some((t) => t.id === v);
