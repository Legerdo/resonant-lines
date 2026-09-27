import { expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

export type Snapshot = Awaited<ReturnType<typeof state>>;

export const EVIDENCE = 'ProjectState/evidence';
mkdirSync(EVIDENCE, { recursive: true });

/** collects page errors + console errors; assert empty at the end of every test */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

export async function boot(page: Page, query = 'e2e=1'): Promise<void> {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => window.__RESONANT__?.ready(), undefined, { timeout: 30_000 });
}

/** fresh profile: clear storage and reboot to the title */
export async function freshBoot(page: Page, query = 'e2e=1'): Promise<void> {
  await boot(page, query);
  await page.evaluate(() => window.__RESONANT__!.clearSave());
  await boot(page, query);
}

export async function state(page: Page) {
  return page.evaluate(() => window.__RESONANT__!.state());
}

export async function waitFor(page: Page, fn: string, timeout = 60_000): Promise<void> {
  await page.waitForFunction(fn, undefined, { timeout, polling: 100 });
}

/** in play mode, standing in `area`, no fade in progress */
export async function waitArea(page: Page, area: string, timeout = 60_000): Promise<void> {
  await page.waitForFunction(
    (a) => {
      const s = window.__RESONANT__!.state();
      return s.mode === 'play' && s.area === a && !s.transition;
    },
    area,
    { timeout, polling: 100 },
  );
}

export async function turbo(page: Page, n: number): Promise<void> {
  await page.evaluate((k) => window.__RESONANT__!.turbo(k), n);
}

export async function runBot(page: Page, name: string, timeout = 120_000): Promise<void> {
  const ok = await page.evaluate((n) => window.__RESONANT__!.bot(n), name);
  if (!ok) throw new Error(`no bot ${name}`);
  await page.waitForFunction(() => window.__RESONANT__!.botDone(), undefined, { timeout, polling: 100 });
  await page.evaluate(() => window.__RESONANT__!.stopBot());
}

/** walk a named route and wait until the destination area is loaded */
export async function walk(page: Page, route: string, dest: string): Promise<void> {
  await runBot(page, `walk:${route}`, 60_000);
  await waitArea(page, dest);
}

