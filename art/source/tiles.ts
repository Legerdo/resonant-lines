// 16x16 region tiles. Each region has its own ground cluster language, wall silhouette and anchor design
// (not recolours). The renderer composes them with neighbour rules (face/top/rim/shadow) — see presentation/tiles.ts.
import { P } from '../../src/presentation/art/palette.ts';
import { parse, grid, set, get, type Grid, type Legend } from '../lib/pixel.ts';
import type { FrameDef, SheetDef } from '../lib/sheet.ts';

function tile(rows: readonly string[], legend: Legend, name: string): Grid {
  if (rows.length !== 16 || rows.some((r) => r.length !== 16)) {
    throw new Error(`tile ${name}: expected 16x16, got ${rows.map((r) => r.length).join(',')} (${rows.length} rows)`);
  }
  return parse(rows, legend, 16, 16);
}

export function rot90(g: Grid): Grid {
  const o = grid(g.h, g.w);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) set(o, g.h - 1 - y, x, get(g, x, y));
  return o;
}
function flipH(g: Grid): Grid {
  const o = grid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) set(o, g.w - 1 - x, y, get(g, x, y));
  return o;
}

type TileSet = Record<string, readonly string[]>;

// ---------------------------------------------------------------- HUB: polished slabs, resonance inlay, ribbed walls
const HUB_L: Legend = { k: P.ink, n: P.night, d: P.dusk, s: P.slate, t: P.stone, a: P.ash, m: P.mist, p: P.pale, q: P.resoDeep, e: P.reso, E: P.resoLite };
const HUB: TileSet = {
  floor_0: [
    'tsssssssssssssss', 'sddddddddddddddd', 'sdddddddddddsddd', 'sddddddddddssdnd', 'sddddddddddddddd', 'sddsdddddddddddd',
    'sdssddddddddnddd', 'sddddddddddnnddd', 'sddddddddddddddd', 'sddddddddddddddd', 'sdddnddddddddddd', 'sddnnddddddsdddd',
    'sddddddddddddddd', 'sddddddddddddddd', 'sddddddddddddddd', 'sddddddddddddddd',
  ],
  floor_1: [
    'sssssssssssssssn', 'dddddddddddddddn', 'dddddsdddddddddn', 'ddddssddddddddnn', 'dddddddddddddddn', 'dddddddddddddddn',
    'ddddddddnddddddn', 'dddddddnnddddddn', 'ddddddnnddddddsn', 'dddddddddddddddn', 'dddddddddddddddn', 'dddsdddddddddddn',
    'dddddddddddddddn', 'dddddddddddddddn', 'dddddddddddddddn', 'dddddddddddddddn',
  ],
  floor_2: [
    'sddddddddddddddd', 'sddddddddddddddd', 'sddddddsdddddddd', 'sddddddddddddddd', 'sddddddddddddddd', 'sddnnddddddddddd',
    'sdddnddddddddddd', 'sddddddddddddddd', 'sddddddddddddddd', 'sddddddddddsdddd', 'sdddddddddssdddd', 'sddddddddddddddd',
    'sddddddddddddddd', 'sddddddddddddddd', 'sddddddddddddddd', 'nnnnnnnnnnnnnnnn',
  ],
  floor_3: [
    'dddddddddddddddn', 'dddddddddddddddn', 'ddddddddddsddddn', 'dddddddddddddddn', 'ddnddddddddddddn', 'ddnnddddddddddnn',
    'dddddddddddddddn', 'dddddddddddddddn', 'dddddddsdddddddn', 'ddddddssdddddddn', 'dddddddddddddddn', 'dddddddddddddddn',
    'dddddddddddnnddn', 'ddddddddddddnddn', 'dddddddddddddddn', 'nnnnnnnnnnnnnnnn',
  ],
  wallTop_0: [
    'ssssssssssssssss', 'sttttttssttttttn', 'sttttttssttttttn', 'stttttassttttttn', 'sttttttssttattdn', 'sttttttssttttttn',
    'sddddddnnddddddn', 'nnnnnnnnnnnnnnnn', 'sssssssssssssssn', 'stttttttttttttdn', 'sttttattttttttdn', 'stttttttttttattn',
    'stttttttttttttdn', 'stttttttttttttdn', 'sddddddddddddddn', 'nnnnnnnnnnnnnnnn',
  ],
  wallTop_1: [
    'ssssssssssssssss', 'stttttttttttttdn', 'sttattttttttttdn', 'stttttttttttttdn', 'stttttttttatttdn', 'stttttttttttttdn',
    'sddddddddddddddn', 'nnnnnnnnnnnnnnnn', 'sssssssnssssssss', 'sttttttnsttttttd', 'sttttttnstattttd', 'sttttttnsttttttd',
    'statttnnsttttttd', 'sttttttnsttttttd', 'sddddddndddddddd', 'nnnnnnnnnnnnnnnn',
  ],
  wallFace_0: [
    'tttttttttttttttd', 'saaaaassaaaaassn', 'stttttnstttttnsn', 'stttttnstttttnsn', 'staattnstaattnsn', 'stttttnstttttnsn',
    'stttttnstttttnsn', 'stttttnstttttnsn', 'sddtttnsddtttnsn', 'stttttnstttttnsn', 'stttttnstttttnsn', 'sddddddsddddddsn',
    'sddddddsddddddsn', 'dnnnnnndnnnnnndn', 'nnnnnnnnnnnnnnnn', 'kkkkkkkkkkkkkkkk',
  ],
  wallFace_1: [
    'tttttttttttttttd', 'saaaaaaaaaaaaasn', 'sttttttttttttnsn', 'stttqqqqqqtttnsn', 'sttqeeeeeeqttnsn', 'sttqeqqqqeqttnsn',
    'sttqeqttqeqttnsn', 'sttqeqqqqeqttnsn', 'sttqeeeeeeqttnsn', 'stttqqqqqqtttnsn', 'sttttttttttttnsn', 'sddddddddddddssn',
    'sddddddddddddssn', 'dnnnnnnnnnnnnndn', 'nnnnnnnnnnnnnnnn', 'kkkkkkkkkkkkkkkk',
  ],
  anchorFace: [
    'mmmmmmmmmmmmmmma', 'mppppppppppppppa', 'mpaaaaaaaaaaaaat', 'mpaaaaqqqqaaaaat', 'mpaaaqeeeeqaaaat', 'mpaaqeqqqqeqaaat',
    'mpaaqeqEEqeqaaat', 'mpaaqeqEEqeqaaat', 'mpaaqeqqqqeqaaat', 'mpaaaqeeeeqaaaat', 'mpaaaaqqqqaaaaat', 'mpaaaaaaaaaaaaat',
    'mattttttttttttts', 'tssssssssssssssn', 'nnnnnnnnnnnnnnnn', 'kkkkkkkkkkkkkkkk',
  ],
  anchorTopE: [
    'ssssssssssssmpat', 'stttttttttttmpat', 'stttttttttttmqet', 'sttattttttttmqEt', 'stttttttttttmqet', 'stttttttttttmpat',
    'sdddddddddddmpat', 'nnnnnnnnnnnnmpat', 'ssssssssssssmpat', 'stttttttttttmqet', 'stttttttttttmqEt', 'sttttttattttmqet',
    'stttttttttttmpat', 'stttttttttttmpat', 'sdddddddddddmpat', 'nnnnnnnnnnnnmaat',
  ],
  decal_0: [
    '................', '................', '................', '................', '................', '................',
    '................', 'qqqqqqqeqqqqqqqq', '................', '................', '................', '................',
    '................', '................', '................', '................',
  ],
  decal_1: [
    '................', '................', '................', '................', '................', '......qqqq......',
    '.....qeeeeq.....', '.....qeEEeq.....', '.....qeEEeq.....', '.....qeeeeq.....', '......qqqq......', '................',
    '................', '................', '................', '................',
  ],
  decal_2: [
    '................', '................', '...n............', '...nn...........', '....n...........', '....nn..........',
    '.....n..........', '.....nn.........', '......n.........', '................', '................', '................',
    '................', '................', '................', '................',
  ],
};

