// E06 Production: production build(vite preview)에서 boot/input/audio/save/reload/resize/fullscreen/gamepad smoke.
// A20: the same dist/ served by a plain static HTTP file server (no Vite) under a sub-path.
import { test, expect, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { freshBoot, boot, state, waitArea, waitFor, turbo, runBot, shot, trackErrors, writeEvidence } from './helpers.ts';
import { DMATH_GOLDEN as GOLDEN } from '../tests/fixtures/dmathGolden.ts';

interface FakePad {
  id: string;
  index: number;
  connected: boolean;
  mapping: string;
  timestamp: number;
  axes: number[];
  buttons: { pressed: boolean; touched: boolean; value: number }[];
}

async function playerX(page: Page): Promise<number> {
  return (await state(page)).sim!.player.x;
}

test('E06 production smoke: boot, input, audio unlock, gamepad, focus loss, save/reload, resize, fullscreen', async ({ page }) => {
  const errors = trackErrors(page);
  // virtual standard gamepad (the Gamepad API cannot be driven headlessly otherwise)
  await page.addInitScript(() => {
    const pad = {
      id: 'E2E Virtual Pad (STANDARD GAMEPAD)', index: 0, connected: false, mapping: 'standard', timestamp: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    (window as unknown as { __pad: typeof pad }).__pad = pad;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad.connected ? pad : null, null, null, null] });
  });
  const pad = (fn: (p: FakePad) => void) => page.evaluate(`(${fn.toString()})(window.__pad)`);
  const ev: Record<string, unknown> = {};

  // boot
  await freshBoot(page);
  ev.renderer = await page.evaluate(() => window.__RESONANT__!.renderer());
  expect(ev.renderer).toBe('webgl');
  // A15 across engines: the sim's math is bit-identical to the Node unit-test run
  ev.mathFingerprint = await page.evaluate(() => window.__RESONANT__!.mathFingerprint());
  expect(ev.mathFingerprint).toBe(GOLDEN);
  const canvas = await page.evaluate(() => {
    const c = document.querySelector('#stage canvas') as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return { w: c.width, h: c.height, cssW: r.width, cssH: r.height, x: r.x, y: r.y, rendering: getComputedStyle(c).imageRendering };
  });
  expect(canvas).toMatchObject({ w: 640, h: 360, cssW: 1280, cssH: 720, rendering: 'pixelated' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(page).toHaveTitle('공명선: 봉인된 심장');

  // audio: no context before a gesture, running after the first click
  let s = await state(page);
  expect(s.audio).toBe('none');
  await page.getByRole('button', { name: '새 게임' }).click();
  await waitArea(page, 'hub');
  await waitFor(page, `window.__RESONANT__.state().audio === 'running'`, 10_000);
  ev.audioAfterClick = (await state(page)).audio;

  // keyboard movement (real key events through the InputManager)
  await page.waitForTimeout(300);
  const x0 = await playerX(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(450);
  s = await state(page);
  expect(s.heldInputs).toBeGreaterThanOrEqual(1);
  // focus loss while a key is held clears every held input (A18) and the player stops
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  s = await state(page);
  expect(s.heldInputs).toBe(0);
  const x1 = s.sim!.player.x;
  expect(x1).toBeGreaterThan(x0 + 10);
  await page.waitForTimeout(400);
  const x2 = await playerX(page);
  expect(Math.abs(x2 - x1)).toBeLessThan(3); // no stuck key after blur (only residual velocity)
  await page.keyboard.up('KeyD');
  ev.keyboard = { x0, x1, x2 };

  // mouse: left click throws the selected needle toward the cursor
  const vp = s.viewportRect;
  await page.mouse.move(vp.x + vp.w * 0.3, vp.y + vp.h * 0.75);
  await page.mouse.down({ button: 'left' });
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(500);
  s = await state(page);
  expect(s.sim!.needles.filter((n) => n.state !== 'Held').length).toBe(1);
  await page.keyboard.press('KeyR'); // recall all
  await page.waitForTimeout(700);
  s = await state(page);
  expect(s.sim!.needles.every((n) => n.state === 'Held')).toBe(true);

  // gamepad: connect, left stick moves, Start pauses, B resumes
  await pad((p) => (p.connected = true));
  await waitFor(page, `window.__RESONANT__.state().pad.connected === true`, 5_000);
  const gx0 = await playerX(page);
  await pad((p) => (p.axes[0] = -1));
  await page.waitForTimeout(450);
  await pad((p) => (p.axes[0] = 0));
  const gx1 = await playerX(page);
  expect(gx1).toBeLessThan(gx0 - 10);
  await pad((p) => (p.buttons[9]!.pressed = true));
  await waitFor(page, `window.__RESONANT__.state().screen === 'pause'`, 5_000);
  await pad((p) => (p.buttons[9]!.pressed = false));
  await shot(page, 'e06-01-pause-menu');
  await page.waitForTimeout(100);
  await pad((p) => (p.buttons[1]!.pressed = true));
  await waitFor(page, `window.__RESONANT__.state().screen === 'none' || window.__RESONANT__.state().screen === null || window.__RESONANT__.state().paused === false`, 5_000);
  await pad((p) => (p.buttons[1]!.pressed = false));
  s = await state(page);
  expect(s.paused).toBe(false);
  ev.gamepad = { id: s.pad.id, gx0, gx1 };
  await pad((p) => (p.connected = false));

  // save → reload → continue
  await turbo(page, 4);
  await runBot(page, 'hub');
  await turbo(page, 1);
  s = await state(page);
  expect(s.save.flags).toContain('tutorialDone');
  const stored = await page.evaluate(() => localStorage.getItem('resonant-lines/save'));
  expect(stored).toBeTruthy();
  await boot(page);
  await expect(page.getByRole('button', { name: '이어하기' })).toBeEnabled();
  await page.getByRole('button', { name: '이어하기' }).click();
  await waitArea(page, 'hub');
  s = await state(page);
  expect(s.save.flags).toContain('tutorialDone');
  expect(s.sim!.flags).toContain('tutorialDone');

  // resize: integer zoom, device-pixel aligned origin, no drift after returning to the original size
  const sizes: [number, number, number][] = [[1920, 1080, 3], [800, 600, 1], [1366, 768, 2], [2560, 1440, 4], [1281, 721, 2], [1280, 720, 2]];
  const geo: unknown[] = [];
  for (const [w, h, z] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await waitFor(page, `window.__RESONANT__.state().zoom === ${z}`, 5_000);
    await page.waitForTimeout(100);
    s = await state(page);
    const r = s.viewportRect;
    geo.push({ w, h, zoom: s.zoom, rect: r });
    expect(r.w).toBe(640 * z);
    expect(r.h).toBe(360 * z);
    expect(Number.isInteger(r.x) && Number.isInteger(r.y)).toBe(true);
    expect(r.x).toBe(Math.floor((w - 640 * z) / 2));
    expect(r.y).toBe(Math.floor((h - 360 * z) / 2));
  }
  expect(s.viewportRect).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  ev.resize = geo;

  // fullscreen request from the settings menu (headless may refuse; either way no error and layout stays integer)
  await page.keyboard.press('Escape');
  await waitFor(page, `window.__RESONANT__.state().screen === 'pause'`, 5_000);
  await page.locator('button[data-id="settings"]').click();
  await page.locator('button[data-id="fullscreen"]').click();
  await page.waitForTimeout(600);
  const fs = await page.evaluate(() => !!document.fullscreenElement);
  s = await state(page);
  expect(Number.isInteger(s.zoom)).toBe(true);
  if (fs) {
    await page.evaluate(() => document.exitFullscreen());
    await page.waitForTimeout(400);
  }
  ev.fullscreenEntered = fs;
  await page.locator('button[data-id="back"]').click();
  await page.locator('button[data-id="resume"]').click();
  s = await state(page);
  expect(s.paused).toBe(false);
  expect(s.zoom).toBe(2);
  await shot(page, 'e06-02-after-resize-fullscreen');

  writeEvidence('e06', ev);
  expect(errors).toEqual([]);
});

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json',
};

test('A20 dist/ on a plain static HTTP server under a sub-path: boot, new game, save, reload, continue', async ({ page }) => {
  const errors = trackErrors(page);
  // minimal static file server: GET only, files under dist/, no SPA fallback, no Vite
  const root = resolve('dist');
  const prefix = '/games/resonant-lines/';
  const served: string[] = [];
  const failed: string[] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const deny = (code: number) => {
      failed.push(`${code} ${url.pathname}`);
      res.writeHead(code);
      res.end();
    };
    if (req.method !== 'GET' || !url.pathname.startsWith(prefix)) return deny(404);
    const rel = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    const file = normalize(join(root, rel));
    if (!file.startsWith(root + sep)) return deny(403);
    readFile(file).then(
      (body) => {
        served.push(rel);
        res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
        res.end(body);
      },
      () => deny(404),
    );
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}${prefix}`;
  try {
    await page.goto(`${base}?e2e=1`);
    await page.waitForFunction(() => window.__RESONANT__?.ready(), undefined, { timeout: 30_000 });
    await page.evaluate(() => window.__RESONANT__!.clearSave());
    await page.goto(`${base}?e2e=1`);
    await page.waitForFunction(() => window.__RESONANT__?.ready(), undefined, { timeout: 30_000 });
    let s = await state(page);
    expect(s.missingArt).toEqual([]);
    await expect(page.locator('.title-logo')).toHaveText('공명선');
    await page.getByRole('button', { name: '새 게임' }).click();
    await waitArea(page, 'hub');
    // play the tutorial device (a save boundary), then reload the page from the static server
    await turbo(page, 4);
    await runBot(page, 'hub');
    await turbo(page, 1);
    s = await state(page);
    expect(s.save.flags).toContain('tutorialDone');
    await page.goto(`${base}?e2e=1`);
    await page.waitForFunction(() => window.__RESONANT__?.ready(), undefined, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: '이어하기' })).toBeEnabled();
    await page.getByRole('button', { name: '이어하기' }).click();
    await waitArea(page, 'hub');
    s = await state(page);
    expect(s.sim?.flags).toContain('tutorialDone');
    expect(await page.evaluate(() => window.__RESONANT__!.renderer())).toBe('webgl');
  } finally {
    await page.goto('about:blank');
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
  writeEvidence('a20-static', { base, served: [...new Set(served)].sort(), failed });
  expect(failed).toEqual([]);
  expect(served).toEqual(expect.arrayContaining(['index.html', 'assets/manifest.json']));
  expect(served.some((f) => f.endsWith('.js'))).toBe(true);
  expect(errors).toEqual([]);
});
