// Reads authoritative Sim state and draws it. Owns no gameplay state.
import Phaser from 'phaser';
import { P } from './art/palette.ts';
import { AssetIndex } from './assets.ts';
import { PixelLayer, VIEW_W, VIEW_H } from './pixelLayer.ts';
import { SpritePool } from './spritePool.ts';
import { Vfx } from './vfx.ts';
import { composeArea, regionTileKey, type DecorDef } from './tiles.ts';
import { drawLinks, drawPulses, drawPulsePreview, type LinkDrawOptions } from './links.ts';
import { drawAttack } from './attacks.ts';
import { drawProps } from './props.ts';
import { BOSS_VIEWS } from './bosses/index.ts';
import './bosses/all.ts';
import { ySort, type ViewCtx } from './bosses/types.ts';
import { drawDebug, type DebugFlags } from '../debug/debugDraw.ts';
import type { Sim } from '../core/sim/sim.ts';
import type { Vec } from '../core/math/vec.ts';
import type { AreaDef } from '../world/areaTypes.ts';
import { areaSize } from '../world/buildArea.ts';
import { isEmbedded } from '../resonance/needle.ts';

export interface RenderSettings {
  shake: number;
  highContrast: boolean;
  flash: boolean;
  debug: DebugFlags;
}

const dirIndex16 = (v: Vec): number => {
  const a = Math.atan2(v.y, v.x);
  return ((Math.round((a / (Math.PI * 2)) * 16) % 16) + 16) % 16;
};

type Facing = 'down' | 'up' | 'side' | 'left';
const facingOf = (v: Vec): Facing => (Math.abs(v.x) > Math.abs(v.y) * 1.05 ? (v.x > 0 ? 'side' : 'left') : v.y >= 0 ? 'down' : 'up');

export class WorldRenderer {
  readonly scene: Phaser.Scene;
  readonly assets: AssetIndex;
  readonly pool: SpritePool;
  readonly under = new PixelLayer();
  readonly over = new PixelLayer();
  readonly dbg = new PixelLayer();
  readonly vfx = new Vfx();
  private bg: Phaser.GameObjects.Image | null = null;
  private underTex: Phaser.Textures.CanvasTexture;
  private overTex: Phaser.Textures.CanvasTexture;
  private dbgTex: Phaser.Textures.CanvasTexture;
  private areaKey = '';
  area: AreaDef | null = null;
  areaW = VIEW_W;
  areaH = VIEW_H;
  cam = { x: 0, y: 0 };
  time = 0;
  frame = 0;
  hidePlayer = false;
  private animState = '';
  private animStart = 0;
  private lastSimTick = -1;

  constructor(scene: Phaser.Scene, assets: AssetIndex) {
    this.scene = scene;
    this.assets = assets;
    this.pool = new SpritePool(scene, assets);
    this.underTex = scene.textures.addCanvas('layer_under', this.under.canvas)!;
    this.overTex = scene.textures.addCanvas('layer_over', this.over.canvas)!;
    this.dbgTex = scene.textures.addCanvas('layer_dbg', this.dbg.canvas)!;
    scene.add.image(0, 0, 'layer_under').setOrigin(0, 0).setScrollFactor(0).setDepth(10);
    scene.add.image(0, 0, 'layer_over').setOrigin(0, 0).setScrollFactor(0).setDepth(100000);
    scene.add.image(0, 0, 'layer_dbg').setOrigin(0, 0).setScrollFactor(0).setDepth(100001);
  }

  setArea(def: AreaDef, flags: ReadonlySet<string>, decor: readonly DecorDef[] = []): void {
    const key = `bg_${def.id}_${[...flags].sort().join(',').length}_${decor.length}`;
    this.area = def;
    const { w, h } = areaSize(def);
    this.areaW = w;
    this.areaH = h;
    if (key === this.areaKey && this.bg) return;
    this.bg?.destroy();
    if (this.scene.textures.exists(this.areaKey)) this.scene.textures.remove(this.areaKey);
    const tileKey = regionTileKey(def.region);
    const src = this.scene.textures.get(tileKey).getSourceImage() as HTMLImageElement;
    const canvas = composeArea(def, src, decor);
    this.scene.textures.addCanvas(key, canvas);
    this.bg = this.scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
    this.areaKey = key;
  }

  screenToWorld(sx: number, sy: number): Vec {
    return { x: sx + this.cam.x, y: sy + this.cam.y };
  }

  private updateCamera(sim: Sim | null, settings: RenderSettings): void {
    let cx: number;
    let cy: number;
    const target = sim ? { x: Math.round(sim.player.pos.x), y: Math.round(sim.player.pos.y) - 8 } : { x: this.areaW / 2, y: this.areaH / 2 };
    if (this.areaW <= VIEW_W) cx = -Math.floor((VIEW_W - this.areaW) / 2);
    else cx = Math.max(0, Math.min(this.areaW - VIEW_W, target.x - VIEW_W / 2));
    if (this.areaH <= VIEW_H) cy = -Math.floor((VIEW_H - this.areaH) / 2);
    else cy = Math.max(0, Math.min(this.areaH - VIEW_H, target.y - VIEW_H / 2));
    const s = this.vfx.shakeOffset(settings.shake);
    this.cam.x = Math.round(cx) + s.x;
    this.cam.y = Math.round(cy) + s.y;
    const cam = this.scene.cameras.main;
    cam.setScroll(this.cam.x, this.cam.y);
    for (const l of [this.under, this.over, this.dbg]) {
      l.ox = this.cam.x;
      l.oy = this.cam.y;
    }
  }

