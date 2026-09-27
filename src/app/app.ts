// Application orchestrator: screens, area/arena lifecycle, save boundaries, audio, input routing.
import type Phaser from 'phaser';
import { FixedStepClock, DT } from '../core/clock/fixedStep.ts';
import { Sim } from '../core/sim/sim.ts';
import type { SimEvent, InputFrame } from '../core/sim/types.ts';
import type { Vec } from '../core/math/vec.ts';
import { AssetIndex } from '../presentation/assets.ts';
import { WorldRenderer, type RenderSettings } from '../presentation/worldRenderer.ts';
import { VIEW_W, VIEW_H } from '../presentation/pixelLayer.ts';
import { InputManager, DEFAULT_BINDINGS, type Action } from '../input/input.ts';
import { AudioEngine } from '../audio/audio.ts';
import { SaveStore, type SaveData } from '../save/save.ts';
import { UI, type UiHost } from '../ui/ui.ts';
import { initUiArt, refreshIcons } from '../ui/uiArt.ts';
import { t } from '../localization/ko.ts';
import { areaById } from '../world/areas/index.ts';
import type { AreaDef } from '../world/areaTypes.ts';
import { MechanismLogic } from '../world/interactables/mechanisms.ts';
import { BOSS_ENTRIES, STORY_BOSSES, bossEntry, isBossImplemented } from '../bosses/registry.ts';
import { completeBoss, discoverBoss, flagsOf, recordDeath, setFlag, storyBossesDone, FINAL_GATE_REQUIRED } from '../progression/progress.ts';
import { MAX_EQUIPPED_TUNINGS, type TuningId } from '../progression/tunings.ts';
import { noDebug, type DebugFlags } from '../debug/debugDraw.ts';
import { tutorialHint } from '../world/checkpoints/tutorial.ts';
import { isEmbedded } from '../resonance/needle.ts';

export type Mode = 'boot' | 'title' | 'play' | 'ending';
export type RunMode = 'story' | 'replay' | 'rush';

interface Transition {
  t: number;
  area: string;
  spawn: string;
  done: boolean;
}

export class App implements UiHost {
  readonly store: SaveStore;
  readonly input: InputManager;
  readonly audio = new AudioEngine();
  readonly ui: UI;
  renderer: WorldRenderer | null = null;
  assets: AssetIndex | null = null;
  scene: Phaser.Scene | null = null;
  sim: Sim | null = null;
  mode: Mode = 'boot';
  run: RunMode = 'story';
  rushQueue: string[] = [];
  rushTime = 0;
  areaId = 'hub';
  spawn = 'default';
  paused = false;
  readonly clock = new FixedStepClock(8);
  turbo = 1;
  zoom = 2;
  dpr = 1;
  deathT = -1;
  victoryT = -1;
  victoryShown = false;
  private victoryInfo: { firstClear: boolean; tuning: TuningId | null; newBest: boolean; gateOpened: boolean; time: number } | null = null;
  private transition: Transition | null = null;
  debug: DebugFlags = noDebug();
  readonly debugEnabled: boolean;
  invulnerable = false;
  fps = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  frameTimes: number[] = [];
  seed = 1;
  private lastHint = '';
  /** F4 debug: recent collision events with their sub-tick t */
  private collisionLog: string[] = [];
  ticksRun = 0;
  /** test hook: bot supplying input frames */
  bot: ((sim: Sim) => InputFrame) | null = null;
  /** test hook: called right after a new Sim is built (before its first tick) */
  onSimBuilt: ((areaId: string) => void) | null = null;
  /** test hook: called before every sim tick with the input about to be applied */
  tickHook: ((sim: Sim, input: InputFrame) => void) | null = null;
  private readonly viewport: HTMLElement;

