// Palette-indexed pixel grid toolkit used by the art sources (art/source/**) and the exporter.
// Everything is integer and palette-exact: no anti-aliasing, no alpha blending.
import { OUTLINE_OF } from '../../src/presentation/art/palette.ts';

export const T = -1; // transparent

export interface Grid {
  w: number;
  h: number;
  px: Int16Array; // palette index or -1
}

export function grid(w: number, h: number, fill = T): Grid {
  const px = new Int16Array(w * h);
  px.fill(fill);
  return { w, h, px };
}

export function clone(g: Grid): Grid {
  return { w: g.w, h: g.h, px: new Int16Array(g.px) };
}

export function get(g: Grid, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return T;
  return g.px[y * g.w + x]!;
}

export function set(g: Grid, x: number, y: number, c: number): void {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  g.px[y * g.w + x] = c;
}

export type Legend = Record<string, number>;

/**
 * Parse ASCII rows into a grid. '.' and ' ' are transparent unless the legend overrides them.
 * Rows shorter than the width are padded with transparency. `ox/oy` offsets the drawing inside the canvas.
 */
export function parse(rows: readonly string[], legend: Legend, w?: number, h?: number, ox = 0, oy = 0): Grid {
  const width = w ?? Math.max(...rows.map((r) => r.length));
  const height = h ?? rows.length;
  const g = grid(width, height);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      let c: number | undefined = legend[ch];
      if (c === undefined) {
        if (ch === '.' || ch === ' ') continue;
        throw new Error(`unknown pixel char '${ch}' in row ${y}: ${row}`);
      }
      if (c === T) continue;
      set(g, x + ox, y + oy, c);
    }
  });
  return g;
}

/** Author the left half (including the centre column when odd) and mirror it to the right. */
export function mirrorX(half: Grid, fullWidth: number): Grid {
  const g = grid(fullWidth, half.h);
  for (let y = 0; y < half.h; y++) {
    for (let x = 0; x < half.w; x++) {
      const c = get(half, x, y);
      if (c === T) continue;
      set(g, x, y, c);
      set(g, fullWidth - 1 - x, y, c);
    }
  }
  return g;
}

export function flipX(src: Grid): Grid {
  const g = grid(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) set(g, src.w - 1 - x, y, get(src, x, y));
  return g;
}

/** Copy src onto dst at integer offset. Transparent source pixels are skipped. */
export function blit(dst: Grid, src: Grid, dx: number, dy: number, flip = false): Grid {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const c = get(src, flip ? src.w - 1 - x : x, y);
      if (c !== T) set(dst, dx + x, dy + y, c);
    }
  }
  return dst;
}

/** Replace colours via a mapping (palette-shift flash, region recolours of neutral props). */
export function remap(src: Grid, map: Record<number, number>): Grid {
  const g = clone(src);
  for (let i = 0; i < g.px.length; i++) {
    const c = g.px[i]!;
    if (c !== T && map[c] !== undefined) g.px[i] = map[c]!;
  }
  return g;
}

export function solidFill(src: Grid, color: number): Grid {
  const g = clone(src);
  for (let i = 0; i < g.px.length; i++) if (g.px[i] !== T) g.px[i] = color;
  return g;
}

/**
 * Selective outline: every transparent pixel 4-adjacent to an opaque pixel receives the outline partner of that
 * neighbour. Pixels whose only opaque neighbours lie below/right (i.e. the lit top-left rim) take a softer partner
 * so silhouettes are not wrapped in a mechanical uniform black line. Thickness is always exactly one pixel.
 */
