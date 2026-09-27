// UI frames & HUD icons. Frames use the world's stone + resonance language (no glassmorphism, no rounded SaaS cards).
import { P } from '../../src/presentation/art/palette.ts';
import { grid, parse, set, type Grid } from '../lib/pixel.ts';
import type { SheetDef } from '../lib/sheet.ts';

/** 24x24 nine-slice frame, 8px corners. Band: ink rim / bevel / body / resonance inner line / fill. */
function frame(body: number, bevelHi: number, bevelLo: number, inner: number, fill: number, bracket: number): Grid {
  const g = grid(24, 24);
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      const p = Math.min(x, y, 23 - x, 23 - y);
      const corner = (x === 0 || x === 23) && (y === 0 || y === 23);
      if (corner) continue;
      let c: number;
      if (p === 0) c = P.ink;
      else if (p === 1) {
        const tl = Math.min(x, y) <= Math.min(23 - x, 23 - y);
        const isCorner = (x === 1 || x === 22) && (y === 1 || y === 22);
        c = isCorner ? P.ink : tl ? bevelHi : bevelLo;
      } else if (p === 2) c = body;
      else if (p === 3) c = inner;
      else c = fill;
      set(g, x, y, c);
    }
  }
  // inner corner brackets (3px L shapes) — read as carved resonance runes
  const br = [
    [5, 5], [6, 5], [5, 6],
    [18, 5], [17, 5], [18, 6],
    [5, 18], [6, 18], [5, 17],
    [18, 18], [17, 18], [18, 17],
  ];
  for (const [x, y] of br) set(g, x!, y!, bracket);
  return g;
}

const ICON: Record<string, number> = {
  k: P.ink, n: P.night, d: P.dusk, s: P.slate, t: P.stone, a: P.ash, m: P.mist, p: P.pale, b: P.bone,
  c: P.reso, C: P.resoLite, r: P.resoDeep, e: P.ember, f: P.flare, h: P.heat, H: P.heatLite,
  v: P.voidD, V: P.voidL, w: P.wave, W: P.waveLite, g: P.leaf, G: P.lime, o: P.ochre, O: P.sand,
};

