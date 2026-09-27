// Mask construction helpers for large sprites: authored shapes (ellipses, polygons, thick strokes) painted into a
// char mask that `sculpt` then shades. Shapes are placed by hand per pose; nothing is random.
export class Mask {
  readonly w: number;
  readonly h: number;
  readonly c: string[];
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.c = new Array<string>(w * h).fill('.');
  }
  put(x: number, y: number, ch: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.c[y * this.w + x] = ch;
  }
  get(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '.';
    return this.c[y * this.w + x]!;
  }
  ellipse(ch: string, cx: number, cy: number, rx: number, ry: number, only?: string): this {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / (rx + 0.25);
        const dy = (y + 0.5 - cy) / (ry + 0.25);
        if (dx * dx + dy * dy <= 1 && (!only || only.includes(this.get(x, y)))) this.put(x, y, ch);
      }
    }
    return this;
  }
  rect(ch: string, x: number, y: number, w: number, h: number): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.put(xx, yy, ch);
    return this;
  }
  poly(ch: string, pts: [number, number][]): this {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i]!;
        const [x1, y1] = pts[(i + 1) % pts.length]!;
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k]! - 0.5); x <= Math.floor(xs[k + 1]! - 0.5); x++) this.put(x, y, ch);
    }
    return this;
  }
  /** thick stroke along a polyline with per-point radius */
  stroke(ch: string, pts: [number, number, number][]): this {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0, r0] = pts[i]!;
      const [x1, y1, r1] = pts[i + 1]!;
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        this.ellipse(ch, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t, r0 + (r1 - r0) * t);
      }
    }
    return this;
  }
  rows(): string[] {
    const out: string[] = [];
    for (let y = 0; y < this.h; y++) out.push(this.c.slice(y * this.w, (y + 1) * this.w).join(''));
    return out;
  }
}
