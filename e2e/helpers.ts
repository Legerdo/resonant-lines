import type { Page } from '@playwright/test';

export async function boot(page: Page, query = 'e2e=1'): Promise<void> {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => window.__RESONANT__?.ready(), undefined, { timeout: 30_000 });
}

export async function state(page: Page) {
  return page.evaluate(() => window.__RESONANT__!.state());
}

export async function waitFor(page: Page, fn: string, timeout = 60_000): Promise<void> {
  await page.waitForFunction(fn, undefined, { timeout, polling: 100 });
}

export async function runBot(page: Page, name: string, timeout = 120_000): Promise<void> {
  const ok = await page.evaluate((n) => window.__RESONANT__!.bot(n), name);
  if (!ok) throw new Error(`no bot ${name}`);
  await page.waitForFunction(() => window.__RESONANT__!.botDone(), undefined, { timeout, polling: 100 });
  await page.evaluate(() => window.__RESONANT__!.stopBot());
}

export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `ProjectState/evidence/${name}.png` });
}
