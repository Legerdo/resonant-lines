import type { AreaDef } from '../areaTypes.ts';

// Resonance sandbox (debug + automated tests). 24x12 tiles. The 2x2 block in the middle blocks line of sight.
export const SANDBOX: AreaDef = {
  id: 'sandbox',
  kind: 'sandbox',
  region: 'hub',
  nameKey: 'area.sandbox',
  tiles: [
    '########################',
    '######AAAA######AAAA####',
    '#......................#',
    '#......................#',
    'A......................A',
    'A..........##..........A',
    'A..........##..........A',
    'A......................A',
    '#......................#',
    '#......................#',
    '#......................#',
    '####AAAA#######AAAA#####',
  ],
  spawns: { default: { x: 192, y: 150 } },
  props: [{ id: 'post', kind: 'pillar', pos: { x: 96, y: 120 }, r: 7, tag: 'Anchorable' }],
  exits: [],
  interactables: [],
  music: 'none',
};
