// E01 신규 플레이: 새 게임 → 중앙 봉인실 → 공명 학습 장치 → 권역 이동 → B01 발견 → 사망 → 빠른 재도전
// → Seal 파괴 → Convergence → 처치 → 중앙 복귀 → reload → 완료 유지
import { test, expect } from '@playwright/test';
import { freshBoot, boot, state, waitFor, waitArea, turbo, runBot, walk, shot, fight, waitLeftArena, trackErrors, writeEvidence } from './helpers.ts';

test('E01 new play: tutorial → quarry → B01 death + fast retry → victory → hub → reload keeps completion', async ({ page }) => {
  const errors = trackErrors(page);
  await freshBoot(page);
  await expect(page.getByRole('button', { name: '이어하기' })).toBeDisabled();
  await page.getByRole('button', { name: '새 게임' }).click();
  await waitArea(page, 'hub');
  await page.waitForTimeout(500);
  await shot(page, 'e01-01-hub-antechamber');

  // 공명 학습 장치 (tutorial device) — solved through input frames only
  await turbo(page, 4);
  await runBot(page, 'hub');
  let s = await state(page);
  expect(s.save.flags).toContain('tutorialDone');
  await turbo(page, 1);
  await page.waitForTimeout(300);
  await shot(page, 'e01-02-hub-door-open');

  // 권역 이동: walk through the north-east gate into the quarry, then down to the pit gate
  await turbo(page, 3);
  await walk(page, 'hub>quarry', 'quarry');
  await turbo(page, 1);
  await page.waitForTimeout(300);
  await shot(page, 'e01-03-quarry');
  await turbo(page, 3);
  await walk(page, 'quarry>B01', 'arena_B01');
  s = await state(page);
  expect(s.save.discovered).toContain('B01'); // B01 발견
  expect(s.sim?.boss?.id).toBe('B01');
  await turbo(page, 1);
  await page.waitForTimeout(1300);
  await shot(page, 'e01-04-b01-intro');

  // 사망: stand still and let Gram win
  await turbo(page, 4);
  await page.evaluate(() => window.__RESONANT__!.bot('idle'));
  await waitFor(page, `window.__RESONANT__.state().sim?.fight?.result === 'defeat'`, 60_000);
  const tDeath = Date.now();
  await page.evaluate(() => window.__RESONANT__!.stopBot());
  await turbo(page, 1);
  await expect(page.locator('.screen.death')).toBeVisible();
  const tScreen = Date.now();
  await shot(page, 'e01-05-b01-death');
  // 빠른 재도전: the player presses R as soon as the death card appears
  await page.keyboard.press('KeyR');
  await waitFor(page, `(() => { const s = window.__RESONANT__.state(); return s.screen !== 'death' && !!s.sim?.fight && s.sim.fight.result !== 'defeat' && !s.sim.player.dead; })()`, 10_000);
  const tControl = Date.now();
  const retryMs = tControl - tDeath;
  s = await state(page);
  expect(s.save.deaths.B01).toBe(1);
  expect(s.sim!.needles.map((n) => n.state)).toEqual(['Held', 'Held', 'Held']);
  expect(retryMs).toBeLessThan(2500);

  // Seal 파괴 → Convergence → 처치
  const rep = await fight(page, 'B01', 'arena_B01', { enter: false, turbo: 4 });
  expect(rep.result).toBe('victory');
  const iSeal = rep.log.findIndex((l) => /^\d+:seal /.test(l));
  const iCore = rep.log.findIndex((l) => l.endsWith(':coreExposed'));
  const iWin = rep.log.findIndex((l) => l.endsWith(':victory'));
  expect(iSeal).toBeGreaterThanOrEqual(0);
  expect(iCore).toBeGreaterThan(iSeal);
  expect(iWin).toBeGreaterThan(iCore);
  expect(rep.victoryText).toContain('봉인 해제');
  await shot(page, 'e01-06-b01-victory');
  s = await state(page);
  expect(s.save.completed).toContain('B01');
  expect(s.save.tunings.length).toBe(1);

  // 중앙 복귀: auto-return to the quarry, walk back to the hub
  const back = await waitLeftArena(page);
  expect(back).toBe('quarry');
  await turbo(page, 3);
  await walk(page, 'quarry>hub', 'hub');
  await turbo(page, 1);
  await page.waitForTimeout(300);
  await shot(page, 'e01-07-hub-return');

  // reload → 완료 유지
  await boot(page);
  await expect(page.getByRole('button', { name: '이어하기' })).toBeEnabled();
  await page.getByRole('button', { name: '이어하기' }).click();
  await waitArea(page, 'hub');
  s = await state(page);
  expect(s.save.completed).toEqual(['B01']);
  expect(s.save.flags).toContain('tutorialDone');
  expect(s.save.deaths.B01).toBe(1);
  expect(s.save.best.B01).toBeGreaterThan(0);
  expect(s.sim?.flags).toContain('boss:B01');
  await page.waitForTimeout(300);
  await shot(page, 'e01-08-continue-after-reload');
  writeEvidence('e01', { retryMs, deathCardMs: tScreen - tDeath, fightSeconds: rep.elapsed, trace: rep.log.filter((l) => /seal|core|victory|phase|deliver/.test(l)), save: s.save });
  console.log(`E01 retry ${retryMs}ms (death card after ${tScreen - tDeath}ms), B01 ${rep.elapsed.toFixed(1)}s`);
  expect(errors).toEqual([]);
});
