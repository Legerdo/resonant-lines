// Generic attack visuals: the real hit geometry is always drawn (no invisible hitboxes). Telegraphs use shape +
// timing ring + motion, never colour alone.
import { P, SIG_COLORS } from './art/palette.ts';
import type { PixelLayer } from './pixelLayer.ts';
import type { Attack, AttackShape } from '../core/sim/types.ts';
import type { LinkDrawOptions } from './links.ts';

function colors(a: Attack): [number, number] {
  if (a.sig) return [SIG_COLORS[a.sig][0], SIG_COLORS[a.sig][1]];
  return a.lethal ? [P.voidD, P.voidL] : [P.heat, P.heatLite];
}

function capsule(layer: PixelLayer, s: Extract<AttackShape, { kind: 'capsule' }>, edge: number, core: number, fill: number, dither: boolean, frame: number): void {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const r = Math.max(1, Math.round(s.r));
  for (let k = -r; k <= r; k++) {
    const c = Math.abs(k) === r ? edge : k === 0 ? core : fill;
    if (c < 0) continue;
    if (dither && Math.abs(k) !== r && k !== 0 && ((k + frame) & 1) === 0) continue;
    layer.line(s.a.x + nx * k, s.a.y + ny * k, s.b.x + nx * k, s.b.y + ny * k, c);
  }
  layer.disc(s.a.x, s.a.y, r, edge, dither ? 1 : 0);
  layer.disc(s.b.x, s.b.y, r, edge, dither ? 1 : 0);
}

export function drawAttack(under: PixelLayer, over: PixelLayer, a: Attack, o: LinkDrawOptions): void {
  if (a.p.noGeneric) return;
  const [base, lite] = colors(a);
  const f = o.frame;
  if (a.phase === 'telegraph' && a.tele) {
    const tele = a.tele;
    const total = a.p.tele ?? 1;
    const k = Math.min(1, a.t / Math.max(0.01, total));
    if (tele.kind === 'circle') {
      // ordered dither danger zone + closing timing ring
      under.disc(tele.c.x, tele.c.y, tele.r, base, 2, f >> 3);
      under.ring(tele.c.x, tele.c.y, tele.r, lite, 3, f >> 1);
      over.ring(tele.c.x, tele.c.y, tele.r + (1 - k) * 18, k > 0.75 && (f >> 1) % 2 === 0 ? P.bone : lite);
    } else if (tele.kind === 'capsule') {
      const locked = a.p.lock === 1;
      over.line(tele.a.x, tele.a.y, tele.b.x, tele.b.y, (i) => ((i + (f >> 1)) % 4 === 0 ? (locked || k > 0.7 ? P.bone : lite) : -1));
      if (a.p.w) capsule(under, { kind: 'capsule', a: tele.a, b: tele.b, r: a.p.w }, locked && (f >> 2) % 2 === 0 ? lite : base, -1, -1, true, f >> 2);
    } else if (tele.kind === 'ring') {
      const rr = Math.min(tele.rOut, 6 + k * 10);
      over.ring(tele.c.x, tele.c.y, rr, (f >> 2) % 2 === 0 ? lite : base, 2, f);
    }
    return;
  }
  if (a.phase !== 'active' || !a.shape) return;
  const s = a.shape;
  switch (s.kind) {
    case 'circle':
      if (a.p.ring) {
        // body attacks (charges): the sprite is the threat, the dashed ring shows the exact hit radius
        over.ring(s.c.x, s.c.y, s.r, lite, 3, f >> 1);
      } else if (a.kind === 'projectile' || s.r <= 6) {
        over.disc(s.c.x, s.c.y, s.r, base);
        over.disc(s.c.x, s.c.y, Math.max(0, s.r - 2), lite);
        over.px(s.c.x, s.c.y, P.bone);
      } else {
        under.disc(s.c.x, s.c.y, s.r, base, 1, f >> 1);
        over.ring(s.c.x, s.c.y, s.r, lite);
        over.ring(s.c.x, s.c.y, Math.max(1, s.r - 3), base, 2, f);
      }
      break;
    case 'ring': {
      const arc = s.arcAng !== undefined ? { ang: s.arcAng, half: s.arcHalf ?? Math.PI } : undefined;
      const dash = a.sig === 'Wave' ? 0 : a.sig === 'Void' ? 3 : 0;
      over.ring(s.c.x, s.c.y, s.rOut, lite, dash, f, arc);
      if (s.rOut - s.rIn >= 3) over.ring(s.c.x, s.c.y, s.rIn + 1, base, a.sig === 'Wave' ? 2 : 0, f >> 1, arc);
      if (a.sig === 'Impact') over.ring(s.c.x, s.c.y, (s.rIn + s.rOut) / 2, base, 4, 0, arc);
      break;
    }
    case 'capsule':
      capsule(over, s, base, a.sig === 'Heat' ? P.bone : lite, a.sig === 'Heat' ? lite : -1, false, f);
      break;
  }
}
