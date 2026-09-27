// E03 Pulse direction: 같은 charge에서 A→B / B→A가 다른 target을 활성화.
// Hub tutorial device: A on the west anchor plate, B in the sealed door's socket, the harmless Wave emitter charges A-B.
import { test, expect } from '@playwright/test';
import { freshBoot, state, waitArea, turbo, runBot, shot, trackErrors, writeEvidence } from './helpers.ts';

test('E03 pulse direction: aiming at A delivers B→A (door stays sealed), aiming at B delivers A→B (door opens)', async ({ page }) => {
  const errors = trackErrors(page);
  await freshBoot(page);
  await page.getByRole('button', { name: '새 게임' }).click();
  await waitArea(page, 'hub');
  await turbo(page, 3);
  await runBot(page, 'hub:setup');
  let s = await state(page);
  const ab = s.sim!.links.find((l) => l.id === 'AB')!;
  expect(ab.valid).toBe(true);
  expect(['Charged', 'Overloaded']).toContain(ab.state);
  expect(ab.sig).toBe('Wave');
  const hostA = s.sim!.needles[0]!.host;
  const hostB = s.sim!.needles[1]!.host;
  expect(hostB).toBe('mech:tutorialDoor:socket');
  await turbo(page, 1);
  await shot(page, 'e03-01-charged');

  // B→A: aim at the plate needle
  await turbo(page, 2);
  await runBot(page, 'hub:pulseWest');
  s = await state(page);
  const west = s.sim!.log.filter((l) => /pulse |deliver /.test(l));
  expect(west.some((l) => /pulse B->A Wave/.test(l))).toBe(true);
  expect(west.some((l) => l.endsWith(`deliver B->A ${hostA} none`))).toBe(true);
  expect(s.sim!.flags).not.toContain('tutorialDone');
  expect(s.save.flags).not.toContain('tutorialDone');
  await turbo(page, 1);
  await shot(page, 'e03-02-west-door-still-sealed');

  // A→B: same device, next Wave charge, aim at the socket needle
  await turbo(page, 2);
  await runBot(page, 'hub:pulseDoor');
  s = await state(page);
  const door = s.sim!.log.filter((l) => /pulse |deliver |open /.test(l));
  expect(door.some((l) => /pulse A->B Wave/.test(l))).toBe(true);
  expect(door.some((l) => /deliver A->B mech:tutorialDoor:socket success/.test(l))).toBe(true);
  expect(s.save.flags).toContain('tutorialDone');
  await turbo(page, 1);
  await page.waitForTimeout(300);
  await shot(page, 'e03-03-door-open');
  writeEvidence('e03', { hostA, hostB, westTrace: west, doorTrace: door });
  expect(errors).toEqual([]);
});
