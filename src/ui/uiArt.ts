// Extracts pixel-art UI frames/icons from the exported sheets into data URLs for CSS (integer scaled, pixelated).
import type { AssetIndex } from '../presentation/assets.ts';

const icons = new Map<string, string>();

function crop(img: CanvasImageSource, sx: number, sy: number, w: number, h: number): string {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  return c.toDataURL('image/png');
}

export function initUiArt(assets: AssetIndex, imageOf: (key: string) => CanvasImageSource | null): void {
  const frames = assets.sheet('ui_frames');
  const fimg = imageOf('ui_frames');
  if (frames && fimg) {
    for (let i = 0; i < frames.count; i++) {
      const url = crop(fimg, (i % frames.cols) * frames.cw, Math.floor(i / frames.cols) * frames.ch, frames.cw, frames.ch);
      document.documentElement.style.setProperty(`--frame-${i}`, `url(${url})`);
    }
  }
  const ic = assets.sheet('ui_icons');
  const iimg = imageOf('ui_icons');
  if (ic && iimg) {
    for (const [name, idx] of Object.entries(ic.frames)) {
      icons.set(name, crop(iimg, (idx % ic.cols) * ic.cw, Math.floor(idx / ic.cols) * ic.ch, ic.cw, ic.ch));
    }
  }
}

export function icon(name: string, extra = ''): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = `icon ${extra}`.trim();
  const url = icons.get(name);
  if (url) s.style.backgroundImage = `url(${url})`;
  s.dataset.icon = name;
  return s;
}

export function setIcon(s: HTMLElement, name: string): void {
  if (s.dataset.icon === name && s.style.backgroundImage) return;
  const url = icons.get(name);
  if (url) s.style.backgroundImage = `url(${url})`;
  s.dataset.icon = name;
}

/** icons created before the sheets finished loading get their pixels now */
export function refreshIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.icon[data-icon]').forEach((s) => {
    const url = icons.get(s.dataset.icon!);
    if (url) s.style.backgroundImage = `url(${url})`;
  });
}