// ---------------------------------------------------------------- QUARRY: rough ash ground, pebbles, stratified rock
const QUA_L: Legend = { k: P.ink, n: P.night, u: P.umber, r: P.rust, c: P.clay, o: P.ochre, y: P.sand, w: P.wheat, d: P.dusk, s: P.slate, t: P.stone, a: P.ash, m: P.mist, q: P.resoDeep, e: P.reso, E: P.resoLite };
const QUARRY: TileSet = {
  floor_0: [
    'ssssstssssssssss', 'sssssssssssrssss', 'ssrsssssssstssss', 'sssssssaassssssr', 'sssssssttsssssss', 'ssssssssssssssss',
    'sssrssssssssssss', 'ssttssssssssrsss', 'sssssssssssssssr', 'ssssssssrrssssss', 'sssssssssrsssaas', 'ssssssssssssstts',
    'sasssssssssssssr', 'sttssssssrssssss', 'ssssssssssssssss', 'sssssrssssssssss',
  ],
  floor_1: [
    'ssssssssssssssss', 'ssssssrsssssssss', 'sssssssssssaasss', 'ssaasssssssttsss', 'ssttssrsssssssss', 'ssssssssssssssrs',
    'ssssssssssssssss', 'ssssrrrssssssss' + 's', 'sssrrssssssaasss', 'ssssssssssssttss', 'ssssssssssssssss', 'srssssssssssssss',
    'ssssssaassssssss', 'ssssssttssssrsss', 'ssssssssssssssss', 'sssssssssrssssss',
  ],
  floor_2: [
    'ssssssssssssssss', 'sssaaaaaassssss' + 's', 'ssatttttaassssss', 'satttttttaasssss', 'sattttttttassrss', 'sstttttttaasssss',
    'sssttttaassssss' + 's', 'ssssssssssssssss', 'sssssssssrssssss', 'ssssssssrrssssss', 'ssssssssssssssss', 'ssssssssssssaass',
    'ssrsssssssssttss', 'ssssssssssssssss', 'sssssssssssrssss', 'ssssssssssssssss',
  ],
  floor_3: [
    'sssssssrssssssss', 'ssssssrrssssssss', 'sssssrssssssssss', 'ssssrrssssssssss', 'sssrsssssssrssss', 'ssrssssssssrssss',
    'sssssssssssrrsss', 'ssssssssssssrsss', 'ssaassssssssrrss', 'sstsssssssssssrs', 'ssssssssssssssss', 'ssssssaassssssss',
    'ssssssttssssssss', 'ssssssssssssssss', 'ssssssssssssssrs', 'ssssssssssssssss',
  ],
  wallTop_0: [
    'ooyyyoooooyyoooo', 'oyyyyyooooyyyooc', 'ooyyooooooooooco', 'coooooooccoooocc', 'rrrrrrrrrrrrrrrr', 'cccccccccccccccc',
    'ccoocccccccooccc', 'cooooccccccoooc' + 'c', 'rrrrrrrrrrrrrrrr', 'uurruuuuurruuuuu', 'cccccccccccccccc', 'cccocccccccccocc',
    'ccooocccccccoooc', 'rrrrrrrrrrrrrrrr', 'uuuuuuuuuuuuuuuu', 'uurrrruuuurrrruu',
  ],
  wallTop_1: [
    'oooooyyyoooooooo', 'oooyyyyyyooooyoo', 'ocoooyyooooooooc', 'cccooooocccooocc', 'rrrrrrrrrrrrrrrr', 'cccccccccccccccc',
    'cccccooccccccccc', 'ccccoooocccccooc', 'rrrrrrrrrrrrrrrr', 'uuuuuurruuuuuruu', 'cccccccccccccccc', 'ccoocccccccocccc',
    'coooccccccooocc' + 'c', 'rrrrrrrrrrrrrrrr', 'uuuuuuuuuuuuuuuu', 'uuuurrruuuuurrru',
  ],
  wallFace_0: [
    'oyoooyyooooyyooo', 'cooocooocooooocc', 'rrrrrrrrrrrrrrrr', 'ccccccoocccccccc', 'cccooooooccccccc', 'cccccccccccooccc',
    'rrrrrrrrrrrrrrrr', 'uuurruuuuuuuruuu', 'ccccccccccoocccc', 'cooccccccooooccc', 'rrrrrrrrrrrrrrrr', 'uuuuuruuuuuuuuru',
    'uuuuuuuuuuuuuuuu', 'nuuunnuuuuunnuuu', 'nnnnnnnnnnnnnnnn', 'kkkkkkkkkkkkkkkk',
  ],
  wallFace_1: [
    'oooyyoooooooyooo', 'ccooccccooooccco', 'rrrrrrrrrrrrrrrr', 'cccccccccccccccc', 'ccooocccccccoccc', 'ccccccccccoooocc',
    'rrrrrrrrrrrrrrrr', 'uuuuuuurruuuuuuu', 'ccccoocccccccccc', 'ccoooocccccoocc' + 'c', 'rrrrrrrrrrrrrrrr', 'uuurruuuuuuuuruu',
    'uuuuuuuuuuuuuuuu', 'nuuuuunnnuuuuunn', 'nnnnnnnnnnnnnnnn', 'kkkkkkkkkkkkkkkk',
  ],
  anchorFace: [
    'wwwwwwwwwwwwwwwy', 'wyyyyyyyyyyyyyyo', 'wyyoyyyyyyyyoyyo', 'wyyyyyyqqyyyyyyo', 'wyyyyyqeeqyyyyyo', 'wyoyyqeEEeqyyoyo',
    'wyyyyqeEEeqyyyyo', 'wyyyyyqeeqyyyyyo', 'wyyyyyyqqyyyyyyo', 'wyyoyyyyyyyyoyyo', 'wyyyyyyyyyyyyyyo', 'woooooooooooooor',
    'occcccccccccccrr', 'rrrrrrrrrrrrrrrr', 'nnnnnnnnnnnnnnnn', 'kkkkkkkkkkkkkkkk',
  ],
  anchorTopE: [
    'ooyyyoooooooywyo', 'oyyyyyooooooywyo', 'ooyyooooooooyqeo', 'cooooooocccoyqEo', 'rrrrrrrrrrrryqeo', 'ccccccccccccywyo',
    'ccoocccccccoywyo', 'coooocccccccywyo', 'rrrrrrrrrrrryqeo', 'uurruuuuurruyqEo', 'ccccccccccccyqeo', 'cccoccccccccywyo',
    'ccooocccccccywyo', 'rrrrrrrrrrrryooo', 'uuuuuuuuuuuuyoor', 'uurrrruuuurrrorr',
  ],
  decal_0: [
    '................', '................', '.....tt.........', '....taat........', '....atta....t...', '.....tt....tat..',
    '...........at...', '................', '..t.............', '.tat............', '..t.......tt....', '.........tmmt...',
    '.........tmmt...', '..........tt....', '................', '................',
  ],
  decal_1: [
    '................', '................', '................', '.......r........', '......rr........', '.....rr.........',
    '.....r..........', '....rr..........', '.....rr.........', '......r.........', '......rr........', '.......r........',
    '................', '................', '................', '................',
  ],
  decal_2: [
    '................', '................', '................', '................', '.....aaaaa......', '...aattttaaa....',
    '..atttttttttaa..', '..atttttttttta..', '...aatttttaaa...', '.....aaaaa......', '................', '................',
    '................', '................', '................', '................',
  ],
};

