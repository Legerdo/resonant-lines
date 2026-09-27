import { test, expect } from '@playwright/test';

test('boots the production build and shows the Korean title', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => window.__RESONANT__?.ready(), undefined, { timeout: 30_000 });
  await expect(page.locator('.title-logo')).toHaveText('공명선');
  await expect(page.getByRole('button', { name: '새 게임' })).toBeVisible();
  await expect(page.getByRole('button', { name: '이어하기' })).toBeDisabled();
  await page.screenshot({ path: 'ProjectState/evidence/boot-title.png' });
  const r = await page.evaluate(() => window.__RESONANT__!.renderer());
  console.log('renderer', r);
  expect(errors).toEqual([]);
});
