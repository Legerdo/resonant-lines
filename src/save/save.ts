// Versioned save (localStorage). Written only at progression boundaries — never mid-fight.
import { DEFAULT_BINDINGS, type Bindings, ACTIONS } from '../input/input.ts';
import { isTuningId, type TuningId } from '../progression/tunings.ts';

export const SAVE_KEY = 'resonant-lines/save';
export const SCHEMA_VERSION = 1;

export interface Settings {
  volume: { master: number; music: number; boss: number; resonance: number; impact: number; environment: number; ui: number };
  uiScale: number; // 1, 1.25, 1.5
  shake: number; // 0..1
  flash: boolean;
  highContrast: boolean;
  slowMode: boolean;
  aimSensitivity: number;
  deadzone: number;
  vibration: boolean;
}

export interface SaveData {
  schemaVersion: number;
  discoveredBossIds: string[];
  completedBossIds: string[];
  unlockedRegions: string[];
  unlockedTunings: TuningId[];
  equippedTunings: TuningId[];
  finalGateUnlocked: boolean;
  endingSeen: boolean;
  bossBestTimes: Record<string, number>;
  bossDeathCounts: Record<string, number>;
  fullClearBestTime: number | null;
  storyTime: number;
  flags: string[];
  lastArea: string;
  lastSpawn: string;
  settings: Settings;
  bindings: Bindings;
}

export function defaultSettings(): Settings {
  return {
    volume: { master: 0.8, music: 0.6, boss: 0.8, resonance: 0.8, impact: 0.8, environment: 0.6, ui: 0.7 },
    uiScale: 1,
    shake: 1,
    flash: true,
    highContrast: false,
    slowMode: false,
    aimSensitivity: 1,
    deadzone: 0.2,
    vibration: true,
  };
}

export function newSave(keep?: Pick<SaveData, 'settings' | 'bindings'>): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    discoveredBossIds: [],
    completedBossIds: [],
    unlockedRegions: [],
    unlockedTunings: [],
    equippedTunings: [],
    finalGateUnlocked: false,
    endingSeen: false,
    bossBestTimes: {},
    bossDeathCounts: {},
    fullClearBestTime: null,
    storyTime: 0,
    flags: [],
    lastArea: 'hub',
    lastSpawn: 'default',
    settings: keep?.settings ?? defaultSettings(),
    bindings: keep?.bindings ?? structuredClone(DEFAULT_BINDINGS),
  };
}

const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const recNum = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (typeof x === 'number' && Number.isFinite(x)) out[k] = x;
  return out;
};

/** Validate + migrate untrusted JSON into a SaveData (unknown fields dropped, bad values defaulted). */
export function sanitize(raw: unknown): SaveData {
  const d = newSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const ds = defaultSettings();
  const rs = (r.settings ?? {}) as Record<string, unknown>;
  const rv = (rs.volume ?? {}) as Record<string, unknown>;
  const settings: Settings = {
    volume: {
      master: num(rv.master, ds.volume.master, 0, 1), music: num(rv.music, ds.volume.music, 0, 1), boss: num(rv.boss, ds.volume.boss, 0, 1),
      resonance: num(rv.resonance, ds.volume.resonance, 0, 1), impact: num(rv.impact, ds.volume.impact, 0, 1),
      environment: num(rv.environment, ds.volume.environment, 0, 1), ui: num(rv.ui, ds.volume.ui, 0, 1),
    },
    uiScale: [1, 1.25, 1.5].includes(rs.uiScale as number) ? (rs.uiScale as number) : 1,
    shake: num(rs.shake, 1, 0, 1),
    flash: bool(rs.flash, true),
    highContrast: bool(rs.highContrast, false),
    slowMode: bool(rs.slowMode, false),
    aimSensitivity: num(rs.aimSensitivity, 1, 0.5, 2),
    deadzone: num(rs.deadzone, 0.2, 0.05, 0.5),
    vibration: bool(rs.vibration, true),
  };
  const bindings = structuredClone(DEFAULT_BINDINGS);
  const rb = (r.bindings ?? {}) as Record<string, unknown>;
  for (const a of ACTIONS) {
    const v = strs(rb[a]);
    if (v.length) bindings[a] = v.slice(0, 3);
  }
  const tunings = strs(r.unlockedTunings).filter(isTuningId);
  return {
    schemaVersion: SCHEMA_VERSION,
    discoveredBossIds: strs(r.discoveredBossIds),
    completedBossIds: strs(r.completedBossIds),
    unlockedRegions: strs(r.unlockedRegions),
    unlockedTunings: tunings,
    equippedTunings: strs(r.equippedTunings).filter(isTuningId).filter((t) => tunings.includes(t)).slice(0, 2),
    finalGateUnlocked: bool(r.finalGateUnlocked, false),
    endingSeen: bool(r.endingSeen, false),
    bossBestTimes: recNum(r.bossBestTimes),
    bossDeathCounts: recNum(r.bossDeathCounts),
    fullClearBestTime: typeof r.fullClearBestTime === 'number' && Number.isFinite(r.fullClearBestTime) ? r.fullClearBestTime : null,
    storyTime: num(r.storyTime, 0, 0),
    flags: strs(r.flags),
    lastArea: typeof r.lastArea === 'string' ? r.lastArea : 'hub',
    lastSpawn: typeof r.lastSpawn === 'string' ? r.lastSpawn : 'default',
    settings,
    bindings,
  };
}

export interface Storage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export class SaveStore {
  data: SaveData;
  private readonly storage: Storage | null;
  lastError = '';

  constructor(storage: Storage | null) {
    this.storage = storage;
    this.data = this.load() ?? newSave();
  }

  hasProgress(): boolean {
    return this.exists() && (this.data.flags.length > 0 || this.data.discoveredBossIds.length > 0);
  }

  exists(): boolean {
    try {
      return !!this.storage?.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  load(): SaveData | null {
    try {
      const s = this.storage?.getItem(SAVE_KEY);
      if (!s) return null;
      return sanitize(JSON.parse(s));
    } catch (e) {
      this.lastError = String(e);
      return null;
    }
  }

  write(): boolean {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      this.lastError = String(e);
      return false;
    }
  }

  reset(): void {
    this.data = newSave({ settings: this.data.settings, bindings: this.data.bindings });
    this.write();
  }
}
