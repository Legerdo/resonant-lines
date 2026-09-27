// Phaser bootstrap: 640x360 logical canvas, nearest sampling, integer pixel positions. Integer CSS zoom is applied
// by the app (no FIT scaling), so world pixels are always exact squares.
import Phaser from 'phaser';
import { AssetIndex, type Manifest } from './assets.ts';
import { VIEW_W, VIEW_H } from './pixelLayer.ts';

export interface SceneHooks {
  ready(scene: Phaser.Scene, assets: AssetIndex): void;
  frame(dtSeconds: number): void;
}

class MainScene extends Phaser.Scene {
  private hooks: SceneHooks;
  private started = false;

  constructor(hooks: SceneHooks) {
    super({ key: 'main' });
    this.hooks = hooks;
  }

  preload(): void {
    this.load.json('manifest', `assets/manifest.json?t=${Date.now()}`);
  }

  create(): void {
    const manifest = this.cache.json.get('manifest') as Manifest;
    for (const s of manifest.sheets) {
      this.load.spritesheet(s.key, `${s.url}?v=${manifest.hash}`, { frameWidth: s.cw, frameHeight: s.ch });
    }
    this.load.once('complete', () => {
      for (const s of manifest.sheets) this.textures.get(s.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      const assets = new AssetIndex(manifest);
      this.cameras.main.setRoundPixels(true);
      this.hooks.ready(this, assets);
      this.started = true;
    });
    this.load.start();
  }

  override update(_time: number, delta: number): void {
    if (this.started) this.hooks.frame(delta / 1000);
  }
}

export function createGame(parent: HTMLElement, hooks: SceneHooks): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_W,
    height: VIEW_H,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    backgroundColor: '#0d0b14',
    scale: { mode: Phaser.Scale.NONE, width: VIEW_W, height: VIEW_H },
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    banner: false,
    render: { preserveDrawingBuffer: true, antialias: false, antialiasGL: false, pixelArt: true, roundPixels: true },
    scene: [new MainScene(hooks)],
  });
}
