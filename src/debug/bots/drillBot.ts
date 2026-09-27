// Needle drills used by E02 (needle invariant). Input frames only; every step waits on observable state.
import { ScriptBot, moveTo, throwAt, recallAll, wait, type Task } from './bot.ts';
import { NEEDLE_IDS, type NeedleId } from '../../core/sim/types.ts';

// hub antechamber (no enemies): two anchor plates + the tutorial door socket
const WEST_PLATE = { x: 200, y: 448 };
const EAST_PLATE = { x: 440, y: 448 };
const DOOR_SOCKET = { x: 320, y: 375 };
// B01 arena: two seal monoliths + the south anchor strip (all clear of Gram's start position)
const SEAL_W = { x: 96, y: 186 };
const SEAL_E = { x: 320, y: 186 };
const SOUTH_STRIP = { x: 232, y: 262 };

/** select one needle and recall it; finishes when it is back in hand */
export function recallOne(id: NeedleId): Task {
  let sent = false;
  return (sim, f) => {
    if (!sent) {
      f.selIndex = NEEDLE_IDS.indexOf(id);
      f.recall = true;
      sent = true;
      return false;
    }
    return sim.needle(id).state === 'Held';
  };
}

export const DRILLS: Record<string, () => ScriptBot> = {
  'drill:fire3': () => new ScriptBot('drill:fire3', [moveTo({ x: 290, y: 480 }), throwAt('A', WEST_PLATE), throwAt('B', EAST_PLATE), throwAt('C', DOOR_SOCKET), wait(6)]),
  'drill:recallA': () => new ScriptBot('drill:recallA', [recallOne('A'), wait(6)]),
  'drill:recallB': () => new ScriptBot('drill:recallB', [recallOne('B'), wait(6)]),
  'drill:refire': () => new ScriptBot('drill:refire', [throwAt('A', WEST_PLATE), throwAt('B', EAST_PLATE), wait(6)]),
  'drill:recallAll': () => new ScriptBot('drill:recallAll', [recallAll(), wait(6)]),
  'drill:arena2': () => new ScriptBot('drill:arena2', [throwAt('A', SEAL_W), throwAt('C', SOUTH_STRIP)]),
  'drill:arena3': () => new ScriptBot('drill:arena3', [throwAt('A', SEAL_W), throwAt('B', SEAL_E), throwAt('C', SOUTH_STRIP), wait(6)]),
};