  constructor(viewport: HTMLElement, uiRoot: HTMLElement, stage: HTMLElement, storage: Storage | null, debugEnabled: boolean) {
    this.viewport = viewport;
    this.debugEnabled = debugEnabled;
    this.store = new SaveStore(storage);
    this.ui = new UI(uiRoot, this);
    this.input = new InputManager(stage, (cx, cy) => {
      const r = viewport.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * VIEW_W, y: ((cy - r.top) / r.height) * VIEW_H };
    });
    this.input.onKey = (code, e) => this.onKey(code, e);
    this.input.onPadButton = (b) => this.onPad(b);
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('resize', () => this.layout());
    document.addEventListener('fullscreenchange', () => this.layout());
    this.applySettings();
    this.layout();
  }

  // ---------------------------------------------------------------- boot / layout
  ready(scene: Phaser.Scene, assets: AssetIndex): void {
    this.scene = scene;
    this.assets = assets;
    this.renderer = new WorldRenderer(scene, assets);
    initUiArt(assets, (key) => (scene.textures.exists(key) ? (scene.textures.get(key).getSourceImage() as HTMLImageElement) : null));
    refreshIcons();
    this.toTitle();
  }

  /**
   * Integer zoom measured in *device* pixels, and a device-pixel-aligned origin, so every world pixel is an exact
   * zoom x zoom square of physical pixels at any window size or devicePixelRatio (no half-pixel centring blur).
   */
  layout(): void {
    const dpr = window.devicePixelRatio || 1;
    const devW = Math.floor(window.innerWidth * dpr);
    const devH = Math.floor(window.innerHeight * dpr);
    this.zoom = Math.max(1, Math.floor(Math.min(devW / VIEW_W, devH / VIEW_H)));
    this.dpr = dpr;
    const vs = this.viewport.style;
    vs.width = `${(VIEW_W * this.zoom) / dpr}px`;
    vs.height = `${(VIEW_H * this.zoom) / dpr}px`;
    vs.left = `${Math.max(0, Math.floor((devW - VIEW_W * this.zoom) / 2)) / dpr}px`;
    vs.top = `${Math.max(0, Math.floor((devH - VIEW_H * this.zoom) / 2)) / dpr}px`;
    const s = this.store.data.settings;
    const root = document.documentElement.style;
    root.setProperty('--z', String(this.zoom / dpr));
    root.setProperty('--ui', String(s.uiScale));
    root.setProperty('--ps', String(Math.max(1, Math.round(this.zoom * s.uiScale)) / dpr));
  }

  get settings() {
    return this.store.data.settings;
  }

  save(): SaveData {
    return this.store.data;
  }

  applySettings(): void {
    const s = this.store.data.settings;
    this.audio.setVolumes({ master: s.volume.master, music: s.volume.music, boss: s.volume.boss, resonance: s.volume.resonance, impact: s.volume.impact, environment: s.volume.environment, ui: s.volume.ui });
    this.input.deadzone = s.deadzone;
    this.input.aimSensitivity = s.aimSensitivity;
    this.input.vibration = s.vibration;
    this.input.bindings = structuredClone(this.store.data.bindings);
    this.clock.timeScale = s.slowMode ? 0.7 : 1;
    this.layout();
    this.store.write();
  }

  rebind(action: Action, code: string): void {
    const b = this.store.data.bindings;
    for (const a of Object.keys(b) as Action[]) b[a] = b[a].filter((c) => c !== code || a === action);
    b[action] = [code, ...b[action].filter((c) => c !== code)].slice(0, 2);
    this.applySettings();
  }

  resetBindings(): void {
    this.store.data.bindings = structuredClone(DEFAULT_BINDINGS);
    this.applySettings();
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  sfx(name: string): void {
    this.audio.sfx(name);
  }

  debugAllowed(): boolean {
    return this.debugEnabled;
  }

  // ---------------------------------------------------------------- flows
  toTitle(): void {
    this.persistPosition();
    this.mode = 'title';
    this.paused = false;
    this.run = 'story';
    this.ui.setHudVisible(false);
    this.ui.setHint(null);
    this.ui.setPrompt(null);
    this.buildSim('hub', 'center');
    if (this.renderer) this.renderer.hidePlayer = true;
    this.audio.setMusic('title');
    this.ui.showTitle();
  }

  newGame(): void {
    this.store.reset();
    this.applySettings();
    this.startPlay('hub', 'default');
  }

  continueGame(): void {
    const d = this.store.data;
    const area = areaById(d.lastArea) && areaById(d.lastArea)!.kind !== 'arena' ? d.lastArea : 'hub';
    this.startPlay(area, area === d.lastArea ? d.lastSpawn : 'center');
  }

  private startPlay(area: string, spawn: string): void {
    this.mode = 'play';
    this.paused = false;
    this.ui.hideScreen();
    if (this.renderer) this.renderer.hidePlayer = false;
    this.ui.setHudVisible(true);
    this.enterArea(area, spawn, true);
  }

  resume(): void {
    this.paused = false;
    this.ui.hideScreen();
    this.input.clearAll();
  }

  closeMenu(): void {
    this.paused = false;
    this.ui.hideScreen();
    this.input.clearAll();
  }

  canRetry(): boolean {
    return !!this.sim?.boss;
  }

  retry(): void {
    if (!this.sim?.boss) return;
    this.paused = false;
    this.ui.hideScreen();
    this.buildSim(this.areaId, this.spawn);
  }

  toHub(): void {
    this.paused = false;
    this.ui.hideScreen();
    if (this.mode !== 'play') this.startPlay('hub', 'center');
    else this.beginTransition('hub', this.run === 'story' && this.areaId !== 'hub' ? 'center' : 'center');
    this.run = 'story';
  }

  replayBoss(id: string): void {
    const e = bossEntry(id);
    if (!e || !isBossImplemented(id)) return;
    this.run = 'replay';
    this.ui.hideScreen();
    this.paused = false;
    this.beginTransition(e.areaId, 'default');
  }

  bossRush(): void {
    this.run = 'rush';
    this.rushQueue = [...STORY_BOSSES, 'FINAL'].filter((id) => isBossImplemented(id) && areaById(bossEntry(id)!.areaId));
    this.rushTime = 0;
    this.ui.hideScreen();
    this.paused = false;
    const first = this.rushQueue.shift();
    if (first) this.beginTransition(bossEntry(first)!.areaId, 'default');
  }

  toggleTuning(id: TuningId): void {
    const d = this.store.data;
    if (!d.unlockedTunings.includes(id)) return;
    if (d.equippedTunings.includes(id)) d.equippedTunings = d.equippedTunings.filter((x) => x !== id);
    else if (d.equippedTunings.length < MAX_EQUIPPED_TUNINGS) d.equippedTunings.push(id);
    this.store.write(); // save boundary: tuning change
  }

  endingDone(): void {
    this.toTitle();
  }

  // ---------------------------------------------------------------- areas
  private beginTransition(area: string, spawn: string): void {
    if (this.transition) return;
    this.transition = { t: 0, area, spawn, done: false };
    this.ui.setFade(true);
    this.input.clearAll();
  }

  enterArea(areaId: string, spawn: string, instant = false): void {
    if (instant) {
      this.buildSim(areaId, spawn);
      return;
    }
    this.beginTransition(areaId, spawn);
  }

  private buildSim(areaId: string, spawn: string): void {
    const def: AreaDef | undefined = areaById(areaId);
    if (!def) return;
    this.areaId = areaId;
    this.spawn = spawn;
    this.deathT = -1;
    this.victoryT = -1;
    this.victoryShown = false;
    this.victoryInfo = null;
    const d = this.store.data;
    const flags = flagsOf(d);
    let boss = null;
    if (def.bossId && this.mode === 'play') {
      const entry = bossEntry(def.bossId);
      boss = entry ? entry.create() : null;
      if (boss && discoverBoss(d, def.bossId)) this.store.write(); // save boundary: boss discovered
    }
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0 || 1;
    this.sim = new Sim({
      area: def,
      seed: def.bossId ? 0x5eed + (def.bossId.charCodeAt(1) ?? 0) : this.seed,
      flags,
      tunings: d.equippedTunings,
      spawn,
      boss,
      logic: boss ? null : new MechanismLogic(),
      invulnerable: this.invulnerable,
    });
    this.clock.reset();
    this.renderer?.setArea(def, flags, def.decor ?? []);
    this.input.clearAll();
    this.onSimBuilt?.(areaId);
    if (this.mode === 'play') {
      this.audio.setMusic(def.bossId ? bossEntry(def.bossId)?.music ?? 'none' : def.music);
      if (def.bossId) {
        this.ui.showBossCard(t(`boss.${def.bossId}`));
        this.ui.hud.setArea('');
      } else this.ui.hud.setArea(t(def.nameKey));
      if (def.kind !== 'arena') {
        d.lastArea = def.id;
        d.lastSpawn = spawn;
        this.store.write(); // checkpoint: entering a hub/region room (never inside a fight)
      }
    }
  }

  private persistPosition(): void {
    if (this.mode === 'play') this.store.write();
  }

  // ---------------------------------------------------------------- main loop
  frame(dt: number): void {
    const t0 = performance.now();
    this.input.pollPad();
    this.ui.tick(dt);
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsN / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    if (this.transition) this.stepTransition(dt);
    const sim = this.sim;
    // the victory card is an overlay: the world keeps running (defeat animation, needles returning, auto-continue)
    const blocking = this.ui.menuOpen && this.ui.screen !== 'victory';
    if (sim && this.mode === 'play' && !this.paused && !this.transition && !blocking) {
      const ticks = this.clock.advance(dt) * this.turbo;
      for (let i = 0; i < ticks; i++) {
        const frame = this.bot ? this.bot(sim) : this.input.consumeFrame(sim.player.pos, (v: Vec) => this.renderer?.screenToWorld(v.x, v.y) ?? v);
        this.tickHook?.(sim, frame);
        const events = sim.step(frame);
        this.ticksRun++;
        if (this.run === 'story' && !sim.fight) this.store.data.storyTime += DT;
        if (this.run === 'story' && sim.fight && sim.fight.result === 'ongoing') this.store.data.storyTime += DT;
        if (this.run === 'rush' && sim.fight?.result === 'ongoing') this.rushTime += DT;
        this.handleEvents(sim, events);
        this.audio.onEvents(events, (x) => ((x - (this.renderer?.cam.x ?? 0)) / VIEW_W) * 2 - 1);
        if (this.transition || this.sim !== sim) break;
      }
      this.updateTimers(sim, dt);
    } else if (sim && this.mode === 'title') {
      // attract mode: the hub keeps breathing behind the title
      const n = this.clock.advance(dt);
      for (let i = 0; i < n; i++) sim.step(this.input.consumeFrame(sim.player.pos, (v) => v));
    }
    const rs: RenderSettings = { shake: this.settings.shake, highContrast: this.settings.highContrast, flash: this.settings.flash, debug: this.debug };
    this.renderer?.render(this.sim, dt, rs);
    if (this.sim && this.mode === 'play') {
      this.audio.updateHums(this.sim.links);
      this.ui.hud.update(this.sim);
      this.updateHints(this.sim);
      if (this.debug.boss || this.debug.step || this.debug.links || this.debug.capture) this.updateDebugPanel(this.sim);
    } else this.audio.silenceHums();
    this.frameTimes.push(performance.now() - t0);
    if (this.frameTimes.length > 600) this.frameTimes.shift();
  }

  private stepTransition(dt: number): void {
    const tr = this.transition!;
    tr.t += dt;
    if (!tr.done && tr.t >= 0.2) {
      tr.done = true;
      this.buildSim(tr.area, tr.spawn);
      this.ui.setFade(false);
    }
    if (tr.t >= 0.4) this.transition = null;
  }

  private updateTimers(sim: Sim, dt: number): void {
    const f = sim.fight;
    if (f?.result === 'defeat') {
      if (this.deathT < 0) this.deathT = 0;
      this.deathT += dt;
      if (this.deathT >= 0.75 && this.ui.screen !== 'death') this.ui.showDeath(f.deathCause);
    }
    if (f?.result === 'victory') {
      if (this.victoryT < 0) this.victoryT = 0;
      this.victoryT += dt * this.turbo;
      if (this.victoryT >= 2.0 && !this.victoryShown && this.victoryInfo) {
        this.victoryShown = true;
        this.ui.showVictory(f.bossId, this.victoryInfo.time, this.victoryInfo.newBest, this.victoryInfo.tuning, this.victoryInfo.gateOpened);
      }
      if (this.victoryT >= 4.6) this.finishVictory(f.bossId);
    }
  }

  private finishVictory(bossId: string): void {
    this.victoryT = -1;
    this.ui.hideScreen();
    if (bossId === 'FINAL' && this.run === 'story') {
      this.startEnding();
      return;
    }
    if (this.run === 'rush') {
      const next = this.rushQueue.shift();
      if (next) {
        this.beginTransition(bossEntry(next)!.areaId, 'default');
        return;
      }
      const prev = this.store.data.bossBestTimes.RUSH;
      if (prev === undefined || this.rushTime < prev) this.store.data.bossBestTimes.RUSH = Math.round(this.rushTime * 100) / 100;
      this.store.write();
      this.ui.toast(t('rush.result'), `${Math.floor(this.rushTime / 60)}:${(this.rushTime % 60).toFixed(2).padStart(5, '0')}`, 4);
      this.run = 'story';
      this.beginTransition('hub', 'center');
      return;
    }
    if (this.run === 'replay') {
      this.run = 'story';
      this.beginTransition('hub', 'center');
      return;
    }
    const e = bossEntry(bossId);
    const region = e?.region ?? 'hub';
    this.beginTransition(region === 'heart' ? 'hub' : region, `from${bossId}`);
  }

  private startEnding(): void {
    const d = this.store.data;
    const first = !d.endingSeen;
    d.endingSeen = true;
    if (first || d.fullClearBestTime === null || d.storyTime < d.fullClearBestTime) {
      if (d.fullClearBestTime === null || d.storyTime < d.fullClearBestTime) d.fullClearBestTime = Math.round(d.storyTime * 100) / 100;
    }
    d.lastArea = 'hub';
    d.lastSpawn = 'center';
    this.store.write(); // save boundary: ending
    this.mode = 'ending';
    setFlag(d, 'heartRestarted');
    this.store.write();
    this.ui.setHudVisible(false);
    this.ui.setHint(null);
    this.buildSim('hub', 'center');
    if (this.renderer) this.renderer.hidePlayer = true;
    this.audio.setMusic('ending');
    this.ui.showEnding();
  }

  private handleEvents(sim: Sim, events: readonly SimEvent[]): void {
    const d = this.store.data;
    for (const e of events) {
      if (this.debug.capture && e.t !== undefined) {
        // F4: sub-tick collision time of captures / overloads / needle hits (continuous collision, §16)
        this.collisionLog.push(`${sim.tick} ${e.type} ${e.link ?? e.needle ?? ''} ${e.sig ?? e.id ?? ''} t=${e.t.toFixed(3)}`);
        if (this.collisionLog.length > 6) this.collisionLog.shift();
      }
      switch (e.type) {
        case 'exit': {
          const [to, spawn] = (e.text ?? '').split('|');
          if (!to) break;
          const def = areaById(to);
          const bossId = def?.bossId;
          if (!def || (bossId && !isBossImplemented(bossId))) {
            this.ui.toast(t('hint.locked'), '', 1.4);
            this.pushBack(sim);
            break;
          }
          this.beginTransition(to, spawn ?? 'default');
          break;
        }
        case 'exitLocked': {
          const sub = e.id === 'toHeart' ? t('heart.need', { n: storyBossesDone(d) }) : '';
          this.ui.toast(t(e.text ?? 'hint.locked'), sub, 2.2);
          this.sfx('uiBack');
          break;
        }
        case 'interact': {
          const it = sim.area.interactables.find((x) => x.id === e.id);
          if (!it) break;
          this.input.clearAll();
          if (it.kind === 'altar') this.ui.showTuning();
          else if (it.kind === 'records' || it.kind === 'replay') this.ui.showRecords(true);
          else if (it.kind === 'mural' && it.textKey) this.ui.toast(t(it.textKey), '', 3.2);
          break;
        }
        case 'doorOpened':
          if (e.text && setFlag(d, e.text)) {
            if (e.text === 'tutorialDone') {
              for (const r of ['garden', 'belfry', 'quarry', 'marsh']) if (!d.unlockedRegions.includes(r)) d.unlockedRegions.push(r);
              this.ui.toast(t('tutorial.done'), t('tutorial.controls'), 3.8);
            }
            this.store.write(); // save boundary: region unlock / puzzle
          }
          break;
        case 'playerDied':
          if (sim.boss) {
            recordDeath(d, sim.boss.id);
            this.store.write();
          }
          this.input.rumble(300, 0.8);
          break;
        case 'playerHit':
          this.input.rumble(140, 0.5);
          break;
        case 'bossVictory': {
          const f = sim.fight!;
          const r = completeBoss(d, f.bossId, f.elapsed);
          this.victoryInfo = { ...r, time: f.elapsed };
          if (this.run !== 'story') this.victoryInfo.tuning = r.tuning;
          this.store.write(); // save boundary: boss defeated
          break;
        }
        default:
          break;
      }
    }
  }

  /** bounce the player back from a sealed exit */
  private pushBack(sim: Sim): void {
    const p = sim.player;
    const c = { x: sim.area.tiles[0]!.length * 8, y: sim.area.tiles.length * 8 };
    const dx = c.x - p.pos.x;
    const dy = c.y - p.pos.y;
    const l = Math.hypot(dx, dy) || 1;
    p.pos = { x: p.pos.x + (dx / l) * 18, y: p.pos.y + (dy / l) * 18 };
  }

  private updateHints(sim: Sim): void {
    let hint: string | null = null;
    if (sim.boss && sim.fight && sim.fight.result !== 'defeat' && sim.fight.result !== 'victory') {
      const charged = sim.links.some((l) => l.valid && (l.state === 'Charged' || l.state === 'Overloaded'));
      const linked = sim.links.some((l) => l.valid);
      hint = charged
        ? sim.boss.coreExposed ? t('hint.bossFinish') : t('hint.bossPulse')
        : linked ? t('hint.bossWait') : t('hint.bossNeedle');
    } else if (sim.area.id === 'hub' && !sim.flags.has('tutorialDone')) hint = tutorialHint(sim);
    this.ui.setHint(hint);
    let prompt: string | null = null;
    if (!sim.fight) {
      const p = sim.player.pos;
      const it = sim.area.interactables.find((x) => (p.x - x.pos.x) ** 2 + (p.y - x.pos.y) ** 2 <= x.r * x.r);
      if (it) prompt = t('hint.interact');
    }
    this.ui.setPrompt(prompt);
    if (hint !== this.lastHint) this.lastHint = hint ?? '';
  }

  private updateDebugPanel(sim: Sim): void {
    const lines: string[] = [];
    if (this.debug.step) lines.push(`tick ${sim.tick}  fps ${this.fps.toFixed(0)}  turbo ${this.turbo}  acc ${this.clock.alpha.toFixed(2)}`);
    if (this.debug.boss && sim.boss) {
      lines.push(`boss ${sim.boss.id} phase ${sim.boss.phase} core ${sim.boss.coreExposed}`);
      for (const [k, v] of Object.entries(sim.boss.debugInfo())) lines.push(`  ${k}: ${v}`);
      lines.push(`  seals ${sim.boss.seals.map((s) => `${s.id}:${s.broken ? 'X' : 'o'}`).join(' ')}`);
    }
    if (this.debug.links) {
      for (const n of sim.needles) lines.push(`${n.id} ${n.state} ${n.host?.shapeId ?? ''}`);
      for (const l of sim.links) lines.push(`${l.id} ${l.valid ? 'V' : '-'} ${l.state} ${l.sig ?? ''} ${l.blocked} ${l.length.toFixed(0)}`);
    }
    if (this.debug.capture) lines.push('collision t (tick event t):', ...this.collisionLog);
    this.ui.debugPanel.textContent = lines.join('\n');
  }

  // ---------------------------------------------------------------- keys
  private onKey(code: string, e: KeyboardEvent): void {
    if (this.ui.captureRebind(code)) return;
    if (this.mode === 'boot') return;
    if (this.debugEnabled && /^F\d$/.test(code)) {
      e.preventDefault();
      this.debugKey(code);
      return;
    }
    if (this.ui.menuOpen) {
      if (this.ui.screen === 'death') {
        if (code === 'KeyR' && this.deathT >= 0.3) this.retry();
        else if (code === 'Escape') this.toHub();
        return;
      }
      if (this.ui.screen === 'victory') {
        if (!e.repeat && (code === 'Enter' || code === 'Space' || code === 'KeyE') && this.sim?.fight) this.finishVictory(this.sim.fight.bossId);
        return;
      }
      const nav: Record<string, 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'> = {
        ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Space: 'ok', Escape: 'back',
      };
      const n = nav[code];
      if (n && !(this.mode === 'title' && n === 'back')) {
        e.preventDefault();
        this.ui.navigate(n);
      }
      return;
    }
    if (this.mode !== 'play') return;
    if (this.store.data.bindings.pause.includes(code) && !e.repeat) {
      if (this.sim?.fight?.result === 'defeat') return;
      this.paused = true;
      this.input.clearAll();
      this.ui.showPause();
      return;
    }
    if (code === 'KeyR' && this.sim?.fight?.result === 'defeat' && this.deathT >= 0.3) this.retry();
  }

  private onPad(b: number): void {
    if (this.ui.menuOpen) {
      const map: Record<number, 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'> = { 12: 'up', 13: 'down', 14: 'left', 15: 'right', 0: 'ok', 1: 'back' };
      if (this.ui.screen === 'death') {
        if (b === 0 || b === 3) this.retry();
        else if (b === 1) this.toHub();
        return;
      }
      const n = map[b];
      if (n) this.ui.navigate(n);
      return;
    }
    if (this.mode === 'play' && b === 9) {
      this.paused = true;
      this.input.clearAll();
      this.ui.showPause();
    }
  }

  private debugKey(code: string): void {
    const d = this.debug;
    switch (code) {
      case 'F1': d.hurtbox = !d.hurtbox; break;
      case 'F2': d.boss = !d.boss; break;
      case 'F3': d.links = !d.links; break;
      case 'F4': d.capture = !d.capture; break;
      case 'F5': d.pulse = !d.pulse; break;
      case 'F6': d.step = !d.step; break;
      case 'F7': if (this.sim) this.buildSim(this.areaId, this.spawn); break;
      case 'F8': {
        // cycle through implemented boss arenas
        const ids = BOSS_ENTRIES.filter((b) => isBossImplemented(b.id) && areaById(b.areaId)).map((b) => b.id);
        const cur = this.sim?.boss?.id;
        const next = ids[(ids.indexOf(cur ?? '') + 1) % ids.length];
        if (next) {
          if (this.mode !== 'play') this.startPlay(bossEntry(next)!.areaId, 'default');
          else this.beginTransition(bossEntry(next)!.areaId, 'default');
        }
        break;
      }
      case 'F9':
        this.invulnerable = !this.invulnerable;
        if (this.sim) this.sim.debug.invulnerable = this.invulnerable;
        this.ui.toast(this.invulnerable ? 'Shield debug: ON' : 'Shield debug: OFF', '', 1);
        break;
    }
    d.any = d.hurtbox || d.links || d.capture || d.pulse;
    this.ui.debugPanel.classList.toggle('hidden', !(d.boss || d.step || d.links || d.capture));
  }

  // ---------------------------------------------------------------- test/QA helpers
  snapshot() {
    const sim = this.sim;
    const d = this.store.data;
    return {
      mode: this.mode,
      run: this.run,
      paused: this.paused,
      screen: this.ui.screen,
      area: this.areaId,
      zoom: this.zoom,
      dpr: this.dpr,
      viewportRect: (() => {
        const r = this.viewport.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      })(),
      fps: this.fps,
      ticks: this.ticksRun,
      transition: !!this.transition,
      audio: this.audio.state,
      pad: this.input.pad,
      heldInputs: this.input.heldCount(),
      missingArt: this.assets ? [...this.assets.missing] : [],
      displayObjects: this.scene ? this.scene.children.list.length : 0,
      domNodes: document.getElementsByTagName('*').length,
      save: {
        completed: [...d.completedBossIds], discovered: [...d.discoveredBossIds], tunings: [...d.unlockedTunings], equipped: [...d.equippedTunings],
        finalGate: d.finalGateUnlocked, ending: d.endingSeen, flags: [...d.flags], best: { ...d.bossBestTimes }, deaths: { ...d.bossDeathCounts },
        fullClear: d.fullClearBestTime,
      },
      sim: sim
        ? {
            tick: sim.tick,
            boss: sim.boss ? { id: sim.boss.id, phase: sim.boss.phase, core: sim.boss.coreExposed, seals: sim.boss.seals.map((s) => s.broken), info: sim.boss.debugInfo() } : null,
            fight: sim.fight ? { result: sim.fight.result, elapsed: sim.fight.elapsed, cause: sim.fight.deathCause } : null,
            player: { x: sim.player.pos.x, y: sim.player.pos.y, shield: sim.player.shield, dead: sim.player.dead, selected: sim.player.selected },
            needles: sim.needles.map((n) => ({ id: n.id, state: n.state, x: n.pos.x, y: n.pos.y, host: n.host?.shapeId ?? null, embedded: isEmbedded(n) })),
            links: sim.links.map((l) => ({ id: l.id, valid: l.valid, state: l.state, sig: l.sig, blocked: l.blocked, length: l.length })),
            lattice: sim.lattice.formed,
            flags: [...sim.flags],
            log: sim.log.slice(-60),
            counts: { attacks: sim.attacks.length, pulses: sim.pulses.length, bodies: sim.bodies.length },
          }
        : null,
    };
  }

  finalGateProgress(): string {
    return `${storyBossesDone(this.store.data)}/${FINAL_GATE_REQUIRED}`;
  }
}
