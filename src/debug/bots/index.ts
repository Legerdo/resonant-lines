import type { InputFrame } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { hubTutorialBot } from './hubBot.ts';
import { GramBot } from './gramBot.ts';

export interface AnyBot {
  name: string;
  readonly done: boolean;
  next(sim: Sim): InputFrame;
  log: string[];
}

export const BOTS: Record<string, () => AnyBot> = {
  hub: hubTutorialBot,
  B01: () => new GramBot(),
};

export function registerBot(name: string, f: () => AnyBot): void {
  BOTS[name] = f;
}