// ---------------------------------------------------------------- GARDEN: cracked tiles under moss, roots, leafy hedge walls
const GAR_L: Legend = { k: P.ink, n: P.night, f: P.forest, i: P.pine, g: P.moss, l: P.leaf, z: P.sprout, L: P.lime, d: P.dusk, s: P.slate, t: P.stone, a: P.ash, u: P.umber, r: P.rust, c: P.clay, q: P.resoDeep, e: P.reso, E: P.resoLite };
const GARDEN: TileSet = {
  floor_0: [
    'sssssssnsssssssn', 'stttttsnstttttsn', 'stttttsnstttttsn', 'stttttsnstttgtsn', 'sttttssnsttgglsn', 'ssssssnnsssglgsn',
    'nnnnnnnnnnnglnnn', 'sssnsssssssglssn', 'sttnsttttttgttsn', 'sttnstttttttttsn', 'sttnsttttttttssn', 'sssnsssssssssssn',
    'nnnnnnnnnnnnnnnn', 'sssssssnsssssssn', 'stttttsnstttttsn', 'stttttsnstttttsn',
  ],
  floor_1: [
    'ssgggsssnsssssss', 'sgllgggsnsttttts', 'glllllggnsttttts', 'gllzllgnnsttttts', 'glllllggnsttttss', 'sggllgssnsssssss',
    'nnnggnnnnnnnnnnn', 'sssssssssssnssss', 'sttttttttttnstts', 'stttttttttsnstts', 'sssssssssssnssss', 'nnnnnnnnnnnnnnnn',
    'ssssnsssssssssss', 'sttsnsttttttgggs', 'sttsnstttttglllg', 'ssssnssssssglzlg',
  ],
  floor_2: [
    'gggggsssnsssgggg', 'gllllggsnsggllll', 'llzllllgnglllzll', 'llllllllglllllll', 'lllllllllllllllg', 'glllllzllllllggs',
    'ggglllllllllggnn', 'ssggglllllgggsss', 'sttsgggllggstttn', 'sttsnsgggsnstttn', 'ssssnssssssnsssn', 'nnnnnnnnnnnnnnnn',
    'sssssnsssssssnss', 'stttsnsttttttnst', 'stttsnsttttttnst', 'sssssnsssssssnss',
  ],
  floor_3: [
    'sssssssnsssssssn', 'stttttsnstttttsn', 'stttuusnsttttssn', 'sttuuutnstttuusn', 'stuucsuuuuuuutsn', 'suucssnsssnsuusn',
    'nuunnnnnnnnnnuun', 'suusssssssssuusn', 'stuutttttttuutsn', 'sttuuuttttuuttsn', 'ssssuuuuuuussssn', 'nnnnnnnnnnnnnnnn',
    'sssssssnsssssssn', 'stttttsnstttttsn', 'stttttsnstttttsn', 'ssssssnnssssssnn',
  ],
  wallTop_0: [
    'ilzllllizlllllzi', 'lzLllzlllzLllzll', 'lllllllllllllllg', 'glzlllgllllzllgg', 'gllllggglllllggi', 'iglllgiigglllgii',
    'iigggiiiiigggiii', 'ilgggliiilgggili', 'lzllllllllzlllll', 'lllllzlllllllzll', 'glllllllgllllllg', 'ggllgggiggllgggi',
    'iiggiiiiiiggiiii', 'iiiiiiiiiiiiiiii', 'ifiiiiffiiiiifii', 'ffiiffffffiifffi',
  ],
  wallTop_1: [
    'lllzllllllllzlll', 'llLlllzllllLllll', 'lllllllllzllllll', 'ggllllglllllllgg', 'iggllggiggllllgi', 'iiigggiiiiggggii',
    'iilzliiiiiiiilzl', 'ilzllliiiiiilzll', 'llllllllizllllll', 'zlllllzllllllzll', 'gglllllgglllllgg', 'iigglggiiiglggii',
    'iiiiiiiiiiiiiiii', 'iifiiiiiiifiiiii', 'ffiiffiiiffiiffi', 'ffffffffffffffff',
  ],
  wallFace_0: [
    'lzllglllllgllzll', 'gglliggllggiillg', 'itttiittttiitttt', 'tsaatsaaaatsaats', 'tsttssttttsstsst', 'tstttsttgtsttsst',
    'tsttssttglsstsst', 'tsttgsttgisstsst', 'tstggistttssttst', 'tsttgsttttsstlst', 'tsttgsttttsstgst', 'tssssssssssssgss',
    'nsssssssssssssgs', 'nnnnnnnnnnnnnnin', 'nnnnnnnnnnnnnnnn', 'kkkkkkkkkkkkkkkk',
  ],
  wallFace_1: [
    'llzlllglllzllgll', 'gilgggiilggggilg', 'itttiittttiitttt', 'tsaatsaaaatsaats', 'tsttssttttsstsst', 'tstttsttttsttsst',
    'tsgtssttttsstsst', 'tsgissttttsstsst', 'tsgttsttttssttst', 'tlgtssttttsstsst', 'tgttssttttsstsst', 'tgsssssssssssssn',
    'ngssssssssssssss', 'ninnnnnnnnnnnnnn', 'nnnnnnnnnnnnnnnn', 'kkkkkkkkkkkkkkkk',
  ],
  anchorFace: [
    'lzllglllllgllzll', 'gglliggllggiillg', 'atttttttttttttta', 'taaaaaaaaaaaaaat', 'taaaaaaqqaaaaaat', 'taaaaaqeeqaaaaat',
    'tagaaqeEEeqaagat', 'tgaaaqeEEeqaaalt', 'tlgaaaqeeqaaaglt', 'tglaaaaqqaaaagit', 'tiglaaaaaaaaglit', 'tsiglllllllgliss',
    'nsiiggggggggiisn', 'nnnnnnnnnnnnnnnn', 'nnnnnnnnnnnnnnnn', 'kkkkkkkkkkkkkkkk',
  ],
  anchorTopE: [
    'ilzllllizllltaat', 'lzLllzlllzlltaat', 'lllllllllllltqet', 'glzlllgllllltqEt', 'gllllggglllltqet', 'iglllgiiggggtaat',
    'iigggiiiiiggtaat', 'ilgggliiilggtaat', 'lzlllllllllltqet', 'lllllzlllllltqEt', 'glllllllgllltqet', 'ggllgggiggggtaat',
    'iiggiiiiiiggtaat', 'iiiiiiiiiiiitaat', 'ifiiiiffiiiitaat', 'ffiiffffffiittat',
  ],
  decal_0: [
    '................', '................', '.......u........', '......uu........', '.....uu.........', '....uu...uu.....',
    '...uu...uu......', '..uu...uu.......', '..u...uu........', '.....uu.........', '....uu..........', '................',
    '................', '................', '................', '................',
  ],
  decal_1: [
    '................', '................', '................', '......gg........', '.....glzg.......', '....glllg..gg...',
    '.....ggg..glzg..', '..........gllg..', '...gg......gg...', '..glzg..........', '..glg...........', '...g............',
    '................', '................', '................', '................',
  ],
  decal_2: [
    '................', '................', '................', '................', '.....z....z.....', '....zLz..zLz....',
    '.....z....z.....', '................', '.......z........', '......zLz.......', '.......z........', '................',
    '................', '................', '................', '................',
  ],
};

