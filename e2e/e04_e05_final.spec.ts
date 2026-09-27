// E04 Final unlock: 서로 다른 5보스 완료 후 최종문 한 번 활성화.
// E05 Ending: 최종 보스 → Phase A → B → C → Convergence → 엔딩 → 타이틀 → 이어하기 → boss replay.
// One continuous story save, travelled ON FOOT (nav bots: hub → region → resonance gate → boss door), no teleports.
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { freshBoot, state, waitFor, waitArea, turbo, runBot, shot, fight, go, travelToBoss, waitLeftArena, writeEvidence, REGION_OF } from './helpers.ts';

const GATE_TEXT = '심장문이 열렸다';
// every boss — including FINAL — is beaten under the normal 2 Shield + Core rules (no shield debug). The sim is
// deterministic across engines (src/core/math/dmath.ts), so these browser fights replay the headless unit-test
// fights (tests/bosses.test.ts A16) exactly.
const SHIELD_DEBUG = new Set<string>();

// a 10-minute serial run produces traces too large to finalize; evidence is written to ProjectState instead
test.use({ trace: 'off' });

test.describe.serial('E04/E05 story run on foot', () => {
  let ctx: BrowserContext;
  let page: Page;
  const errors: string[] = [];

  test.beforeAll(async ({ browser }, info) => {
    ctx = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
  });

  test.afterAll(async () => {
    await ctx.close();
  });

  test('E04 all 8 story bosses reached on foot; the heart gate opens exactly once, at the 5th distinct boss', async () => {
    test.setTimeout(900_000);
    await freshBoot(page);
    await page.getByRole('button', { name: '새 게임' }).click();
    await waitArea(page, 'hub');
    await turbo(page, 4);
    await runBot(page, 'hub');

    // the heart door is sealed before the gate: walking into it keeps the player in the hub and shows why
    await turbo(page, 3);
    await runBot(page, 'walk:hub>heart');
    await page.waitForTimeout(200);
    let s = await state(page);
    expect(s.area).toBe('hub');
    await expect(page.locator('#ui')).toContainText('심장문이 닫혀 있다');
    await shot(page, 'e04-01-heart-sealed');

    // B01 twice (a repeat must not count), then the rest; the 5th DISTINCT boss is B04
    const order: { id: string; distinct: number }[] = [
      { id: 'B01', distinct: 1 }, { id: 'B01', distinct: 1 }, { id: 'B02', distinct: 2 }, { id: 'B06', distinct: 3 },
      { id: 'B07', distinct: 4 }, { id: 'B04', distinct: 5 }, { id: 'B08', distinct: 6 }, { id: 'B03', distinct: 7 }, { id: 'B05', distinct: 8 },
    ];
    const results: Record<string, unknown>[] = [];
    for (const step of order) {
      await turbo(page, 4);
      const inv = SHIELD_DEBUG.has(step.id);
      const route = await travelToBoss(page, step.id, { invulnerable: inv });
      s = await state(page);
      expect(s.save.discovered).toContain(step.id);
      const rep = await fight(page, step.id, `arena_${step.id}`, { enter: false, started: true, turbo: 4, invulnerable: inv });
      expect(rep.result, `${step.id} fixture bot`).toBe('victory');
      s = await state(page);
      expect(s.save.completed.length).toBe(step.distinct);
      const gateText = rep.victoryText.includes(GATE_TEXT);
      if (gateText) await shot(page, `e04-02-gate-opened-${step.id}`);
      const returnedTo = await waitLeftArena(page);
      expect(returnedTo).toBe(REGION_OF[step.id]);
      results.push({ boss: step.id, route, seconds: Math.round(rep.elapsed * 10) / 10, shieldDebug: inv, deathsBeforeWin: rep.deaths, gate: s.save.finalGate, gateText, returnedTo });
      expect(s.save.finalGate).toBe(step.distinct >= 5);
      expect(gateText).toBe(step.distinct === 5 && step.id === 'B04');
    }
    expect(results.filter((r) => r.gateText).length).toBe(1);
    s = await state(page);
    expect(s.save.completed.sort()).toEqual(['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08']);
    expect(s.save.flags).toEqual(expect.arrayContaining(['puzzle:quarry', 'puzzle:garden', 'puzzle:belfry', 'puzzle:marsh']));
    expect(s.save.tunings.length).toBe(8);
    writeEvidence('e04', results);
  });

  test('E05 final boss phases A→B→C → ending → title → continue → boss replay', async () => {
    test.setTimeout(600_000);
    // from the marsh (where B05 left us) back to the hub, then through the open heart door
    await turbo(page, 4);
    await go(page, 'toHub', 'hub');
    await turbo(page, 1);
    await page.waitForTimeout(400);
    await shot(page, 'e05-01-hub-gate-open');
    await turbo(page, 4);
    await page.evaluate(() => window.__RESONANT__!.armBot('arena_FINAL', 'FINAL'));
    await go(page, 'toHeart', 'arena_FINAL');
    await turbo(page, 1);
    await page.waitForTimeout(700);
    await shot(page, 'e05-02-final-intro');

    // FINAL is beaten under the normal Shield/Core rules (no shield debug)
    const rep = await fight(page, 'FINAL', 'arena_FINAL', { enter: false, started: true, turbo: 4, invulnerable: false, timeout: 300_000 });
    expect(rep.result).toBe('victory');
    // A (circuits) -> B (anti-phase sockets) -> last seal exposes the core -> C (moving debris lattice) -> Convergence
    const idx = (re: RegExp) => rep.log.findIndex((l) => re.test(l));
    const iB = idx(/:phase B$/);
    const iC = idx(/:phase C$/);
    const iCore = idx(/:coreExposed$/);
    const iWin = idx(/:victory$/);
    expect(rep.phases[0]).toBe('A');
    expect(iB).toBeGreaterThanOrEqual(0);
    expect(iCore).toBeGreaterThan(iB);
    expect(iC).toBeGreaterThan(iB);
    expect(iWin).toBeGreaterThan(Math.max(iC, iCore));
    expect(rep.log.filter((l) => /:seal /.test(l)).length).toBe(5);

    // 엔딩
    await turbo(page, 1);
    await waitFor(page, `window.__RESONANT__.state().mode === 'ending'`, 30_000);
    let s = await state(page);
    expect(s.save.ending).toBe(true);
    expect(s.save.flags).toContain('heartRestarted');
    expect(s.save.fullClear).toBeGreaterThan(0);
    await page.waitForTimeout(3500);
    await shot(page, 'e05-03-ending');
    const toTitle = page.locator('button[data-id="toTitle"]');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('button[data-id="toTitle"]')!.parentElement!).opacity === '1', undefined, { timeout: 15_000 });
    await shot(page, 'e05-04-ending-end');
    await toTitle.click();

    // 타이틀 → 이어하기
    await waitFor(page, `window.__RESONANT__.state().mode === 'title'`);
    await expect(page.getByRole('button', { name: '이어하기' })).toBeEnabled();
    await shot(page, 'e05-05-title-after-ending');
    await page.getByRole('button', { name: '이어하기' }).click();
    await waitArea(page, 'hub');
    s = await state(page);
    expect(s.sim?.flags).toContain('heartRestarted');
    await page.waitForTimeout(400);
    await shot(page, 'e05-06-hub-heart-restarted');

    // boss replay from the records stele (walk there, press E)
    await turbo(page, 3);
    await go(page, 'records');
    await runBot(page, 'press');
    await waitFor(page, `window.__RESONANT__.state().screen === 'records'`, 10_000);
    await turbo(page, 1);
    await expect(page.locator('button[data-id="rush"]')).toBeEnabled();
    await shot(page, 'e05-07-records-replay');
    await page.evaluate(() => window.__RESONANT__!.armBot('arena_B02', 'B02'));
    await page.locator('button[data-id="replay-B02"]').click();
    await waitArea(page, 'arena_B02');
    s = await state(page);
    expect(s.run).toBe('replay');
    const before = s.save.best.B02!;
    const replay = await fight(page, 'B02', 'arena_B02', { enter: false, started: true, turbo: 4 });
    expect(replay.result).toBe('victory');
    const back = await waitLeftArena(page);
    expect(back).toBe('hub');
    s = await state(page);
    expect(s.run).toBe('story');
    expect(s.save.completed.length).toBe(9);
    expect(s.save.best.B02).toBeLessThanOrEqual(before);
    writeEvidence('e05', {
      phases: rep.phases, trace: rep.log.filter((l) => /phase|seal|core|victory/.test(l)), finalSeconds: rep.elapsed, replaySeconds: replay.elapsed,
      fullClearSeconds: s.save.fullClear, save: s.save,
    });
    expect(errors).toEqual([]);
  });

  test('boss rush from the records stele: 8 story bosses + FINAL back to back, one run time recorded', async () => {
    test.setTimeout(600_000);
    const order = ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'FINAL'];
    await turbo(page, 3);
    await go(page, 'records');
    await runBot(page, 'press');
    await waitFor(page, `window.__RESONANT__.state().screen === 'records'`, 10_000);
    await turbo(page, 1);
    await expect(page.locator('button[data-id="rush"]')).toBeEnabled();
    await page.evaluate(() => window.__RESONANT__!.armBot('arena_B01', 'B01'));
    await page.locator('button[data-id="rush"]').click();
    const fights: { boss: string; seconds: number }[] = [];
    for (let i = 0; i < order.length; i++) {
      const id = order[i]!;
      await waitArea(page, `arena_${id}`);
      let s = await state(page);
      expect(s.run).toBe('rush');
      await turbo(page, 6);
      // arm the next arena's bot the moment this fight is won (the rush moves on by itself)
      await page.waitForFunction(
        ([next]) => {
          const api = window.__RESONANT__!;
          const r = api.state().sim?.fight?.result;
          if (r === 'victory' && next) api.armBot(`arena_${next}`, next);
          return r === 'victory' || r === 'defeat';
        },
        [order[i + 1] ?? ''] as const,
        { timeout: 180_000, polling: 50 },
      );
      s = await state(page);
      expect(s.sim?.fight?.result, `${id} in the rush`).toBe('victory');
      fights.push({ boss: id, seconds: Math.round((s.sim?.fight?.elapsed ?? 0) * 10) / 10 });
    }
    // after FINAL the rush ends in the hub (no ending replay), with the run time stored as a record
    await waitArea(page, 'hub', 60_000);
    await turbo(page, 1);
    const s = await state(page);
    expect(s.run).toBe('story');
    expect(s.mode).toBe('play');
    expect(s.save.best.RUSH).toBeGreaterThan(0);
    await expect(page.locator('#ui')).toContainText('보스 러시 완주');
    await shot(page, 'rush-01-result');
    writeEvidence('rush', { fights, rushSeconds: s.save.best.RUSH, sumOfFights: Math.round(fights.reduce((a, f) => a + f.seconds, 0) * 10) / 10 });
    expect(errors).toEqual([]);
  });
});
