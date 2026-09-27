// side-effect imports: each module registers its boss view
import './gramView.ts';
import './humView.ts';
import './neraView.ts';
import './moraView.ts';

/** prop kinds drawn by boss views instead of the generic prop renderer */
export const BOSS_DRAWN_KINDS = new Set(['bell', 'terminal']);