// ---------------------------------------------------------------- BELFRY: bronze-nailed boards, violet brick, bronze anchor plates
const BEL_L: Legend = { k: P.ink, n: P.night, d: P.dusk, s: P.slate, t: P.stone, a: P.ash, m: P.mist, u: P.umber, r: P.rust, c: P.clay, o: P.ochre, y: P.sand, w: P.wheat, v: P.voidD, q: P.resoDeep, e: P.reso, E: P.resoLite };
const BELFRY: TileSet = {
  floor_0: [
    'cccccccccccccccr', 'coooooooooooooor', 'coooooooyoooooor', 'rrrrrrrrrrrrrrrr', 'cccccccrccccccccc'.slice(0, 16), 'cooooooroooooooo',
    'cooyooorooooooyo', 'rrrrrrrrrrrrrrrr', 'cccccccccccrcccc', 'oooooooooooroooo', 'ooooyooooooroooo', 'rrrrrrrrrrrrrrrr',
    'cccrcccccccccccc', 'ooorooooooooooyo', 'ooorooooooooooo' + 'o', 'rrrrrrrrrrrrrrrr',
  ],
  floor_1: [
    'cccccccccccrcccc', 'oooooooooooroooo', 'ooyooooooooroooo', 'rrrrrrrrrrrrrrrr', 'ccccrccccccccccc', 'oooorooooooyoooo',
    'oooorooooooooooo', 'rrrrrrrrrrrrrrrr', 'cccccccccccccccr', 'ooooooooyooooooo', 'ooooooooooooooor', 'rrrrrrrrrrrrrrrr',
    'ccccccccrccccccc', 'oyoooooorooooooo', 'oooooooorooooooo', 'rrrrrrrrrrrrrrrr',
  ],
  floor_2: [
    'dddddddddddddddn', 'dssssssssssssssn', 'dsaaaaaaaaaaaasn', 'dsawwwwwwwwwwasn', 'dsawyyyyyyyywasn', 'dsawyooooooywasn',
    'dsawyoyyyyoywasn', 'dsawyoyooyoywasn', 'dsawyoyooyoywasn', 'dsawyoyyyyoywasn', 'dsawyooooooywasn', 'dsawyyyyyyyywasn',
    'dsawwwwwwwwwwasn', 'dsaaaaaaaaaaaasn', 'dssssssssssssssn', 'nnnnnnnnnnnnnnnn',
  ],
  floor_3: [
    'cccccccccccccccr', 'coooooooooooooor', 'cooooooooooooyor', 'rrrrrrrrrrrrrrrr', 'cccccccrcccccccc', 'ooooooorooyooooo',
    'ooooooorooooooo' + 'o', 'rrrrrrrrrrrrrrrr', 'uuuuuuuuuuuuuuuu', 'uuuuuuuuuuuuuuuu', 'rrrrrrrrrrrrrrrr', 'cccccccccccrcccc',
    'ooooooooooorooyo', 'ooooyooooooroooo', 'ooooooooooorooo' + 'o', 'rrrrrrrrrrrrrrrr',
  ],
  wallTop_0: [
    'aaaaaaamaaaaaaam', 'attttttattttttta', 'atsssstattsssstd', 'atsssstattsssstd', 'atttttdadttttttd', 'addddddaddddddda',
    'mnnnnnnnmnnnnnnn', 'aaaamaaaaaaamaaa', 'ttttattttttttatt', 'sssstaddsssstads', 'sssstaddsssstads', 'ttttdadtttttdadt',
    'ddddnaddddddnadd', 'nnnnnnnnnnnnnnnn', 'aaaaaaamaaaaaaam', 'attttttattttttta',
  ],
  wallTop_1: [
    'aaamaaaaaaamaaaa', 'ttttattttttttatt', 'sssstaddsssstads', 'sssstaddsssstads', 'ttttdadtttttdadt', 'ddddnaddddddnadd',
    'nnnnnnnnnnnnnnnn', 'aaaaaaamaaaaaaam', 'attttttattttttta', 'atsssstattsssstd', 'atsssstattsssstd', 'atttttdadttttttd',
    'addddddaddddddda', 'nnnnnnnnnnnnnnnn', 'aaamaaaaaaamaaaa', 'ttttattttttttatt',
  ],
  wallFace_0: [
    'aaaaaaaaaaaaaaam', 'attttttttttttttd', 'atssddddddddsstd', 'atsdnnnnnnnndstd', 'atdnvvvvvvvvndtd', 'atdnvvvvvvvvndtd',
    'atdnvvvvvvvvndtd', 'atdnvvvvvvvvndtd', 'atdnvvvvvvvvndtd', 'atdnnnnnnnnnndtd', 'atddddddddddddtd', 'attttttttttttttd',
    'adddddddddddddd' + 'd', 'nnnnnnnnnnnnnnnn', 'nnnnnnnnnnnnnnnn', 'kkkkkkkkkkkkkkkk',
  ],
  wallFace_1: [
    'aaaamaaaaaaamaaa', 'ttttattttttttatt', 'sssstaddsssstads', 'sssstaddsssstads', 'ttttdadtttttdadt', 'ddddnaddddddnadd',
    'nnnnnnnnnnnnnnnn', 'aaaaaaamaaaaaaam', 'attttttattttttta', 'atsssstattsssstd', 'atsssstattsssstd', 'atttttdadttttttd',
    'addddddaddddddda', 'nnnnnnnnnnnnnnnn', 'nnnnnnnnnnnnnnnn', 'kkkkkkkkkkkkkkkk',
  ],
  anchorFace: [
    'aaaaaaaaaaaaaaam', 'arrrrrrrrrrrrrrd', 'arwwwwwwwwwwwwrd', 'arwyyyyqqyyyyord', 'arwyyyqeeqyyyord', 'arwyyqeEEeqyyord',
    'arwyyqeEEeqyyord', 'arwyyyqeeqyyyord', 'arwyyyyqqyyyyord', 'arwooooooooooord', 'arrrrrrrrrrrrrrd', 'attttttttttttttd',
    'adddddddddddddd' + 'd', 'nnnnnnnnnnnnnnnn', 'nnnnnnnnnnnnnnnn', 'kkkkkkkkkkkkkkkk',
  ],
  anchorTopE: [
    'aaaaaaamaaaarwyr', 'attttttattttrwyr', 'atsssstattssrqer', 'atsssstattssrqEr', 'atttttdadtttrqer', 'addddddaddddrwyr',
    'mnnnnnnnmnnnrwyr', 'aaaamaaaaaaarwyr', 'ttttattttttarqer', 'sssstaddssssrqEr', 'sssstaddssssrqer', 'ttttdadtttttrwyr',
    'ddddnaddddddrwyr', 'nnnnnnnnnnnnrwyr', 'aaaaaaamaaaarrrr', 'attttttatttttttr',
  ],
  decal_0: [
    '................', '................', '................', '................', '.......y........', '......yoy.......',
    '.......y........', '................', '................', '................', '................', '................',
    '................', '................', '................', '................',
  ],
  decal_1: [
    '................', '................', '...rr...........', '....rr..........', '.....r..........', '.....rr.........',
    '......rr........', '.......r........', '.......rr.......', '........r.......', '................', '................',
    '................', '................', '................', '................',
  ],
  decal_2: [
    '................', '................', '................', '.....dddddd.....', '....dnnnnnnd....', '....dn....nd....',
    '....dn....nd....', '....dnnnnnnd....', '.....dddddd.....', '................', '................', '................',
    '................', '................', '................', '................',
  ],
};

