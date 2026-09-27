// Resonance line / pulse rendering. Geometry readability first: every state has a distinct shape pattern,
// colour is only the second channel (colour-blind safe signature language, see ART_BIBLE §VFX).
import { P, SIG_COLORS } from './art/palette.ts';
import type { PixelLayer } from './pixelLayer.ts';
import type { Sim } from '../core/sim/sim.ts';
import type { Link, Signature } from '../core/sim/types.ts';
import type { Vec } from '../core/math/vec.ts';
import { planPulse, flowInvertedFor } from '../resonance/pulse.ts';
import { isEmbedded } from '../resonance/needle.ts';

export interface LinkDrawOptions {
  time: number; // seconds (presentation clock)
  frame: number; // render frame counter
  highContrast: boolean;
  flash: boolean;
}

function hashi(a: number, b: number): number {
  let h = (a * 73856093) ^ (b * 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** perpendicular pixel offset direction for a line (dominant-axis) */
function perpOf(dx: number, dy: number): [number, number] {
  return Math.abs(dx) >= Math.abs(dy) ? [0, 1] : [1, 0];
}

export function drawSignatureLine(
  layer: PixelLayer, x0: number, y0: number, x1: number, y1: number, sig: Signature, tone: number, over: boolean, o: LinkDrawOptions,
): void {
  const pts = layer.linePoints(x0, y0, x1, y1);
  const [base, lite] = SIG_COLORS[sig];
  const [px, py] = perpOf(x1 - x0, y1 - y0);
  const amp = over ? 2 : 1;
  const flick = over && o.flash && (o.frame >> 2) % 2 === 0;
  const t = o.time;
  pts.forEach(([x, y], i) => {
    switch (sig) {
      case 'Impact': {
        // square wave band
        const up = Math.floor((i + Math.floor(t * 18)) / 4) % 2 === 0;
        layer.px(x, y, flick ? lite : base);
        layer.px(x + px * (up ? amp : -amp), y + py * (up ? amp : -amp), lite);
        if (i % 4 === 0) for (let k = -amp; k <= amp; k++) layer.px(x + px * k, y + py * k, lite);
        break;
      }
      case 'Wave': {
        layer.px(x, y, base);
        const period = tone === 0 ? 12 : tone === 2 ? 5 : 8;
        const phase = Math.floor(t * (tone === 0 ? 10 : tone === 2 ? 26 : 16));
        if ((i + phase) % period === 0) {
          const r = tone === 0 ? 3 : tone === 2 ? 1 : 2;
          layer.ring(x, y, r + (over ? 1 : 0), lite);
        }
        break;
      }
      case 'Heat': {
        // vertical tremble regardless of line orientation
        const j = (hashi(i, o.frame >> 1) % 3) - 1;
        layer.px(x, y, base);
        layer.px(x, y + j * amp, lite);
        if (over) layer.px(x, y - j, flick ? P.bone : lite);
        break;
      }
      case 'Void': {
        const on = (i + Math.floor(t * 8)) % 6 < 3;
        if (on) {
          layer.px(x, y, lite);
          if (over) layer.px(x + px, y + py, base);
        } else if (i % 2 === 0) layer.px(x, y, base);
        break;
      }
      case 'Rotational': {
        const s = Math.round(Math.sin((i + t * 24) / 2.6) * (over ? 2.4 : 1.6));
        layer.px(x + px * s, y + py * s, lite);
        layer.px(x - px * s, y - py * s, base);
        break;
      }
    }
  });
}

function drawIdleLine(layer: PixelLayer, x0: number, y0: number, x1: number, y1: number, o: LinkDrawOptions, stateColor: number = P.resoDeep): void {
  const shimmer = Math.floor(o.time * 40);
  layer.line(x0, y0, x1, y1, (i) => ((i + shimmer) % 14 === 0 ? P.reso : stateColor));
  if (o.highContrast) {
    const [px, py] = perpOf(x1 - x0, y1 - y0);
    layer.line(x0 + px, y0 + py, x1 + px, y1 + py, P.ink);
    layer.line(x0 - px, y0 - py, x1 - px, y1 - py, P.reso);
  }
}

export function drawLinks(layer: PixelLayer, sim: Sim, o: LinkDrawOptions): void {
  for (const l of sim.links) {
    const a = sim.needle(l.a);
    const b = sim.needle(l.b);
    if (!isEmbedded(a) || !isEmbedded(b)) {
      if (l.state === 'Broken') drawBroken(layer, sim, l, o);
      continue;
    }
    const { x: x0, y: y0 } = a.pos;
    const { x: x1, y: y1 } = b.pos;
    if (!l.valid) {
      if (l.state === 'Broken') {
        drawBroken(layer, sim, l, o);
        continue;
      }
      // learnability hints for pairs that are *almost* linked
      if (l.blocked === 'distance' && l.length <= sim.mods.maxLinkDistance * 1.4) {
        layer.line(x0, y0, x1, y1, (i) => (i % 5 === 0 ? P.dusk : -1));
      } else if (l.blocked === 'los') {
        layer.line(x0, y0, x1, y1, (i) => (i % 4 === 0 ? P.slate : -1));
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        for (let k = -2; k <= 2; k++) {
          layer.px(mx + k, my + k, P.heat);
          layer.px(mx + k, my - k, P.heat);
        }
      }
      continue;
    }
    if (flowInvertedFor(sim, l)) {
      // anti-phase / reversed tide: zigzag shape + particles travelling b->a (the reversed direction)
      const pts = layer.linePoints(x0, y0, x1, y1);
      const [px, py] = Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? [0, 1] : [1, 0];
      pts.forEach(([x, y], i) => {
        if (i % 6 === 0) layer.px(x + px * 2, y + py * 2, P.voidL);
        if (i % 6 === 3) layer.px(x - px * 2, y - py * 2, P.voidL);
      });
      const n = pts.length;
      for (let k = 0; k < 3; k++) {
        const idx = n - 1 - ((Math.floor(o.time * 50) + k * Math.floor(n / 3)) % Math.max(1, n));
        const p = pts[Math.max(0, Math.min(n - 1, idx))];
        if (p) layer.px(p[0], p[1] - 1, P.bone);
      }
    }
    if (l.state === 'Charged' || l.state === 'Overloaded') {
      drawSignatureLine(layer, x0, y0, x1, y1, l.sig!, l.tone, l.state === 'Overloaded', o);
      if (l.state === 'Overloaded' && o.frame % 6 === 0) {
        const t = (hashi(o.frame, l.id.charCodeAt(0)) % 100) / 100;
        layer.px(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 2, P.bone);
      }
    } else if (l.state === 'Charging' || l.progress > 0) {
      drawIdleLine(layer, x0, y0, x1, y1, o, P.reso);
      // incoming energy fills from the middle outwards
      const sig = l.chargingSig ?? 'Heat';
      const f = Math.min(1, l.progress);
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      drawSignatureLine(layer, mx + (x0 - mx) * f, my + (y0 - my) * f, mx + (x1 - mx) * f, my + (y1 - my) * f, sig, l.chargingTone, false, o);
    } else {
      drawIdleLine(layer, x0, y0, x1, y1, o, l.echoT > 0 ? P.reso : P.resoDeep);
    }
  }
}

function drawBroken(layer: PixelLayer, sim: Sim, l: Link, o: LinkDrawOptions): void {
  if (l.brokenT < 1.1) return; // only the first moments after the break
  const a = sim.needle(l.a).pos;
  const b = sim.needle(l.b).pos;
  const spread = (1.5 - l.brokenT) * 10;
  layer.line(a.x, a.y + spread, b.x, b.y + spread, (i) => ((i + o.frame) % 7 < 2 ? P.heat : -1));
}

export function drawPulses(layer: PixelLayer, sim: Sim, o: LinkDrawOptions): void {
  for (const q of sim.pulses) {
    if (q.done) continue;
    const from = sim.needle(q.from).pos;
    const to = sim.needle(q.to).pos;
    const [, lite] = SIG_COLORS[q.sig];
    if (q.delivered) {
      // echo sweep
      layer.line(from.x, from.y, to.x, to.y, (i) => ((i + o.frame) % 3 === 0 ? lite : -1));
      continue;
    }
    const len = Math.max(1, q.length);
    const u = Math.min(1, q.d / len);
    const hx = from.x + (to.x - from.x) * u;
    const hy = from.y + (to.y - from.y) * u;
    // stepped trail behind the head
    const trail = Math.min(q.d, 26);
    const tx = hx - ((to.x - from.x) / len) * trail;
    const ty = hy - ((to.y - from.y) / len) * trail;
    layer.line(tx, ty, hx, hy, (i, n) => (i > n - 4 ? P.bone : i > n - 12 ? lite : i % 2 === 0 ? P.reso : -1));
    const w = q.width >= 4 ? 1 : 0;
    for (let k = -1 - w; k <= 1 + w; k++) {
      layer.px(hx + k, hy, P.bone);
      layer.px(hx, hy + k, P.bone);
    }
    layer.px(hx, hy, P.resoLite);
  }
}

/** Shows what E would do right now: target needle bracket + chevrons flowing toward it. Never shows solutions. */
export function drawPulsePreview(layer: PixelLayer, sim: Sim, o: LinkDrawOptions): void {
  if (sim.player.dead || sim.pulses.some((q) => !q.done && !q.delivered)) return;
  const plan = planPulse(sim);
  if (!plan) return;
  const drawFlow = (f: Vec, tt: Vec) => {
    const dx = tt.x - f.x;
    const dy = tt.y - f.y;
    const len = Math.hypot(dx, dy);
    if (len < 20) return;
    const ux = dx / len;
    const uy = dy / len;
    const phase = (o.time * 30) % 18;
    for (let d = 10 + phase; d < len - 8; d += 18) {
      const cx = f.x + ux * d;
      const cy = f.y + uy * d;
      layer.px(cx, cy, P.bone);
      layer.px(cx - ux * 2 - uy * 2, cy - uy * 2 + ux * 2, P.resoLite);
      layer.px(cx - ux * 2 + uy * 2, cy - uy * 2 - ux * 2, P.resoLite);
    }
  };
  if (plan.automatic) {
    for (const l of plan.links) drawFlow(sim.needle(l.a).pos, sim.needle(l.b).pos);
    return;
  }
  const t = plan.target.pos;
  const blink = Math.floor(o.time * 4) % 2 === 0;
  const r = 6;
  const c = blink ? P.resoLite : P.reso;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    layer.px(t.x + sx * r, t.y + sy * r, c);
    layer.px(t.x + sx * (r - 1), t.y + sy * r, c);
    layer.px(t.x + sx * r, t.y + sy * (r - 1), c);
  }
  for (const l of plan.links) {
    const otherId = l.a === plan.target.id ? l.b : l.a;
    const inv = flowInvertedFor(sim, l);
    const f = inv ? plan.target.pos : sim.needle(otherId).pos;
    const tt = inv ? sim.needle(otherId).pos : plan.target.pos;
    drawFlow(f, tt);
  }
}
