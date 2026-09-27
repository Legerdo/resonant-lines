// Composes an area's static background from region tile sheets with neighbour rules.
// Collision edges (world/buildArea.ts) use the same solid/floor classification, so visuals never contradict geometry.
import { PALETTE_HEX } from './art/palette.ts';
import { type AreaDef, TILE, isSolidTile } from '../world/areaTypes.ts';
import { areaSize, tileAt } from '../world/buildArea.ts';

export const TILE_FRAMES = [
  'floor_0', 'floor_1', 'floor_2', 'floor_3', 'wallTop_0', 'wallTop_1', 'wallFace_0', 'wallFace_1', 'anchorFace',
  'anchorTopE', 'anchorTopW', 'anchorTopN', 'decal_0', 'decal_1', 'decal_2',
] as const;
type TileFrame = (typeof TILE_FRAMES)[number];
const FI = (name: TileFrame): number => TILE_FRAMES.indexOf(name);

export function regionTileKey(region: string): string {
  return region === 'heart' ? 'tiles_hub' : `tiles_${region}`;
}

function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// one-step darker partner used for contact shadows under north walls (palette exact)
const RGB_TO_INDEX = new Map<number, number>(PALETTE_HEX.map((h, i) => [h, i]));
const DARKER: number[] = [0, 0, 1, 2, 3, 4, 5, 6, 7, 9, 9, 10, 11, 12, 13, 15, 15, 16, 17, 18, 19, 21, 21, 22, 23, 24, 36, 36, 10, 28, 9, 30, 1, 32, 22, 34, 22];

function darkenRegion(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const hex = (d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!;
    const idx = RGB_TO_INDEX.get(hex);
    if (idx === undefined) continue;
    const dk = PALETTE_HEX[DARKER[idx] ?? idx]!;
    d[i] = (dk >> 16) & 255;
    d[i + 1] = (dk >> 8) & 255;
    d[i + 2] = dk & 255;
  }
  ctx.putImageData(img, x, y);
}

export interface DecorDef {
  x: number;
  y: number;
  frame: 'decal_0' | 'decal_1' | 'decal_2';
}

export interface ComposedArea {
  canvas: HTMLCanvasElement;
  /** world position of the canvas' top-left pixel (negative when the area is framed by surrounding rock) */
  ox: number;
  oy: number;
}

/**
 * Areas smaller than the view are framed by the region's own rock (wall-top tiles) instead of a flat void; the rock
 * darkens in palette steps toward the screen edge and every exit keeps a dark lane so openings still read as passages.
 */
