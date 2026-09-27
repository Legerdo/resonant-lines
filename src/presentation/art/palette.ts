// Master palette (37 colours). Every world pixel must come from this table.
// Order matters: indices are referenced by the art sources and by the pixel-layer renderer.
// See docs/ART_BIBLE.md for ramp usage per material.

export const PALETTE_HEX = [
  // 0-8 neutral violet-grey ramp (stone, metal, cloth shadows, UI frames)
  0x0d0b14, // 0 ink
  0x1b1826, // 1 night
  0x2a2638, // 2 dusk
  0x3d3850, // 3 slate
  0x575068, // 4 stone
  0x776e86, // 5 ash
  0x9c93a8, // 6 mist
  0xc7bfcc, // 7 pale
  0xeee8e0, // 8 bone
  // 9-14 warm earth ramp (quarry, bronze, skin, wood)
  0x2b1d1a, // 9 umber
  0x4a2f25, // 10 rust
  0x6e4633, // 11 clay
  0x9a6a45, // 12 ochre
  0xc79a63, // 13 sand
  0xe8c890, // 14 wheat
  // 15-20 green ramp (garden, roots, moss, rotational energy)
  0x14231d, // 15 forest
  0x1f3a2c, // 16 pine
  0x2f5a3a, // 17 moss
  0x4d7f45, // 18 leaf
  0x86a65a, // 19 sprout
  0xc3cf7d, // 20 lime
  // 21-25 blue ramp (marsh, water, mirror glass)
  0x101c2e, // 21 abyss
  0x1a3350, // 22 deep
  0x2a5578, // 23 tide
  0x3f81a3, // 24 lake
  0x72b6c6, // 25 foam
  // 26-36 energy accents (resonance + signatures)
  0x3ee8e0, // 26 reso (resonance cyan)
  0xb8fff4, // 27 resoLite
  0xe0762f, // 28 ember (Impact)
  0xffc05a, // 29 flare (Impact light)
  0xc23a3a, // 30 heat (Heat)
  0xff7a6b, // 31 heatLite
  0x5a2470, // 32 voidD (Void)
  0xd25fd8, // 33 voidL
  0x5a9cf0, // 34 wave (Wave)
  0xa8d4ff, // 35 waveLite
  0x1f8a8f, // 36 resoDeep
] as const;

export const P = {
  ink: 0, night: 1, dusk: 2, slate: 3, stone: 4, ash: 5, mist: 6, pale: 7, bone: 8,
  umber: 9, rust: 10, clay: 11, ochre: 12, sand: 13, wheat: 14,
  forest: 15, pine: 16, moss: 17, leaf: 18, sprout: 19, lime: 20,
  abyss: 21, deep: 22, tide: 23, lake: 24, foam: 25,
  reso: 26, resoLite: 27, ember: 28, flare: 29, heat: 30, heatLite: 31,
  voidD: 32, voidL: 33, wave: 34, waveLite: 35, resoDeep: 36,
} as const;

export type PaletteIndex = number;

/** Outline partner used by the automatic selective outline (sel-out): a darker hue-related colour, never plain black everywhere. */
export const OUTLINE_OF: readonly number[] = [
  0, 0, 0, 1, 1, 2, 3, 4, 5, // neutrals
  0, 9, 9, 10, 11, 12, // earth
  0, 15, 15, 16, 17, 18, // green
  0, 21, 21, 22, 23, // blue
  36, 36, 10, 11, 9, 30, 0, 32, 22, 23, 1, // energy
];

/** Signature colour pairs [base, light]; shapes are defined separately so colour is never the only channel. */
export const SIG_COLORS = {
  Impact: [P.ember, P.flare],
  Wave: [P.wave, P.waveLite],
  Heat: [P.heat, P.heatLite],
  Void: [P.voidD, P.voidL],
  Rotational: [P.leaf, P.lime],
} as const;

export function rgbaOf(index: number): [number, number, number, number] {
  const hex = PALETTE_HEX[index];
  if (hex === undefined) throw new Error(`palette index out of range: ${index}`);
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, 255];
}

/** ABGR packed value for little-endian Uint32 ImageData writes. */
export const PALETTE_ABGR: readonly number[] = PALETTE_HEX.map((hex) => {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
});

export function cssOf(index: number): string {
  const hex = PALETTE_HEX[index] ?? 0;
  return `#${hex.toString(16).padStart(6, '0')}`;
}