const icons: Record<string, string[]> = {
  // Shield pip (intact): faceted resonance shard
  shield: [
    '....kkkk....',
    '...kCCcck...',
    '..kCCccccr..',
    '..kCcccccrk.',
    '..kCccccrrk.',
    '..kcccccrrk.',
    '..kccccrrrk.',
    '...kcccrrk..',
    '...kccrrrk..',
    '....kcrrk...',
    '.....krk....',
    '......k.....',
  ],
  shieldBroken: [
    '....kkkk....',
    '...ks..sk...',
    '..ks....dk..',
    '..ks.k..dk..',
    '..k..kk.dk..',
    '..k...k..k..',
    '..k..kk..k..',
    '...k.k..k...',
    '...k....k...',
    '....k..k....',
    '.....kk.....',
    '............',
  ],
  // Core: amber heart gem
  core: [
    '............',
    '..kk....kk..',
    '.kffk..kfek.',
    'kfffekkfeeek',
    'kffeeeeeeeek',
    'kfeeeeeeeeok',
    '.keeeeeeeok.',
    '..keeeeeok..',
    '...keeeok...',
    '....keok....',
    '.....kk.....',
    '............',
  ],
  coreBroken: [
    '............',
    '..kk....kk..',
    '.k..k..k.dk.',
    'k....kk...dk',
    'k...k.....dk',
    'k....k....dk',
    '.k....k..dk.',
    '..k..k...k..',
    '...k..k.k...',
    '....k..k....',
    '.....kk.....',
    '............',
  ],
  // Needle icon (held)
  needle: [
    '..........kk',
    '.........kCk',
    '........kCk.',
    '.......kck..',
    '......kck...',
    '.....kck....',
    '....kck.....',
    '...krk......',
    '..kprk......',
    '.kppk.......',
    'kmmk........',
    'kkk.........',
  ],
  needleOut: [
    '..........kk',
    '.........k.k',
    '........k.k.',
    '.......k.k..',
    '......k.k...',
    '.....k.k....',
    '....k.k.....',
    '...k.k......',
    '..k.kk......',
    '.k..k.......',
    'k..k........',
    'kkk.........',
  ],
  needleDisabled: [
    '..........kk',
    '.........ksk',
    '........ksk.',
    '.......ktk..',
    '......ktk...',
    '....k.ktk...',
    '...kkktk....',
    '...ktk.k....',
    '..ksk.......',
    '.ksk........',
    'ktk.........',
    'kk..........',
  ],
  // Signature glyph shapes (shape-first; colour second)
  sigImpact: [
    '............',
    '............',
    'kkkk....kkkk',
    'kffk....kffk',
    'kfek....kfek',
    'kfekkkkkkfek',
    'kfeffffffeek',
    'kfeeeeeeeeek',
    'kkkkkkkkkkkk',
    '............',
    '............',
    '............',
  ],
  sigWave: [
    '...kkkkkk...',
    '..kWWWWWwk..',
    '.kWkkkkkkwk.',
    'kWk......kwk',
    'kWk..kk..kwk',
    'kWk.kWwk.kwk',
    'kWk.kwwk.kwk',
    'kWk..kk..kwk',
    'kWk......kwk',
    '.kwkkkkkkwk.',
    '..kwwwwwwk..',
    '...kkkkkk...',
  ],
  sigHeat: [
    '..k..k..k...',
    '.kHk.kHk.kHk',
    '.kHk.kHk.kHk',
    '.khk.khk.khk',
    'kHk.kHk.kHk.',
    'kHk.kHk.kHk.',
    'khk.khk.khk.',
    '.kHk.kHk.kHk',
    '.kHk.kHk.kHk',
    '.khk.khk.khk',
    '..k...k...k.',
    '............',
  ],
  sigVoid: [
    '............',
    '............',
    '............',
    'kkk..kkk..kk',
    'kVk.kVVk.kVk',
    'kvk.kvvk.kvk',
    'kkk..kkk..kk',
    '............',
    '.kk..kkk..kk',
    '.kVk.kVk.kVk',
    '..kk..kk..kk',
    '............',
  ],
  sigRotational: [
    '...kkkkkk...',
    '..kGGGGGgk..',
    '.kGkkkkkkgk.',
    'kGk.kkkk.kgk',
    'kGk.kGgk.kgk',
    'kGk.kgkk.kgk',
    'kGk.kgk..kgk',
    'kGk..kk.kgk.',
    'kGk....kgk..',
    '.kgkkkkgk...',
    '..kgggggk...',
    '...kkkkk....',
  ],
  // Boss seal glyph (intact / broken)
  seal: [
    '....kkkk....',
    '..kkmppmkk..',
    '.kmpkkkkpmk.',
    '.kpk.cc.kpk.',
    'kmk.cCCc.kmk',
    'kpk.cCCc.kpk',
    'kpk.cccc.kpk',
    'kmk..cc..kmk',
    '.kpk....kpk.',
    '.kmpkkkkpmk.',
    '..kkmppmkk..',
    '....kkkk....',
  ],
  sealBroken: [
    '....kkkk....',
    '..kk.....k..',
    '.k.......k..',
    '.k.....k....',
    'k.....k...k.',
    'k....kk...k.',
    '.k..k.....k.',
    '....k.....k.',
    '.k.k.....k..',
    '.k.......k..',
    '..kk....k...',
    '....kkk.....',
  ],
  sealCore: [
    '....kkkk....',
    '..kkeffekk..',
    '.kefkkkkfek.',
    '.kfk.ff.kfk.',
    'kek.fbbf.kek',
    'kfk.fbbf.kfk',
    'kfk.ffff.kfk',
    'kek..ff..kek',
    '.kfk....kfk.',
    '.kefkkkkfek.',
    '..kkeffekk..',
    '....kkkk....',
  ],
  pulse: [
    '............',
    '.....kk.....',
    '....kCck....',
    '...kCcck....',
    'kkkkCccckkk.',
    'kCCCCccccck.',
    'kcccccccrrk.',
    'kkkkcccrkkk.',
    '...kccrk....',
    '....kcrk....',
    '.....kk.....',
    '............',
  ],
  link: [
    '............',
    '.kk.........',
    'kCck........',
    'kcrkk.......',
    '.kkcck......',
    '...kcck.....',
    '....kcck....',
    '.....kcck...',
    '......kcckk.',
    '.......kkCck',
    '.........krk',
    '..........k.',
  ],
};

export function uiSheets(): SheetDef[] {
  const frames = [
    { name: 'frame', grid: frame(P.slate, P.stone, P.dusk, P.resoDeep, P.night, P.resoDeep) },
    { name: 'frameFocus', grid: frame(P.stone, P.mist, P.slate, P.reso, P.dusk, P.resoLite) },
    { name: 'frameDim', grid: frame(P.dusk, P.slate, P.night, P.slate, P.night, P.slate) },
    { name: 'frameWarn', grid: frame(P.rust, P.clay, P.umber, P.ember, P.night, P.flare) },
  ];
  const iconFrames = Object.entries(icons).map(([name, rows]) => ({ name, grid: parse(rows, ICON, 12, 12) }));
  return [
    { key: 'ui_frames', dir: 'ui', cw: 24, ch: 24, frames },
    { key: 'ui_icons', dir: 'ui', cw: 12, ch: 12, cols: 8, frames: iconFrames },
  ];
}
