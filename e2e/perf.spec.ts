// §34 performance probes (headless SwiftShader numbers are a floor, not the real-GPU figure; see ProjectState).
//  - 50 arena resets: no orphan display objects / DOM nodes, heap does not grow unbounded
//  - frame time during a live boss fight at 1920x1080
import { test, expect } from '@playwright/test';
import { freshBoot, state, waitArea, turbo, trackErrors, writeEvidence } from './helpers.ts';

test('50 arena resets leave no orphan objects; frame-time sample during a 1080p fight', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await freshBoot(page);
  await page.evaluate(() => window.__RESONANT__!.newGame());
  await page.evaluate(() => window.__RESONANT__!.enter('arena_B01', 'default'));
  await waitArea(page, 'arena_B01');
  await page.evaluate(() => window.__RESONANT__!.invulnerable(true));
  await turbo(page, 2);
  await page.evaluate(() => window.__RESONANT__!.bot('B01'));
  await page.waitForTimeout(3000);
  const heap = () => page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
  const s0 = await state(page);
  const h0 = await heap();
  const samples: { i: number; display: number; dom: number }[] = [];
  for (let i = 0; i < 50; i++) {
    await page.evaluate(() => window.__RESONANT__!.retry());
    await page.waitForTimeout(60 + (i % 5) * 20);
    const s = await state(page);
    samples.push({ i, display: s.displayObjects, dom: s.domNodes });
  }
  await page.waitForTimeout(3000);
  const s1 = await state(page);
  const h1 = await heap();
  const maxDisplay = Math.max(...samples.map((x) => x.display));
  // display objects are pooled: counts may fluctuate with what is on screen, but must not grow with resets
  expect(s1.displayObjects).toBeLessThanOrEqual(s0.displayObjects + 40);
  expect(maxDisplay).toBeLessThan(s0.displayObjects * 2 + 50);
  expect(Math.abs(s1.domNodes - s0.domNodes)).toBeLessThanOrEqual(30);

  // frame time during an active fight at 1080p (render + sim)
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => window.__RESONANT__!.retry());
  await turbo(page, 1);
  await page.evaluate(() => window.__RESONANT__!.bot('B01'));
  await page.waitForTimeout(8000);
  const perf = await page.evaluate(() => window.__RESONANT__!.perf());
  const s2 = await state(page);
  writeEvidence('perf', {
    note: 'headless Chromium + SwiftShader (CPU rasteriser); frameTime = App.frame() CPU time (sim+render submit)',
    before: { display: s0.displayObjects, dom: s0.domNodes, heapMB: h0 / 1e6 },
    after50Resets: { display: s1.displayObjects, dom: s1.domNodes, heapMB: h1 / 1e6, maxDisplay },
    fight1080p: { ...perf, zoom: s2.zoom, counts: s2.sim?.counts },
  });
  console.log('perf', JSON.stringify(perf), 'display', s0.displayObjects, '->', s1.displayObjects, 'heapMB', (h0 / 1e6).toFixed(1), '->', (h1 / 1e6).toFixed(1));
  expect(perf.avg).toBeLessThan(16.7);
  expect(errors).toEqual([]);
});
