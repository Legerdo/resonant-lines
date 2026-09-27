// Software pixel layer (640x360, palette-exact). Used for everything geometric that must stay crisp: links,
// pulses, telegraphs, rings, debug geometry. No anti-aliasing, no alpha blending: each write is one palette colour.
import { PALETTE_ABGR } from './art/palette.ts';

export const VIEW_W = 640;
export const VIEW_H = 360;

export class PixelLayer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img: ImageData;
  private readonly buf: Uint32Array;
  dirty = true;
  /** camera offset (integer world px) subtracted from every world coordinate */
  ox = 0;
  oy = 0;
  readonly w: number;
  readonly h: number;

  constructor(w = VIEW_W, h = VIEW_H) {
    this.w = w;
    this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.img = ctx.createImageData(w, h);
    this.buf = new Uint32Array(this.img.data.buffer);
  }

  clear(): void {
    this.buf.fill(0);
    this.dirty = true;
  }

  /** world-space pixel */
  px(x: number, y: number, c: number): void {
    const sx = Math.round(x) - this.ox;
    const sy = Math.round(y) - this.oy;
    if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) return;
    this.buf[sy * this.w + sx] = PALETTE_ABGR[c]!;
  }

  /** screen-space pixel */
  spx(sx: number, sy: number, c: number): void {
    if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) return;
    this.buf[sy * this.w + sx] = PALETTE_ABGR[c]!;
  }

  /**
   * Bresenham line in world space. `pattern(i, len)` returns a palette index or -1 (skip) per step, which is how
   * stepped/dashed/signature-coded lines are drawn without any sub-pixel blending.
   */
  line(x0: number, y0: number, x1: number, y1: number, pattern: number | ((i: number, n: number) => number)): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const tx = Math.round(x1);
    const ty = Math.round(y1);
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;
    const n = Math.max(dx, -dy);
    for (let i = 0; ; i++) {
      const c = typeof pattern === 'number' ? pattern : pattern(i, n);
      if (c >= 0) this.px(x, y, c);
      if (x === tx && y === ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** points along a line (for pixel-exact offsets such as parallel strands) */
  linePoints(x0: number, y0: number, x1: number, y1: number): [number, number][] {
    const out: [number, number][] = [];
    let x = Math.round(x0);
    let y = Math.round(y0);
    const tx = Math.round(x1);
    const ty = Math.round(y1);
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      out.push([x, y]);
      if (x === tx && y === ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
    return out;
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    for (let yy = y0; yy < y0 + Math.round(h); yy++) for (let xx = x0; xx < x0 + Math.round(w); xx++) this.px(xx, yy, c);
  }

  /** filled disc; dither 0 = solid, 1 = checker (50%), 2 = sparse (25%) — ordered, not random */
  disc(cx: number, cy: number, r: number, c: number, dither = 0, phase = 0): void {
    const x0 = Math.round(cx);
    const y0 = Math.round(cy);
    const R = Math.max(0, Math.round(r));
    const rr = (R + 0.5) * (R + 0.5);
    for (let y = -R; y <= R; y++) {
      for (let x = -R; x <= R; x++) {
        if (x * x + y * y > rr) continue;
        const wx = x0 + x;
        const wy = y0 + y;
        if (dither === 1 && ((wx + wy + phase) & 1) !== 0) continue;
        if (dither === 2 && (((wx & 1) !== 0) || (((wy + phase) & 1) !== 0))) continue;
        this.px(wx, wy, c);
      }
    }
  }

  /** 1px circle outline (midpoint), optional dash period */
  ring(cx: number, cy: number, r: number, c: number, dash = 0, phase = 0, arc?: { ang: number; half: number }): void {
    const R = Math.round(r);
    if (R <= 0) {
      this.px(cx, cy, c);
      return;
    }
    const x0 = Math.round(cx);
    const y0 = Math.round(cy);
    // walk the circumference in ~1px angular steps so dashes and arcs are stable
    const steps = Math.max(8, Math.ceil(2 * Math.PI * R));
    let lastX = NaN;
    let lastY = NaN;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      if (arc) {
        let d = a - arc.ang;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) > arc.half) continue;
      }
      if (dash > 0 && Math.floor((i + phase) / dash) % 2 === 1) continue;
      const x = x0 + Math.round(Math.cos(a) * R);
      const y = y0 + Math.round(Math.sin(a) * R);
      if (x === lastX && y === lastY) continue;
      lastX = x;
      lastY = y;
      this.px(x, y, c);
    }
  }

  flush(): void {
    if (!this.dirty) return;
    this.ctx.putImageData(this.img, 0, 0);
    this.dirty = false;
  }

  markDirty(): void {
    this.dirty = true;
  }
}
