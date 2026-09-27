// window.__RESONANT__ — deterministic QA hooks for Playwright (enabled in dev or with ?e2e=1).
// Drives the game only through InputFrames (bots) or public app flows; never edits gameplay state directly,
// except explicit debug toggles that also exist in the F-key debug menu (F9 shield debug, F8 boss select).
import type Phaser from 'phaser';
import type { App } from '../app/app.ts';
import { makeBot, type AnyBot } from './bots/index.ts';
import { emptyInput, type InputFrame } from '../core/sim/types.ts';
import { traceLine } from './trace.ts';
import { dmathFingerprint } from '../core/math/dmathFingerprint.ts';

declare global {
  interface Window {
    __RESONANT__?: TestApi;
  }
}

export interface TestApi {
  ready: () => boolean;
  state: () => ReturnType<App['snapshot']>;
  turbo: (n: number) => void;
  invulnerable: (on: boolean) => void;
  bot: (name: string) => boolean;
  /** start bot `name` on the first tick of the next Sim built for `area` (entry by door, retry or enter) */
  armBot: (area: string, name: string) => boolean;
  /** per-tick state fingerprints (debug determinism checks); trace(false) stops and returns them */
  trace: (on: boolean) => string[];
  /** bit fingerprint of the deterministic sim math in this engine (must equal the Node value) */
  mathFingerprint: () => string;
  botDone: () => boolean;
  botLog: () => { name: string; log: string[]; failed: boolean } | null;
  stopBot: () => void;
  frames: (frames: Partial<InputFrame>[]) => void;
  newGame: () => void;
  continueGame: () => void;
  toTitle: () => void;
  enter: (area: string, spawn?: string) => void;
  retry: () => void;
  hideUi: (on: boolean) => void;
  perf: () => { avg: number; p99: number; fps: number };
  renderer: () => string;
  clearSave: () => void;
  debugFlags: (on: boolean) => void;
}

export function installTestApi(app: App, game: Phaser.Game): void {
  let current: AnyBot | null = null;
  let queue: Partial<InputFrame>[] = [];
  let traced: string[] = [];
  const api: TestApi = {
    ready: () => app.mode !== 'boot',
    state: () => app.snapshot(),
    turbo: (n) => (app.turbo = Math.max(1, Math.min(32, Math.floor(n)))),
    invulnerable: (on) => {
      app.invulnerable = on;
      if (app.sim) app.sim.debug.invulnerable = on;
    },
    bot: (name) => {
      const b = makeBot(name);
      if (!b) return false;
      current = b;
      queue = [];
      app.bot = (sim) => b.next(sim);
      return true;
    },
    armBot: (area, name) => {
      if (!makeBot(name)) return false;
      app.onSimBuilt = (built) => {
        if (built !== area) return;
        app.onSimBuilt = null;
        const b = makeBot(name)!;
        current = b;
        queue = [];
        app.bot = (sim) => b.next(sim);
      };
      return true;
    },
    mathFingerprint: () => dmathFingerprint(),
    trace: (on) => {
      if (!on) {
        app.tickHook = null;
        return traced;
      }
      traced = [];
      app.tickHook = (sim, input) => {
        if (traced.length < 20000) traced.push(traceLine(sim, input));
      };
      return traced;
    },
    botDone: () => (current ? current.done : queue.length === 0),
    botLog: () => (current ? { name: current.name, log: [...current.log], failed: !!(current as { failed?: boolean }).failed } : null),
    stopBot: () => {
      current = null;
      app.bot = null;
    },
    frames: (frames) => {
      queue = [...frames];
      current = null;
      app.bot = (sim) => {
        const next = queue.shift();
        if (!next) {
          app.bot = null;
          return emptyInput(sim.player.aim);
        }
        return { ...emptyInput(sim.player.aim), ...next };
      };
    },
    newGame: () => app.newGame(),
    continueGame: () => app.continueGame(),
    toTitle: () => app.toTitle(),
    enter: (area, spawn = 'default') => {
      if (app.mode !== 'play') {
        app.mode = 'play';
        app.ui.hideScreen();
        app.ui.setHudVisible(true);
        if (app.renderer) app.renderer.hidePlayer = false;
      }
      app.enterArea(area, spawn, true);
    },
    retry: () => app.retry(),
    hideUi: (on) => {
      const ui = document.getElementById('ui');
      if (ui) ui.style.visibility = on ? 'hidden' : 'visible';
    },
    perf: () => {
      const f = [...app.frameTimes].sort((a, b) => a - b);
      const avg = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length);
      return { avg, p99: f[Math.floor(f.length * 0.99)] ?? 0, fps: app.fps };
    },
    renderer: () => (game.renderer?.type === 2 ? 'webgl' : game.renderer?.type === 1 ? 'canvas' : String(game.renderer?.type)),
    clearSave: () => {
      localStorage.clear();
    },
    debugFlags: (on) => {
      app.debug.any = on;
      app.debug.hurtbox = on;
    },
  };
  window.__RESONANT__ = api;
}
