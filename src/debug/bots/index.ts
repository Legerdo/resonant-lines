import type { InputFrame } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { hubTutorialBot } from './hubBot.ts';
import { GramBot } from './gramBot.ts';
import { HumBot } from './humBot.ts';
import { NeraBot } from './neraBot.ts';
import { MoraBot } from './moraBot.ts';
import { EyeBot } from './eyeBot.ts';
import { BrakBot } from './brakBot.ts';

export interface AnyBot {
  name: string;
  readonly done: boolean;
  next(sim: Sim): InputFrame;
  log: string[];
}

export const BOTS: Record<string, () => AnyBot> = {
  hub: hubTutorialBot,
  B01: () => new GramBot(),
  B02: () => new HumBot(),
  B03: () => new NeraBot(),
  B04: () => new MoraBot(),
  B05: () => new EyeBot(),
  B06: () => new BrakBot(),
};

export function registerBot(name: string, f: () => AnyBot): void {
  BOTS[name] = f;
}
