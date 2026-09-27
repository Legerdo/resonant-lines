import type { InputFrame } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { hubTutorialBot, hubSetupBot, hubPulseWestBot, hubPulseDoorBot } from './hubBot.ts';
import { GramBot } from './gramBot.ts';
import { HumBot } from './humBot.ts';
import { NeraBot } from './neraBot.ts';
import { MoraBot } from './moraBot.ts';
import { EyeBot } from './eyeBot.ts';
import { BrakBot } from './brakBot.ts';
import { OrbitBot } from './orbitBot.ts';
import { CrownBot } from './crownBot.ts';
import { StarBot } from './starBot.ts';
import { ROUTES, WalkBot, PressBot, IdleBot } from './walkBot.ts';
import { DRILLS } from './drillBot.ts';
import { NavBot, GateBot } from './navBot.ts';

export interface AnyBot {
  name: string;
  readonly done: boolean;
  next(sim: Sim): InputFrame;
  log: string[];
}

export const BOTS: Record<string, () => AnyBot> = {
  hub: hubTutorialBot,
  'hub:setup': hubSetupBot,
  'hub:pulseWest': hubPulseWestBot,
  'hub:pulseDoor': hubPulseDoorBot,
  B01: () => new GramBot(),
  B02: () => new HumBot(),
  B03: () => new NeraBot(),
  B04: () => new MoraBot(),
  B05: () => new EyeBot(),
  B06: () => new BrakBot(),
  B07: () => new OrbitBot(),
  B08: () => new CrownBot(),
  FINAL: () => new StarBot(),
};

export function registerBot(name: string, f: () => AnyBot): void {
  BOTS[name] = f;
}

for (const r of Object.keys(ROUTES)) BOTS[`walk:${r}`] = () => new WalkBot(r);
BOTS.press = () => new PressBot();
BOTS.idle = () => new IdleBot();
for (const [k, f] of Object.entries(DRILLS)) BOTS[k] = f;
BOTS.solve = () => new GateBot();

/** dynamic bot names: `go:<exitId | interactableId>` or `go:x,y` */
export function makeBot(name: string): AnyBot | null {
  const f = BOTS[name];
  if (f) return f();
  if (name.startsWith('go:')) {
    const arg = name.slice(3);
    const m = /^(-?\d+),(-?\d+)$/.exec(arg);
    if (m) return new NavBot({ kind: 'point', p: { x: Number(m[1]), y: Number(m[2]) } });
    // exits are named to*/from*; everything else is an interactable
    return new NavBot(arg.startsWith('to') ? { kind: 'exit', id: arg } : { kind: 'interact', id: arg });
  }
  return null;
}
