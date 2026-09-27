// Converts the tile map + props of an AreaDef into collision bodies. Collision edges are exactly the visual tile
// boundaries between solid and floor tiles, so what you see is what needles hit.
import { makeBody, seg, circle } from '../core/sim/bodies.ts';
import type { Body, CircleShape, Shape, SurfaceTag } from '../core/sim/types.ts';
import { type AreaDef, TILE, isSolidTile, tileTag } from './areaTypes.ts';

interface Edge {
  side: 'N' | 'S' | 'E' | 'W';
  line: number;
  from: number;
  to: number;
  tag: SurfaceTag;
}

export function areaSize(def: AreaDef): { w: number; h: number; cols: number; rows: number } {
  const rows = def.tiles.length;
  const cols = Math.max(...def.tiles.map((r) => r.length));
  return { w: cols * TILE, h: rows * TILE, cols, rows };
}

export function tileAt(def: AreaDef, cx: number, cy: number): string | undefined {
  const row = def.tiles[cy];
  if (row === undefined) return undefined;
  return row[cx];
}

export function buildWorldBody(def: AreaDef, flags: ReadonlySet<string>): Body {
  const { cols, rows } = areaSize(def);
  const edges: Edge[] = [];
  const solidAt = (x: number, y: number) => isSolidTile(tileAt(def, x, y));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = tileAt(def, x, y) ?? ' ';
      if (!isSolidTile(ch)) continue;
      const tag = tileTag(ch);
      // the edge normal points toward the open (floor) neighbour
      if (!solidAt(x, y + 1) && y + 1 < rows) edges.push({ side: 'S', line: (y + 1) * TILE, from: x * TILE, to: (x + 1) * TILE, tag });
      if (!solidAt(x, y - 1) && y - 1 >= 0) edges.push({ side: 'N', line: y * TILE, from: x * TILE, to: (x + 1) * TILE, tag });
      if (!solidAt(x + 1, y) && x + 1 < cols) edges.push({ side: 'E', line: (x + 1) * TILE, from: y * TILE, to: (y + 1) * TILE, tag });
      if (!solidAt(x - 1, y) && x - 1 >= 0) edges.push({ side: 'W', line: x * TILE, from: y * TILE, to: (y + 1) * TILE, tag });
    }
  }
  // merge collinear neighbours with the same tag
  edges.sort((a, b) => (a.side < b.side ? -1 : a.side > b.side ? 1 : a.line - b.line || a.from - b.from));
  const merged: Edge[] = [];
  for (const e of edges) {
    const last = merged[merged.length - 1];
    if (last && last.side === e.side && last.line === e.line && last.tag === e.tag && last.to === e.from) last.to = e.to;
    else merged.push({ ...e });
  }
  const shapes: Shape[] = [];
  merged.forEach((e, i) => {
    const id = `w${i}`;
    switch (e.side) {
      case 'S':
        shapes.push(seg(id, { x: e.from, y: e.line }, { x: e.to, y: e.line }, { x: 0, y: 1 }, e.tag));
        break;
      case 'N':
        shapes.push(seg(id, { x: e.from, y: e.line }, { x: e.to, y: e.line }, { x: 0, y: -1 }, e.tag));
        break;
      case 'E':
        shapes.push(seg(id, { x: e.line, y: e.from }, { x: e.line, y: e.to }, { x: 1, y: 0 }, e.tag));
        break;
      case 'W':
        shapes.push(seg(id, { x: e.line, y: e.from }, { x: e.line, y: e.to }, { x: -1, y: 0 }, e.tag));
        break;
    }
  });
  for (const p of def.props) {
    if (p.r === undefined) continue;
    if (p.ifFlag && !flags.has(p.ifFlag)) continue;
    if (p.unlessFlag && flags.has(p.unlessFlag)) continue;
    const opts: Partial<CircleShape> = { blocksLink: p.blocksLink ?? false, blocksMove: p.blocksMove ?? true, blocksNeedle: p.blocksNeedle ?? true };
    if (p.receiver !== undefined) opts.receiver = p.receiver;
    shapes.push(circle(`p:${p.id}`, { ...p.pos }, p.r, p.tag ?? 'NonAnchorable', opts));
  }
  // sealed exits become solid, non-anchorable barriers
  for (const ex of def.exits) {
    if (!ex.requires || flags.has(ex.requires)) continue;
    const r = ex.rect;
    const pts = [
      { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h },
    ];
    const ns = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
    for (let i = 0; i < 4; i++) shapes.push(seg(`x:${ex.id}:${i}`, pts[i]!, pts[(i + 1) % 4]!, ns[i]!, 'NonAnchorable'));
  }
  return makeBody('world', 'world', { x: 0, y: 0 }, shapes);
}