export function outline(src: Grid, opts: { soften?: boolean; force?: number } = {}): Grid {
  const g = clone(src);
  const soften = opts.soften ?? true;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (get(src, x, y) !== T) continue;
      const below = get(src, x, y + 1);
      const right = get(src, x + 1, y);
      const above = get(src, x, y - 1);
      const left = get(src, x - 1, y);
      const n = [above, left, below, right].filter((c) => c !== T);
      if (n.length === 0) continue;
      if (opts.force !== undefined) {
        set(g, x, y, opts.force);
        continue;
      }
      // darkest partner among neighbours keeps contrast consistent
      let best = n[0]!;
      for (const c of n) if (OUTLINE_OF[c]! < OUTLINE_OF[best]!) best = c;
      let oc = OUTLINE_OF[best]!;
      const litOnly = above === T && left === T; // neighbours only below/right => we are on the lit rim
      if (soften && litOnly && oc === 0) oc = 1;
      set(g, x, y, oc);
    }
  }
  return g;
}

/** Bresenham line (inclusive). */
export function line(g: Grid, x0: number, y0: number, x1: number, y1: number, c: number): void {
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
    set(g, x, y, c);
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

export function rect(g: Grid, x: number, y: number, w: number, h: number, c: number): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(g, xx, yy, c);
}

/** Pixel-clean filled ellipse (midpoint style, symmetric staircase). */
export function ellipse(g: Grid, cx: number, cy: number, rx: number, ry: number, c: number): void {
  for (let y = -ry; y <= ry; y++) {
    const t = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
    if (t < 0) continue;
    const half = Math.floor(rx * Math.sqrt(t) + 0.5);
    for (let x = -half; x <= half; x++) set(g, cx + x, cy + y, c);
  }
}

/** Ring of pixels at radius r (one pixel thick, no gaps, no doubled corners). */
export function ring(g: Grid, cx: number, cy: number, r: number, c: number): void {
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    const pts = [
      [x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y],
    ];
    for (const [px, py] of pts) set(g, cx + px!, cy + py!, c);
    y++;
    if (err < 0) err += 2 * y + 1;
    else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
}

/** Count opaque pixels. */
export function opaqueCount(g: Grid): number {
  let n = 0;
  for (let i = 0; i < g.px.length; i++) if (g.px[i] !== T) n++;
  return n;
}

/**
 * Removes isolated single pixels of a colour that differs from all 4 neighbours when the neighbours agree on a
 * majority colour inside the same opaque region. Used after automatic shading to keep clusters clean (no 1px noise).
 */
export function cleanOrphans(src: Grid, protect: ReadonlySet<number> = new Set()): Grid {
  const g = clone(src);
  for (let y = 1; y < src.h - 1; y++) {
    for (let x = 1; x < src.w - 1; x++) {
      const c = get(src, x, y);
      if (c === T || protect.has(c)) continue;
      const n = [get(src, x, y - 1), get(src, x - 1, y), get(src, x + 1, y), get(src, x, y + 1)];
      if (n.some((k) => k === T || k === c)) continue;
      const counts = new Map<number, number>();
      for (const k of n) counts.set(k, (counts.get(k) ?? 0) + 1);
      let best = -1;
      let bestN = 0;
      for (const [k, cnt] of counts) if (cnt > bestN) {
        best = k;
        bestN = cnt;
      }
      if (bestN >= 3) set(g, x, y, best);
    }
  }
  return g;
}

export interface Material {
  ramp: readonly number[]; // dark -> light palette indices
  /** light bias in ramp steps (+ brighter) */
  bias?: number;
  /** 0..1 how strongly the pseudo-height bends the normal (low = flat slabs, high = rounded) */
  round?: number;
  /** add 1px specular highlight on strongly lit rim pixels */
  spec?: number;
  /** darken pixels bordering another region (crevice line) */
  crevice?: boolean;
}

/**
 * Deterministic directional-light shading of hand-authored region masks.
 * - mask chars map to materials; each region is shaded by a distance-field height -> normal -> light (top-left).
 * - values are quantized to the material ramp (hard bands = readable clusters, no dithering), orphans cleaned.
 * - crevices between regions are darkened so shapes read as separate masses.
 * The mask itself, band thresholds and all accents are authored per sprite; this only replaces manual flat fills.
 */