export function composeArea(def: AreaDef, sheet: CanvasImageSource, decor: readonly DecorDef[] = [], view = { w: 640, h: 360 }): ComposedArea {
  const { w, h, cols, rows } = areaSize(def);
  const padX = w < view.w ? Math.ceil((view.w - w) / 2 / TILE) + 1 : 0;
  const padY = h < view.h ? Math.ceil((view.h - h) / 2 / TILE) + 1 : 0;
  const OX = padX * TILE;
  const OY = padY * TILE;
  const canvas = document.createElement('canvas');
  canvas.width = w + OX * 2;
  canvas.height = h + OY * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = `#${PALETTE_HEX[0].toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const draw = (frame: number, dx: number, dy: number) => ctx.drawImage(sheet, frame * TILE, 0, TILE, TILE, dx + OX, dy + OY, TILE, TILE);
  const darken = (x: number, y: number, ww: number, hh: number) => darkenRegion(ctx, x + OX, y + OY, ww, hh);
  const fillRect = (x: number, y: number, ww: number, hh: number) => ctx.fillRect(x + OX, y + OY, ww, hh);
  // surrounding rock
  if (padX || padY) {
    const lane = (x: number, y: number): boolean =>
      def.exits.some((ex) => {
        const r = ex.rect;
        const tx0 = Math.floor(r.x / TILE);
        const tx1 = Math.floor((r.x + r.w - 1) / TILE);
        const ty0 = Math.floor(r.y / TILE);
        const ty1 = Math.floor((r.y + r.h - 1) / TILE);
        if (r.y < 0 && y < 0) return x >= tx0 && x <= tx1;
        if (r.y + r.h > h && y >= rows) return x >= tx0 && x <= tx1;
        if (r.x < 0 && x < 0) return y >= ty0 && y <= ty1;
        if (r.x + r.w > w && x >= cols) return y >= ty0 && y <= ty1;
        return false;
      });
    for (let y = -padY; y < rows + padY; y++) {
      for (let x = -padX; x < cols + padX; x++) {
        if (x >= 0 && y >= 0 && x < cols && y < rows) continue;
        if (lane(x, y)) continue;
        draw(FI(hash(x + 999, y + 999, 5) % 2 === 0 ? 'wallTop_0' : 'wallTop_1'), x * TILE, y * TILE);
        const d = Math.max(x < 0 ? -x : x >= cols ? x - cols + 1 : 0, y < 0 ? -y : y >= rows ? y - rows + 1 : 0);
        for (let k = 2; k <= d; k += 2) darken(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }
  const hub = def.region === 'hub' || def.region === 'heart';
  const solid = (x: number, y: number) => isSolidTile(tileAt(def, x, y));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = tileAt(def, x, y) ?? ' ';
      const dx = x * TILE;
      const dy = y * TILE;
      if (ch === ' ') continue;
      if (!isSolidTile(ch)) {
        let f: TileFrame;
        if (ch === ',') f = 'floor_2';
        else if (hub) f = (['floor_0', 'floor_1', 'floor_2', 'floor_3'] as const)[(x & 1) + (y & 1) * 2]!;
        else {
          const r = hash(x, y) % 10;
          f = r < 5 ? 'floor_0' : r < 8 ? 'floor_1' : 'floor_3';
        }
        draw(FI(f), dx, dy);
        continue;
      }
      const floorBelow = y + 1 < rows && !solid(x, y + 1);
      if (ch === 'A') {
        if (floorBelow) draw(FI('anchorFace'), dx, dy);
        else if (x + 1 < cols && !solid(x + 1, y)) draw(FI('anchorTopE'), dx, dy);
        else if (x > 0 && !solid(x - 1, y)) draw(FI('anchorTopW'), dx, dy);
        else draw(FI('anchorTopN'), dx, dy);
        continue;
      }
      if (floorBelow) draw(FI(hash(x, y, 3) % 3 === 0 ? 'wallFace_1' : 'wallFace_0'), dx, dy);
      else draw(FI(hash(x, y, 5) % 2 === 0 ? 'wallTop_0' : 'wallTop_1'), dx, dy);
    }
  }
  // contact shadow on floor tiles under a north wall face (top 5 rows, stepped edge)
  for (let y = 1; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (solid(x, y) || !solid(x, y - 1) || tileAt(def, x, y - 1) === ' ') continue;
      darken(x * TILE, y * TILE, TILE, 4);
      for (let k = 0; k < TILE; k += 2) darken(x * TILE + k, y * TILE + 4, 1, 1);
    }
  }
  // rims where wall tops meet floor at the sides (ink edge line keeps silhouettes readable)
  ctx.fillStyle = '#0d0b14';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = tileAt(def, x, y);
      if (!isSolidTile(ch) || ch === ' ') continue;
      if (x + 1 < cols && !solid(x + 1, y)) fillRect(x * TILE + TILE - 1, y * TILE, 1, TILE);
      if (x > 0 && !solid(x - 1, y)) fillRect(x * TILE, y * TILE, 1, TILE);
      if (y > 0 && !solid(x, y - 1)) fillRect(x * TILE, y * TILE, TILE, 1);
    }
  }
  // meaningful debris: decals accumulate next to walls (rule-based, deterministic), plus hand-placed decor
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (solid(x, y) || tileAt(def, x, y) === ',') continue;
      const nearWall = solid(x - 1, y) || solid(x + 1, y) || solid(x, y + 1);
      const hv = hash(x, y, 11);
      // hub: only hairline cracks near walls (inlays are placed by hand as decor); regions: debris by the walls
      if (nearWall && hv % 5 === 0) draw(FI(hub ? 'decal_2' : hv % 2 === 0 ? 'decal_0' : 'decal_2'), x * TILE, y * TILE);
      else if (!hub && hv % 23 === 0) draw(FI('decal_1'), x * TILE, y * TILE);
    }
  }
  for (const d of decor) draw(FI(d.frame), Math.round(d.x), Math.round(d.y));
  return { canvas, ox: -OX, oy: -OY };
}
