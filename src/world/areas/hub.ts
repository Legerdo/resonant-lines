import type { AreaDef } from '../areaTypes.ts';

const W = '#'.repeat(40);
const inner = '#' + '.'.repeat(38) + '#';
const gate = '.' + '.'.repeat(38) + '.';
const ante = '#'.repeat(13) + '.'.repeat(14) + '#'.repeat(13);
const antePlate = '#'.repeat(12) + 'A' + '.'.repeat(14) + 'A' + '#'.repeat(12);

// 심장 봉인실 (40x34). South: tutorial antechamber (two anchor plates, harmless Wave emitter, sealed door).
// North: main chamber with the four region gates, the heart door, tuning altar and records stele.
export const HUB: AreaDef = {
  id: 'hub',
  kind: 'hub',
  region: 'hub',
  nameKey: 'area.hub',
  music: 'hub',
  tiles: [
    '######...######################...######',
    '######...####AA##########AA####...######',
    inner, inner, inner, inner, inner, inner, inner,
    gate, gate, gate,
    inner, inner, inner, inner, inner, inner, inner, inner, inner, inner,
    '##################....##################',
    ante, ante, ante,
    antePlate, antePlate, antePlate, antePlate,
    ante, ante, ante,
    W,
  ],
  spawns: {
    default: { x: 320, y: 504 },
    fromGarden: { x: 36, y: 168 },
    fromMarsh: { x: 604, y: 168 },
    fromBelfry: { x: 112, y: 52 },
    fromQuarry: { x: 512, y: 52 },
    fromHeart: { x: 320, y: 72 },
    center: { x: 320, y: 300 },
  },
  props: [
    { id: 'heartDoor', kind: 'heartDoor', pos: { x: 320, y: 30 } },
    { id: 'altar', kind: 'altar', pos: { x: 208, y: 168 }, r: 9, blocksNeedle: true },
    { id: 'stele', kind: 'stele', pos: { x: 432, y: 168 }, r: 8, blocksNeedle: true },
    { id: 'dais', kind: 'dais', pos: { x: 320, y: 214 } },
    { id: 'lamp1', kind: 'lamp', pos: { x: 40, y: 56 }, r: 4 },
    { id: 'lamp2', kind: 'lamp', pos: { x: 600, y: 56 }, r: 4 },
    { id: 'lamp3', kind: 'lamp', pos: { x: 40, y: 330 }, r: 4 },
    { id: 'lamp4', kind: 'lamp', pos: { x: 600, y: 330 }, r: 4 },
    { id: 'lamp5', kind: 'lamp', pos: { x: 232, y: 392 }, r: 4 },
    { id: 'lamp6', kind: 'lamp', pos: { x: 408, y: 392 }, r: 4 },
    { id: 'banG', kind: 'banner', pos: { x: 20, y: 132 }, variant: 0 },
    { id: 'banM', kind: 'banner', pos: { x: 620, y: 132 }, variant: 3 },
    { id: 'banB', kind: 'banner', pos: { x: 76, y: 40 }, variant: 1 },
    { id: 'banQ', kind: 'banner', pos: { x: 564, y: 40 }, variant: 2 },
    { id: 'tutorialEmitter', kind: 'emitter', pos: { x: 320, y: 452 }, r: 6, blocksNeedle: true },
    { id: 'tutorialDoor', kind: 'sealDoor', pos: { x: 320, y: 368 } },
    { id: 'pillarA', kind: 'pillar', pos: { x: 128, y: 250 }, r: 8, tag: 'Anchorable' },
    { id: 'pillarB', kind: 'pillar', pos: { x: 512, y: 250 }, r: 8, tag: 'Anchorable' },
  ],
  exits: [
    { id: 'toGarden', rect: { x: -8, y: 144, w: 16, h: 48 }, to: 'garden', spawn: 'fromHub' },
    { id: 'toMarsh', rect: { x: 632, y: 144, w: 16, h: 48 }, to: 'marsh', spawn: 'fromHub' },
    { id: 'toBelfry', rect: { x: 96, y: -8, w: 48, h: 16 }, to: 'belfry', spawn: 'fromHub' },
    { id: 'toQuarry', rect: { x: 496, y: -8, w: 48, h: 16 }, to: 'quarry', spawn: 'fromHub' },
    { id: 'toHeart', rect: { x: 296, y: 30, w: 48, h: 12 }, to: 'arena_FINAL', spawn: 'default', requires: 'finalGate', lockedKey: 'hint.heartLocked' },
  ],
  interactables: [
    { id: 'altar', kind: 'altar', pos: { x: 208, y: 180 }, r: 22 },
    { id: 'records', kind: 'records', pos: { x: 432, y: 180 }, r: 22 },
    { id: 'muralHub', kind: 'mural', pos: { x: 232, y: 44 }, r: 20, textKey: 'mural.hub' },
  ],
  mechs: [
    { id: 'tutorialEmitter', kind: 'emitter', pos: { x: 320, y: 452 }, sig: 'Wave', shape: 'ring', period: 2.6, range: 130, unlessFlag: 'tutorialDone' },
    { id: 'tutorialDoor', kind: 'barrier', rect: { x: 288, y: 352, w: 64, h: 16 }, socket: { x: 320, y: 375 }, sig: 'Wave', flag: 'tutorialDone', visual: 'sealDoor' },
  ],
  decor: [
    { x: 304, y: 198, frame: 'decal_1' },
    { x: 256, y: 198, frame: 'decal_0' }, { x: 272, y: 198, frame: 'decal_0' }, { x: 288, y: 198, frame: 'decal_0' },
    { x: 320, y: 198, frame: 'decal_0' }, { x: 336, y: 198, frame: 'decal_0' }, { x: 352, y: 198, frame: 'decal_0' },
    { x: 304, y: 150, frame: 'decal_1' }, { x: 304, y: 246, frame: 'decal_1' },
    { x: 304, y: 424, frame: 'decal_1' },
  ],
};
