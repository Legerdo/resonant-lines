// E02 Needle invariant: 3개 발사 → 개별 회수 → 재발사 → 전체 회수 → 사망 → 재시작, 3개 invariant 유지.
// Fire/recall drills run in the hub antechamber (no enemies); death + restart happen in the B01 arena.
// A watchdog samples every rendered frame: always exactly needles A/B/C, finite positions, and no valid link whose
// endpoints are not both embedded (link orphan) for more than one sample.
import { test, expect, type Page } from '@playwright/test';
import { freshBoot, state, waitFor, waitArea, turbo, runBot, shot, trackErrors, writeEvidence } from './helpers.ts';

async function needles(page: Page) {
  return (await state(page)).sim!.needles;
}

test('E02 needle invariant: fire 3, recall individually, refire, recall all, die, restart', async ({ page }) => {
  const errors = trackErrors(page);
  await freshBoot(page);
  await page.getByRole('button', { name: '새 게임' }).click();
  await waitArea(page, 'hub');
  await page.evaluate(() => {
    const w = window as unknown as { __violations: string[]; __samples: number; __orphan: Record<string, number> };
    w.__violations = [];
    w.__samples = 0;
    w.__orphan = {};
    const tick = () => {
      const s = window.__RESONANT__!.state();
      if (s.sim) {
        w.__samples++;
        const ns = s.sim.needles;
        if (ns.map((n) => n.id).join('') !== 'ABC') w.__violations.push(`${s.sim.tick}:ids ${ns.map((n) => n.id).join('')}`);
        if (ns.some((n) => !Number.isFinite(n.x) || !Number.isFinite(n.y))) w.__violations.push(`${s.sim.tick}:NaN`);
        if (s.sim.links.map((l) => l.id).join(',') !== 'AB,BC,CA') w.__violations.push(`${s.sim.tick}:links`);
        for (const l of s.sim.links) {
          const a = ns.find((n) => n.id === l.id[0])!;
          const b = ns.find((n) => n.id === l.id[1])!;
          const orphan = l.valid && !(a.embedded && b.embedded);
          w.__orphan[l.id] = orphan ? (w.__orphan[l.id] ?? 0) + 1 : 0;
          if (w.__orphan[l.id]! > 1) w.__violations.push(`${s.sim.tick}:orphan ${l.id}`);
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const steps: Record<string, string[]> = {};
  const record = async (label: string) => {
    const n = await needles(page);
    steps[label] = n.map((x) => `${x.id}:${x.state}${x.host ? `@${x.host}` : ''}`);
    return n;
  };
  await turbo(page, 2);

  // 3개 발사
  await runBot(page, 'drill:fire3');
  let n = await record('fired3');
  expect(n.every((x) => x.embedded)).toBe(true);
  expect(new Set(n.map((x) => x.host)).size).toBe(3);
  await turbo(page, 1);
  await shot(page, 'e02-01-three-embedded');
  // a 4th throw with nothing in hand does nothing
  await page.evaluate(() => window.__RESONANT__!.frames([{ fire: true, aim: { x: 200, y: 448 } }, ...Array.from({ length: 20 }, () => ({}))]));
  await page.waitForFunction(() => window.__RESONANT__!.botDone());
  n = await record('fourthThrow');
  expect(n.every((x) => x.embedded)).toBe(true);
  await turbo(page, 2);

  // 개별 회수: A, then B (C stays)
  await runBot(page, 'drill:recallA');
  n = await record('recallA');
  expect(n[0]!.state).toBe('Held');
  expect(n[1]!.embedded && n[2]!.embedded).toBe(true);
  await runBot(page, 'drill:recallB');
  n = await record('recallB');
  expect([n[0]!.state, n[1]!.state]).toEqual(['Held', 'Held']);
  expect(n[2]!.embedded).toBe(true);

  // 재발사
  await runBot(page, 'drill:refire');
  n = await record('refire');
  expect(n.every((x) => x.embedded)).toBe(true);
  let s = await state(page);
  steps.refireLinks = s.sim!.links.map((l) => `${l.id}:${l.valid ? 'valid' : 'invalid'}:${l.state}`);

  // 전체 회수
  await runBot(page, 'drill:recallAll');
  n = await record('recallAll');
  expect(n.map((x) => x.state)).toEqual(['Held', 'Held', 'Held']);
  expect((await state(page)).sim!.links.every((l) => !l.valid)).toBe(true);

  // 사망: enter B01 and plant two needles in the same tick the arena is built, then stand still
  await page.evaluate(() => {
    window.__RESONANT__!.enter('arena_B01', 'default');
    window.__RESONANT__!.bot('drill:arena2');
  });
  await turbo(page, 4);
  await waitFor(page, `window.__RESONANT__.state().sim?.fight?.result === 'defeat'`, 60_000);
  await page.evaluate(() => window.__RESONANT__!.stopBot());
  await turbo(page, 1);
  n = await record('dead');
  expect(n.filter((x) => x.state !== 'Held').length).toBeGreaterThanOrEqual(1);
  await expect(page.locator('.screen.death')).toBeVisible();

  // 재시작 (R on the death card)
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => {
    const st = window.__RESONANT__!.state();
    return st.screen !== 'death' && st.sim?.fight?.result === 'intro';
  }, undefined, { timeout: 10_000, polling: 'raf' });
  n = await record('restart');
  s = await state(page);
  expect(n.map((x) => x.id)).toEqual(['A', 'B', 'C']);
  expect(n.map((x) => x.state)).toEqual(['Held', 'Held', 'Held']);
  expect(s.sim!.links.every((l) => !l.valid && l.state === 'Idle')).toBe(true);
  expect(s.sim!.lattice).toBe(false);
  expect(s.sim!.counts.pulses).toBe(0);
  await runBot(page, 'drill:arena3', 20_000);
  n = await record('afterRestartFire3');
  s = await state(page);
  expect(n.every((x) => x.embedded)).toBe(true);
  expect(s.save.deaths.B01).toBe(1);
  await shot(page, 'e02-02-after-restart');

  const v = await page.evaluate(() => {
    const w = window as unknown as { __violations: string[]; __samples: number };
    return { violations: w.__violations, samples: w.__samples };
  });
  writeEvidence('e02', { steps, ...v });
  console.log(`E02 samples=${v.samples} violations=${v.violations.length}`);
  expect(v.samples).toBeGreaterThan(200);
  expect(v.violations).toEqual([]);
  expect(errors).toEqual([]);
});