export function sculpt(mask: readonly string[], mats: Record<string, Material>, w?: number, h?: number): Grid {
  const width = w ?? Math.max(...mask.map((r) => r.length));
  const height = h ?? mask.length;
  const region = new Array<string>(width * height).fill('');
  for (let y = 0; y < height; y++) {
    const row = mask[y] ?? '';
    for (let x = 0; x < width; x++) {
      const ch = row[x] ?? '.';
      if (ch !== '.' && ch !== ' ') {
        if (!mats[ch]) throw new Error(`sculpt: unknown material '${ch}'`);
        region[y * width + x] = ch;
      }
    }
  }
  // distance to region boundary (chamfer 3-4), per region
  const dist = new Float32Array(width * height);
  const INF = 1e9;
  for (let i = 0; i < dist.length; i++) dist[i] = region[i] ? INF : 0;
  const same = (i: number, j: number) => region[i] !== '' && region[i] === region[j];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!region[i]) continue;
      const edge =
        x === 0 || y === 0 || x === width - 1 || y === height - 1 ||
        !same(i, i - 1) || !same(i, i + 1) || !same(i, i - width) || !same(i, i + width);
      if (edge) dist[i] = 1;
    }
  }
  const relax = (x: number, y: number, nx: number, ny: number, cost: number) => {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
    const i = y * width + x;
    const j = ny * width + nx;
    if (!same(i, j)) return;
    const v = dist[j]! + cost;
    if (v < dist[i]!) dist[i] = v;
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (!region[y * width + x]) continue;
      relax(x, y, x - 1, y, 1); relax(x, y, x, y - 1, 1); relax(x, y, x - 1, y - 1, 1.4); relax(x, y, x + 1, y - 1, 1.4);
    }
    for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
      if (!region[y * width + x]) continue;
      relax(x, y, x + 1, y, 1); relax(x, y, x, y + 1, 1); relax(x, y, x + 1, y + 1, 1.4); relax(x, y, x - 1, y + 1, 1.4);
    }
  }
  const out = grid(width, height);
  const lx = -0.62;
  const ly = -0.62;
  const lz = 0.48;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const r = region[i];
      if (!r) continue;
      const m = mats[r]!;
      const round = m.round ?? 0.6;
      const hgt = (xx: number, yy: number) => {
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) return 0;
        const j = yy * width + xx;
        if (region[j] !== r) return 0;
        return Math.sqrt(dist[j]!);
      };
      const gx = (hgt(x + 1, y) - hgt(x - 1, y)) * round;
      const gy = (hgt(x, y + 1) - hgt(x, y - 1)) * round;
      let nx = -gx;
      let ny = -gy;
      let nz = 1;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl; ny /= nl; nz /= nl;
      const lit = nx * lx + ny * ly + nz * lz; // ~ -0.3 .. 1
      const ramp = m.ramp;
      const steps = ramp.length;
      let k = Math.floor(((lit + 0.25) / 1.15) * steps + (m.bias ?? 0));
      k = Math.max(0, Math.min(steps - 1, k));
      let c = ramp[k]!;
      if (m.crevice) {
        const nb = [region[i - 1], region[i + 1], region[i - width], region[i + width]];
        if (nb.some((q) => q !== undefined && q !== '' && q !== r) && k > 0) c = ramp[Math.max(0, k - 2)]!;
      }
      if (m.spec !== undefined && lit > m.spec && dist[i]! <= 2) c = ramp[steps - 1]!;
      set(out, x, y, c);
    }
  }
  return cleanOrphans(out);
}

/** Overlay authored accent pixels (eyes, runes, cracks, specular clusters) on top of a base grid. */
export function accents(base: Grid, rows: readonly string[], legend: Legend, ox = 0, oy = 0): Grid {
  const acc = parse(rows, legend, base.w, base.h, ox, oy);
  return blit(clone(base), acc, 0, 0);
}
