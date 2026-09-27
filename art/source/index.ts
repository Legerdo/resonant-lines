import type { SheetDef } from '../lib/sheet.ts';
import { uiSheets } from './ui.ts';
import { playerSheets } from './player.ts';
import { fxSheets } from './fx.ts';
import { tileSheets } from './tiles.ts';
import { propSheets } from './props.ts';
import { gramSheets } from './bossGram.ts';
import { humSheets } from './bossHum.ts';
import { neraSheets } from './bossNera.ts';
import { moraSheets } from './bossMora.ts';

export function allSheets(): SheetDef[] {
  return [
    ...uiSheets(), ...playerSheets(), ...fxSheets(), ...tileSheets(), ...propSheets(),
    ...gramSheets(), ...humSheets(), ...neraSheets(), ...moraSheets(),
  ];
}