// ---------------------------------------------------------------- MARSH: shallow mirror water, mud banks, reed-stone walls
const MAR_L: Legend = { k: P.ink, n: P.night, A: P.abyss, D: P.deep, T: P.tide, K: P.lake, F: P.foam, d: P.dusk, s: P.slate, t: P.stone, a: P.ash, m: P.mist, p: P.pale, b: P.bone, i: P.pine, g: P.moss, l: P.leaf, u: P.umber, r: P.rust, q: P.resoDeep, e: P.reso, E: P.resoLite };
const MARSH: TileSet = {
  floor_0: [
    'DDDDDDDDDDDDDDDD', 'DDDDDDDDDTTTDDDD', 'DDDDDDDDDDDDDDDD', 'DDTTTTDDDDDDDDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDKDDD', 'DDDDDDDTTTTDDDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD', 'DTTDDDDDDDDDDDDD', 'DDDDDDDDDDDDTTTD',
    'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD', 'DDDDTTTDDDDDDDDD', 'DDDDDDDDDDDDDDDD',
  ],
  floor_1: [
    'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDTTTTDDDDDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDKD', 'DDDDDDDDDDDTTTDD',
    'DDDDDDDDDDDDDDDD', 'DDTTDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDDDTTTTTDDDD', 'DDDDDDDDDDDDDDDD',
    'DKDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDTTDDD', 'DDDDDDDDDDDDDDDD',
  ],
  floor_2: [
    'DDDDDDDDDDDDDDDD', 'DDDDDDuuuuDDDDDD', 'DDDDuuurruuuDDDD', 'DDDuurrrrrrruDDD', 'DDuurrgrrrrrruDD', 'DDurrggirrrrruDD',
    'DDurrrirrrgrruDD', 'DDDurrrrrgigruDD', 'DDDuurrrrrrruDDD', 'DDDDDuuuuuuuDDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDTTDDDD', 'DDDDDDDDDDDDDDDD', 'DDTTTDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD',
  ],
  floor_3: [
    'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD', 'DDDlDDDDDDDDDDDD', 'DDDlDDlDDDDDDDDD', 'DDDgDDlDDDDDDDDD', 'DDDgDDgDDDDTTDDD',
    'DDTgTTgDDDDDDDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDlDDDDD', 'DDDDDDDDDlDlDDDD', 'DDDDDDDDDgDgDDDD',
    'DDDDDDDTTgTgTDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD', 'DDDDDDDDDDDDDDDD',
  ],
  wallTop_0: [
    'ttattttttattttat', 'tsaasttttsaastts', 'ssssssasssssssas', 'sddsssssddsssssd', 'dddddsdddddddsdd', 'ddnddddddnddddnd',
    'nnnnnnnnnnnnnnnn', 'glllllgglllllggl', 'ggllgggiggllgggi', 'giggiiggiggiiggi', 'ttattttttattttat', 'tsaasttttsaastts',
    'ssssssasssssssas', 'sddsssssddsssssd', 'dddddsdddddddsdd', 'nnnnnnnnnnnnnnnn',
  ],
  wallTop_1: [
    'tttatttattttatta', 'ssaassttsaassstt', 'sssssssasssssass', 'dssssssdsssssdds', 'ddsddddddsddddd' + 'd', 'dnddddnddddnddnd',
    'nnnnnnnnnnnnnnnn', 'lgllggllgllllggl', 'iggggiigggggiigg', 'ggiiggggiiggggii', 'tttatttattttatta', 'ssaassttsaassstt',
    'sssssssasssssass', 'dssssssdsssssdds', 'ddsddddddsdddddd', 'nnnnnnnnnnnnnnnn',
  ],
  wallFace_0: [
    'ttatttttttattttt', 'sssastttsssastts', 'ssssssssssssssss', 'dsssddssssdsssds', 'ddddddsdddddddsd', 'dddnddddddnddddd',
    'ddddddddnddddddd', 'dndddddddddddnd' + 'd', 'ddddldddddddlddd', 'dddlgdddddddlgdd', 'ddlgiddddddlgidd', 'dlgidddddddgiddd',
    'lgiTTTTTTTTTiTTT', 'TTTTTTTTTTTTTTTT', 'DDDDDDDDDDDDDDDD', 'AAAAAAAAAAAAAAAA',
  ],
  wallFace_1: [
    'tttatttttttatttt', 'ssastttssssastts', 'ssssssssssssssss', 'dssssdddssssdsss', 'ddddsdddddddsddd', 'ddddddnddddddnd' + 'd',
    'dndddddddnddddd' + 'd', 'dddddddddddddddd', 'ddlddddddddldddd', 'dlgdddddddlgdddd', 'lgiddddddlgidddd', 'giddddddgiddddd' + 'd',
    'iTTTTTTTiTTTTTTT', 'TTTTTTTTTTTTTTTT', 'DDDDDDDDDDDDDDDD', 'AAAAAAAAAAAAAAAA',
  ],
  anchorFace: [
    'ttatttttttattttt', 'smmmmmmmmmmmmmms', 'mppppppppppppppm', 'mpbbFFFqqFFFbbpm', 'mpbFFFqeeqFFFbpm', 'mpFFFqeEEeqFFFpm',
    'mpFFFqeEEeqFFFpm', 'mpbFFFqeeqFFFbpm', 'mpbbFFFqqFFFbbpm', 'mppppppppppppppm', 'smmmmmmmmmmmmmms', 'dddddddddddddddd',
    'TTTTTTTTTTTTTTTT', 'TTTTTTTTTTTTTTTT', 'DDDDDDDDDDDDDDDD', 'AAAAAAAAAAAAAAAA',
  ],
  anchorTopE: [
    'ttattttttattmpbm', 'tsaasttttsaampFm', 'ssssssassssampqm', 'sddsssssddssmpem', 'dddddsddddddmpqm', 'ddnddddddnddmpFm',
    'nnnnnnnnnnnnmpbm', 'glllllgglllgmpbm', 'ggllgggiggllmpFm', 'giggiiggiggimpqm', 'ttattttttatampem', 'tsaasttttsaampqm',
    'ssssssassssampFm', 'sddsssssddssmpbm', 'dddddsddddddmmmm', 'nnnnnnnnnnnnnnnn',
  ],
  decal_0: [
    '................', '................', '................', '................', '......FFFF......', '....FF....FF....',
    '................', '.....FFFFFF.....', '................', '................', '................', '................',
    '................', '................', '................', '................',
  ],
  decal_1: [
    '................', '................', '.....l..........', '.....l...l......', '....gl...l......', '....g..l.g......',
    '...gi..l.g......', '...g..gl.gi.....', '..TTTTgTTTTT....', '................', '................', '................',
    '................', '................', '................', '................',
  ],
  decal_2: [
    '................', '................', '................', '......KKKK......', '....KKFFFFKK....', '...KFFbbbbFFK...',
    '....KKFFFFKK....', '......KKKK......', '................', '................', '................', '................',
    '................', '................', '................', '................',
  ],
};

