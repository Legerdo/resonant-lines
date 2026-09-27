import { ScriptBot, moveTo, throwAt, until, pulseAt, recallAll, wait } from './bot.ts';

/** Completes the hub tutorial device exactly like a player would. */
export function hubTutorialBot(): ScriptBot {
  return new ScriptBot('hub', [
    moveTo({ x: 300, y: 500 }),
    throwAt('A', { x: 200, y: 448 }),
    moveTo({ x: 290, y: 480 }),
    throwAt('B', { x: 320, y: 375 }),
    until((s) => s.link('AB').valid && (s.link('AB').state === 'Charged' || s.link('AB').state === 'Overloaded'), 900),
    pulseAt({ x: 320, y: 375 }),
    until((s) => s.flags.has('tutorialDone'), 300),
    recallAll(),
    moveTo({ x: 320, y: 330 }),
    wait(5),
  ]);
}