  render(sim: Sim | null, dt: number, settings: RenderSettings): void {
    this.time += dt;
    this.frame++;
    if (sim && sim.tick !== this.lastSimTick) {
      this.vfx.onEvents(sim.events);
      this.lastSimTick = sim.tick;
    }
    this.vfx.update(dt);
    this.updateCamera(sim, settings);
    this.under.clear();
    this.over.clear();
    this.dbg.clear();
    this.pool.begin();
    const opts: LinkDrawOptions = { time: this.time, frame: this.frame, highContrast: settings.highContrast, flash: settings.flash };
    if (sim) {
      const ctx: ViewCtx = { scene: this.scene, assets: this.assets, pool: this.pool, under: this.under, over: this.over, sim, time: this.time, frame: this.frame, opts };
      drawProps(ctx);
      if (sim.boss) BOSS_VIEWS[sim.boss.id]?.(ctx);
      for (const a of sim.attacks) drawAttack(this.under, this.over, a, opts);
      drawLinks(this.over, sim, opts);
      drawPulses(this.over, sim, opts);
      drawPulsePreview(this.over, sim, opts);
      this.drawNeedles(sim);
      if (!this.hidePlayer) this.drawPlayer(sim);
      if (settings.debug.any) drawDebug(this.dbg, sim, settings.debug);
    }
    this.drawBursts();
    this.vfx.drawParticles(this.over);
    this.pool.end();
    this.under.flush();
    this.over.flush();
    this.dbg.flush();
    this.underTex.refresh();
    this.overTex.refresh();
    this.dbgTex.refresh();
  }

  private drawNeedles(sim: Sim): void {
    const sel = sim.player.selected;
    sim.needles.forEach((n, i) => {
      if (n.state === 'Held') return;
      const lit = isEmbedded(n) && sim.links.some((l) => l.valid && (l.a === n.id || l.b === n.id));
      let frame: string;
      let depth = ySort(n.pos.y + 2);
      if (n.state === 'Flying' || n.state === 'Returning') {
        frame = `fly_${dirIndex16(n.dir)}`;
        depth = 90000;
      } else if (n.state === 'Disabled') frame = `dis_${dirIndex16(n.dir)}`;
      else frame = `${lit ? 'embLit' : 'emb'}_${dirIndex16(n.normal)}`;
      this.pool.draw('needle', frame, n.pos.x, n.pos.y, depth);
      if (n.state !== 'Returning') this.pool.draw('fx', `${i === sel ? 'tagSel' : 'tag'}_${n.id}`, n.pos.x, n.pos.y - 11, 90001);
      if (n.state === 'Returning') {
        // stepped trail back to the hand
        const d = Math.hypot(n.dir.x, n.dir.y) || 1;
        this.over.line(n.pos.x - (n.dir.x / d) * 10, n.pos.y - (n.dir.y / d) * 10, n.pos.x, n.pos.y, (k) => (k % 2 === 0 ? P.resoDeep : -1));
      }
    });
  }

  private drawPlayer(sim: Sim): void {
    const p = sim.player;
    const aimF = facingOf(p.aimDir);
    const moveF = facingOf(p.facing);
    let anim: string;
    let face: Facing = moveF;
    if (p.dead) anim = 'p_death';
    else if (p.pulseAnim > 0 || sim.pendingPulse) anim = 'p_pulse';
    else if (p.recallAnim > 0) anim = 'p_recall';
    else if (p.throwAnim > 0) {
      face = aimF;
      anim = `p_throw_${face}`;
    } else if (p.dash.active) anim = `p_dash_${moveF}`;
    else if (p.moving) anim = `p_walk_${moveF}`;
    else {
      face = aimF;
      anim = `p_idle_${face}`;
    }
    if (anim !== this.animState) {
      this.animState = anim;
      this.animStart = this.time;
    }
    const ms = (this.time - this.animStart) * 1000;
    let { frame } = this.assets.animFrame(anim, ms);
    const held = sim.needles.filter((n) => n.state === 'Held').length;
    if (anim === 'p_idle_up' && held < 3) frame = this.assets.frame('player', `idle_up_held${held}`);
    // afterimages during Thread Step / dash
    if (p.dash.active && this.frame % 3 === 0) this.vfx.ghosts.push({ x: p.pos.x, y: p.pos.y, frame, flip: false, life: 0.18 });
    for (const g of this.vfx.ghosts) this.pool.draw('player_ghost', g.frame, g.x, g.y, ySort(g.y) - 1);
    const blink = p.invuln > 0 && !p.dead && Math.floor(this.time * 20) % 2 === 0;
    const sheet = p.hitFlash > 0.18 && !p.dead ? 'player_flash' : 'player';
    if (!blink) this.pool.draw(sheet, frame, p.pos.x, p.pos.y, ySort(p.pos.y));
    // aim reticle: 4 pixels on the aim ray (pixel layer, geometry only)
    if (!p.dead) {
      const a = p.aimDir;
      for (let k = 0; k < 3; k++) this.over.px(p.pos.x + a.x * (14 + k * 4), p.pos.y - 8 + a.y * (14 + k * 4), k === 2 ? P.resoLite : P.resoDeep);
    }
  }

  private drawBursts(): void {
    for (const b of this.vfx.bursts) {
      const f = this.assets.animFrame(b.anim, b.t);
      if (!f.done) this.pool.draw(f.sheet, f.frame, b.x, b.y, 95000);
    }
  }
}
