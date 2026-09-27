import { ScriptBot, moveTo, throwAt, until, pulseAt, recallAll, wait } from './bot.ts';
import type { Sim } from '../../core/sim/sim.ts';

const WEST_PLATE = { x: 200, y: 448 };
const DOOR_SOCKET = { x: 320, y: 375 };
const charged = (s: Sim): boolean => s.link('AB').valid && (s.link('AB').state === 'Charged' || s.link('AB').state === 'Overloaded');

/** Completes the hub tutorial device exactly like a player would. */
export function hubTutorialBot(): ScriptBot {
  return new ScriptBot('hub', [
    moveTo({ x: 300, y: 500 }),
    throwAt('A', WEST_PLATE),
    moveTo({ x: 290, y: 480 }),
    throwAt('B', DOOR_SOCKET),
    until(charged, 900),
    pulseAt(DOOR_SOCKET),
    until((s) => s.flags.has('tutorialDone'), 300),
    recallAll(),
    moveTo({ x: 320, y: 330 }),
    wait(5),
  ]);
}

// E03 pieces: same device, same Wave charge, opposite directions.
/** A on the west plate, B in the door socket, wait for the emitter to charge A-B. */
export function hubSetupBot(): ScriptBot {
  return new ScriptBot('hub:setup', [
    moveTo({ x: 300, y: 500 }),
    throwAt('A', WEST_PLATE),
    moveTo({ x: 290, y: 480 }),
    throwAt('B', DOOR_SOCKET),
    until(charged, 900),
  ]);
}

/** Pulse aimed at A (west plate): energy flows B->A, into the plate. The door must stay sealed. */
export function hubPulseWestBot(): ScriptBot {
  return new ScriptBot('hub:pulseWest', [until(charged, 900), pulseAt(WEST_PLATE), wait(20)]);
}

/** Pulse aimed at B (door socket): energy flows A->B, into the socket. The door opens. */
export function hubPulseDoorBot(): ScriptBot {
  return new ScriptBot('hub:pulseDoor', [until(charged, 900), pulseAt(DOOR_SOCKET), until((s) => s.flags.has('tutorialDone'), 300), wait(5)]);
}