const REGIONS: { key: string; set: TileSet; legend: Legend }[] = [
  { key: 'hub', set: HUB, legend: HUB_L },
  { key: 'quarry', set: QUARRY, legend: QUA_L },
  { key: 'garden', set: GARDEN, legend: GAR_L },
  { key: 'belfry', set: BELFRY, legend: BEL_L },
  { key: 'marsh', set: MARSH, legend: MAR_L },
];

export const TILE_ORDER = [
  'floor_0', 'floor_1', 'floor_2', 'floor_3', 'wallTop_0', 'wallTop_1', 'wallFace_0', 'wallFace_1', 'anchorFace',
  'anchorTopE', 'anchorTopW', 'anchorTopN', 'decal_0', 'decal_1', 'decal_2',
] as const;

export function tileSheets(): SheetDef[] {
  return REGIONS.map(({ key, set, legend }) => {
    const frames: FrameDef[] = [];
    for (const name of TILE_ORDER) {
      if (name === 'anchorTopW') {
        frames.push({ name, grid: flipH(tile(set.anchorTopE!, legend, `${key}.anchorTopE`)) });
        continue;
      }
      if (name === 'anchorTopN') {
        // strip on the north edge = east strip rotated 90° counter-clockwise (exact pixel permutation)
        const e = tile(set.anchorTopE!, legend, `${key}.anchorTopE`);
        frames.push({ name, grid: rot90(rot90(rot90(e))) });
        continue;
      }
      frames.push({ name, grid: tile(set[name]!, legend, `${key}.${name}`) });
    }
    return { key: `tiles_${key}`, dir: 'tiles' as const, cw: 16, ch: 16, cols: 16, pivot: { x: 0, y: 0 }, frames };
  });
}
