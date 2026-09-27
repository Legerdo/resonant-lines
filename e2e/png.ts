// Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced) for screenshot pixel analysis.
import { inflateSync } from 'node:zlib';

export interface Image {
  width: number;
  height: number;
  data: Uint8Array; // RGBA
}

export function decodePng(buf: Buffer): Image {
  let off = 8;
  let width = 0;
  let height = 0;
  let ctype = 6;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error('only 8-bit PNG supported');
      ctype = data[9]!;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const bpp = ctype === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp]! : 0;
      const b = prev[i]!;
      const c = i >= bpp ? prev[i - bpp]! : 0;
      let v = line[i]!;
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = cur[x * bpp]!;
      out[o + 1] = cur[x * bpp + 1]!;
      out[o + 2] = cur[x * bpp + 2]!;
      out[o + 3] = bpp === 4 ? cur[x * bpp + 3]! : 255;
    }
    prev.set(cur);
  }
  return { width, height, data: out };
}

export interface PixelReport {
  zoom: number;
  offPalette: number;
  nonUniformBlocks: number;
  blocks: number;
  colors: number;
}

/** Checks every zoom×zoom block of the viewport is a single palette colour (no blur / halo / bleeding / shimmer). */
export function analyse(img: Image, box: { x: number; y: number; w: number; h: number }, zoom: number, palette: Set<number>): PixelReport {
  let offPalette = 0;
  let nonUniform = 0;
  let blocks = 0;
  const colors = new Set<number>();
  const px = (x: number, y: number) => {
    const o = (y * img.width + x) * 4;
    return (img.data[o]! << 16) | (img.data[o + 1]! << 8) | img.data[o + 2]!;
  };
  for (let by = box.y; by + zoom <= box.y + box.h; by += zoom) {
    for (let bx = box.x; bx + zoom <= box.x + box.w; bx += zoom) {
      blocks++;
      const c = px(bx, by);
      colors.add(c);
      if (!palette.has(c)) offPalette++;
      let uniform = true;
      for (let yy = 0; yy < zoom && uniform; yy++) for (let xx = 0; xx < zoom; xx++) if (px(bx + xx, by + yy) !== c) {
        uniform = false;
        break;
      }
      if (!uniform) nonUniform++;
    }
  }
  return { zoom, offPalette, nonUniformBlocks: nonUniform, blocks, colors: colors.size };
}
