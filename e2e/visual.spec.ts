// A21/A22/A23 visual QA against the production bundle.
//  - pixel exactness: with the DOM UI hidden, every zoom x zoom block of the game viewport must be ONE colour and
//    that colour must belong to the master palette (no blur, halo, bilinear bleeding, sub-pixel shimmer, off-palette).
//  - gallery: every region and every boss mid-fight, UI visible, saved for human review.
import { test, expect, type Page } from '@playwright/test';
import { freshBoot, state, waitArea, turbo, runBot, trackErrors, writeEvidence, EVIDENCE } from './helpers.ts';
import { decodePng, analyse, type PixelReport } from './png.ts';
import { PALETTE_HEX } from '../src/presentation/art/palette.ts';

const PALETTE = new Set<number>(PALETTE_HEX);

async function pixelCheck(page: Page, name: string): Promise<PixelReport> {
  const s = await state(page);
  const r = s.viewportRect;
  await page.evaluate(() => window.__RESONANT__!.hideUi(true));
  const buf = await page.screenshot({ clip: { x: r.x, y: r.y, width: r.w, height: r.h }, path: `${EVIDENCE}/px-${name}.png` });
  await page.evaluate(() => window.__RESONANT__!.hideUi(false));
  const img = decodePng(buf);
  return analyse(img, { x: 0, y: 0, w: img.width, h: img.height }, s.zoom, PALETTE);
}

/** start a story save with the tutorial done so every region gate is open */
async function storySave(page: Page): Promise<void> {
  await freshBoot(page);
  await page.getByRole('button', { name: '새 게임' }).click();
  await waitArea(page, 'hub');
  await turbo(page, 4);
  await runBot(page, 'hub');
  await turbo(page, 1);
}

/** enter a boss arena and let its fixture bot play for `secs` of sim time (shield debug on: this is a render check) */
async function midFight(page: Page, id: string, secs: number): Promise<void> {
  await page.evaluate((a) => window.__RESONANT__!.enter(a, 'default'), `arena_${id}`);
  await waitArea(page, `arena_${id}`);
  await page.evaluate(() => window.__RESONANT__!.invulnerable(true));
  await turbo(page, 4);
  await page.evaluate((b) => window.__RESONANT__!.bot(b), id);
  const t0 = (await state(page)).sim!.tick;
  await page.waitForFunction(
    ([t, n]) => {
      const s = window.__RESONANT__!.state();
      return !s.sim || s.sim.tick - t >= n || s.sim.fight?.result === 'victory';
    },
    [t0, secs * 60] as const,
    { timeout: 60_000, polling: 50 },
  );
  await turbo(page, 1);
}

test('A21 pixel-exact rendering at 640x360, 1280x720, 1920x1080, 2560x1440', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = trackErrors(page);
  await storySave(page);
  const results: Record<string, PixelReport> = {};
  const sizes: [number, number, number][] = [[640, 360, 1], [1280, 720, 2], [1920, 1080, 3], [2560, 1440, 4]];
  for (const [w, h, z] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForFunction((zz) => window.__RESONANT__!.state().zoom === zz, z);
    // hub (tiles, props, decals, lamps)
    await page.evaluate(() => window.__RESONANT__!.enter('hub', 'center'));
    await waitArea(page, 'hub');
    await page.waitForTimeout(250);
    results[`hub@${z}x`] = await pixelCheck(page, `hub-${z}x`);
    // B01 mid-fight (boss sprite, telegraphs, needles, links, capture/pulse VFX)
    await midFight(page, 'B01', 9);
    results[`B01@${z}x`] = await pixelCheck(page, `b01-${z}x`);
    await page.evaluate(() => window.__RESONANT__!.stopBot());
    // FINAL mid-fight (largest sprite, rotating circuit terminals)
    await midFight(page, 'FINAL', 6);
    results[`FINAL@${z}x`] = await pixelCheck(page, `final-${z}x`);
    await page.evaluate(() => window.__RESONANT__!.stopBot());
  }
  writeEvidence('a21-pixel-exactness', results);
  for (const [k, r] of Object.entries(results)) {
    expect(r.offPalette, `${k} off-palette blocks`).toBe(0);
    expect(r.nonUniformBlocks, `${k} non-uniform blocks (blur/bleed/sub-pixel)`).toBe(0);
    expect(r.colors, `${k} colour count`).toBeGreaterThan(8);
  }
  expect(errors).toEqual([]);
});

test('gallery: every region and boss renders final art (no missing/placeholder sheets)', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = trackErrors(page);
  await storySave(page);
  const report: Record<string, unknown> = {};
  for (const area of ['hub', 'garden', 'belfry', 'quarry', 'marsh']) {
    await page.evaluate((a) => window.__RESONANT__!.enter(a, a === 'hub' ? 'center' : 'fromHub'), area);
    await waitArea(page, area);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${EVIDENCE}/gallery-area-${area}.png` });
    report[area] = await pixelCheck(page, `area-${area}`);
  }
  for (const id of ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'FINAL']) {
    await midFight(page, id, 7);
    await page.screenshot({ path: `${EVIDENCE}/gallery-boss-${id}.png` });
    report[id] = await pixelCheck(page, `boss-${id}`);
    await page.evaluate(() => window.__RESONANT__!.stopBot());
    await page.evaluate(() => window.__RESONANT__!.invulnerable(false));
  }
  const s = await state(page);
  report.missingArt = s.missingArt;
  writeEvidence('gallery', report);
  expect(s.missingArt).toEqual([]);
  for (const [k, r] of Object.entries(report)) {
    if (k === 'missingArt') continue;
    const p = r as PixelReport;
    expect(p.offPalette, `${k} off-palette`).toBe(0);
    expect(p.nonUniformBlocks, `${k} non-uniform`).toBe(0);
  }
  expect(errors).toEqual([]);
});
