import Phaser from 'phaser';
import type { AssetIndex } from './assets.ts';

/** Per-frame immediate-mode sprite drawing on top of retained Phaser Images (no per-frame allocation). */
export class SpritePool {
  private readonly scene: Phaser.Scene;
  private readonly assets: AssetIndex;
  private items: Phaser.GameObjects.Image[] = [];
  private used = 0;

  constructor(scene: Phaser.Scene, assets: AssetIndex) {
    this.scene = scene;
    this.assets = assets;
  }

  begin(): void {
    this.used = 0;
  }

  /** Draw frame `frame` of `sheet` with its pivot at integer world position (x, y). */
  draw(sheet: string, frame: number | string, x: number, y: number, depth: number, flipX = false): Phaser.GameObjects.Image | null {
    const s = this.assets.sheet(sheet);
    if (!s) return null;
    const idx = typeof frame === 'number' ? frame : this.assets.frame(sheet, frame);
    let img = this.items[this.used];
    if (!img) {
      img = this.scene.add.image(0, 0, sheet, idx);
      this.items.push(img);
    }
    this.used++;
    if (img.texture.key !== sheet) img.setTexture(sheet, idx);
    else if (img.frame.name !== String(idx) && img.frame.name !== (idx as unknown as string)) img.setFrame(idx);
    img.setOrigin(s.pivot.x / s.cw, s.pivot.y / s.ch);
    img.setPosition(Math.round(x), Math.round(y));
    img.setDepth(depth);
    img.setFlipX(flipX);
    img.setVisible(true);
    return img;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i]!.setVisible(false);
  }

  get count(): number {
    return this.used;
  }

  destroy(): void {
    for (const i of this.items) i.destroy();
    this.items = [];
  }
}