export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${EVIDENCE}/${name}.png` });
}

export function writeEvidence(name: string, data: unknown): void {
  writeFileSync(`${EVIDENCE}/${name}.json`, JSON.stringify(data, null, 2));
}

export interface FightReport {
  boss: string;
  result: string;
  elapsed: number;
  log: string[];
  phases: string[];
  victoryText: string;
  invulnerable: boolean;
}

/**
 * Enter a boss arena (unless already inside), run its fixture bot (input frames only) and wait for the result.
 * Accumulates the sim trace so seal/core/phase/victory ordering can be asserted.
 */
export async function fight(
  page: Page,
  id: string,
  area: string,
  opts: { turbo?: number; invulnerable?: boolean; enter?: boolean; timeout?: number; retries?: number; started?: boolean } = {},
): Promise<FightReport & { deaths: number }> {
  const inv = opts.invulnerable ?? false;
  if (opts.enter !== false) {
    await page.evaluate((a) => window.__RESONANT__!.enter(a, 'default'), area);
  }
  await waitArea(page, area);
  if (!opts.started) await page.evaluate((v) => window.__RESONANT__!.invulnerable(v), inv);
  const seen = new Set<string>();
  const log: string[] = [];
  const phases: string[] = [];
  const deadline = Date.now() + (opts.timeout ?? 180_000);
  let s = await state(page);
  let deaths = 0;
  let started = !!opts.started;
  for (;;) {
    await turbo(page, opts.turbo ?? 4);
    if (!started) expect(await page.evaluate((n) => window.__RESONANT__!.bot(n), id)).toBe(true);
    started = false;
    for (;;) {
      s = await state(page);
      for (const line of s.sim?.log ?? []) {
        if (!seen.has(line)) {
          seen.add(line);
          log.push(line);
        }
      }
      const ph = s.sim?.boss?.phase;
      if (ph && phases[phases.length - 1] !== ph) phases.push(ph);
      const r = s.sim?.fight?.result;
      if (r === 'victory' || r === 'defeat') break;
      if (Date.now() > deadline) throw new Error(`${id} fight timed out: ${JSON.stringify(s.sim?.boss)}`);
      await page.waitForTimeout(100);
    }
    await page.evaluate(() => window.__RESONANT__!.stopBot());
    if (s.sim?.fight?.result === 'victory' || deaths >= (opts.retries ?? 0)) break;
    // defeat: retry from the death card with R, exactly like a player
    deaths++;
    seen.clear();
    await turbo(page, 1);
    await waitFor(page, `window.__RESONANT__.state().screen === 'death'`, 10_000);
    await page.keyboard.press('KeyR');
    await waitFor(page, `window.__RESONANT__.state().sim?.fight?.result === 'intro'`, 10_000);
  }
  await turbo(page, 2);
  let victoryText = '';
  if (s.sim?.fight?.result === 'victory') {
    await waitFor(page, `window.__RESONANT__.state().screen === 'victory'`, 20_000);
    victoryText = await page.locator('#ui').innerText();
  }
  await page.evaluate(() => window.__RESONANT__!.invulnerable(false));
  return { boss: id, result: s.sim?.fight?.result ?? 'none', elapsed: s.sim?.fight?.elapsed ?? 0, log, phases, victoryText, invulnerable: inv, deaths };
}

/** run a named bot to completion and fail loudly if it reports failure (nav/solve bots) */
export async function runChecked(page: Page, name: string, timeout = 120_000): Promise<void> {
  await runBotKeep(page, name, timeout);
  const log = await page.evaluate(() => window.__RESONANT__!.botLog());
  await page.evaluate(() => window.__RESONANT__!.stopBot());
  if (log?.failed) throw new Error(`${name} failed: ${log.log.join(' / ')}`);
}

async function runBotKeep(page: Page, name: string, timeout: number): Promise<void> {
  const ok = await page.evaluate((n) => window.__RESONANT__!.bot(n), name);
  if (!ok) throw new Error(`no bot ${name}`);
  await page.waitForFunction(() => window.__RESONANT__!.botDone(), undefined, { timeout, polling: 100 });
}

/**
 * Walk on foot to an exit / interactable (`go:` nav bot); optionally wait for the next area. If a bot was armed for
 * the destination (armBot) it takes over on the new area's first tick and is left running.
 */
export async function go(page: Page, target: string, dest?: string, timeout = 120_000): Promise<void> {
  const nav = `go:${target}`;
  const ok = await page.evaluate((n) => window.__RESONANT__!.bot(n), nav);
  if (!ok) throw new Error(`no bot ${nav}`);
  await page.waitForFunction(
    ([n, d]) => {
      const api = window.__RESONANT__!;
      const s = api.state();
      if (d && s.area === d && !s.transition) return true;
      const log = api.botLog();
      return !log || log.name !== n || api.botDone();
    },
    [nav, dest ?? ''] as const,
    { timeout, polling: 100 },
  );
  const log = await page.evaluate(() => window.__RESONANT__!.botLog());
  if (log?.name === nav) {
    await page.evaluate(() => window.__RESONANT__!.stopBot());
    if (log.failed) throw new Error(`${nav} failed: ${log.log.join(' / ')}`);
  }
  if (dest) await waitArea(page, dest);
}

export const REGION_OF: Record<string, string> = { B01: 'quarry', B06: 'quarry', B02: 'belfry', B08: 'belfry', B04: 'garden', B07: 'garden', B03: 'marsh', B05: 'marsh' };
const GATED = new Set(['B06', 'B07', 'B08', 'B05']);
const HUB_EXIT: Record<string, string> = { quarry: 'toQuarry', garden: 'toGarden', belfry: 'toBelfry', marsh: 'toMarsh' };

/**
 * hub -> region -> (resonance gate) -> boss door, on foot. Returns the areas passed through.
 * With `arm`, the boss fixture bot is armed before the door so it plays from the arena's first tick (identical to the
 * headless unit-test run of the same bot); pass `started: true` to fight() afterwards.
 */
export async function travelToBoss(page: Page, id: string, arm?: { invulnerable: boolean }): Promise<string[]> {
  let s = await state(page);
  const region = REGION_OF[id]!;
  const route = [s.area];
  if (s.area !== region) {
    if (s.area !== 'hub') {
      await go(page, 'toHub', 'hub');
      route.push('hub');
    }
    await go(page, HUB_EXIT[region]!, region);
    route.push(region);
  }
  s = await state(page);
  if (GATED.has(id) && !s.save.flags.includes(`puzzle:${region}`)) {
    await runChecked(page, 'solve', 90_000);
    s = await state(page);
    if (!s.save.flags.includes(`puzzle:${region}`)) throw new Error(`gate in ${region} did not open`);
    route.push(`puzzle:${region}`);
  }
  if (arm) {
    await page.evaluate(([a, b, inv]) => {
      window.__RESONANT__!.invulnerable(inv as boolean);
      window.__RESONANT__!.armBot(a as string, b as string);
    }, [`arena_${id}`, id, arm.invulnerable] as const);
  }
  await go(page, `to${id}`, `arena_${id}`);
  route.push(`arena_${id}`);
  return route;
}

/** after a story victory the app returns to the boss's region (or the hub for the heart) */
export async function waitLeftArena(page: Page, timeout = 30_000): Promise<string> {
  await page.waitForFunction(
    () => {
      const s = window.__RESONANT__!.state();
      return s.mode !== 'play' || (!s.transition && !s.area.startsWith('arena_'));
    },
    undefined,
    { timeout, polling: 100 },
  );
  return (await state(page)).area;
}
