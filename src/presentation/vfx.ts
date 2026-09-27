// Presentation-only effects driven by sim events. Never feeds back into gameplay.
import { P, SIG_COLORS } from './art/palette.ts';
import type { PixelLayer } from './pixelLayer.ts';
import type { SimEvent } from '../core/sim/types.ts';
import type { Vec } from '../core/math/vec.ts';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: number;
  c2: number;
  g: number;
}

interface Burst {
  anim: string;
  x: number;
  y: number;
  t: number;
}

export interface Ghost {
  x: number;
  y: number;
  frame: number;
  flip: boolean;
  life: number;
}

export const MAX_PARTICLES = 600;

export class Vfx {
  particles: Particle[] = [];
  bursts: Burst[] = [];
  ghosts: Ghost[] = [];
  shakeT = 0;
  shakePower = 0;
  private seed = 1;

  private rand(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  spray(pos: Vec, n: number, c: number, c2: number, speed = 60, life = 0.4, g = 0): void {
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = speed * (0.4 + this.rand() * 0.8);
      this.particles.push({ x: pos.x, y: pos.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, c, c2, g });
    }
  }

  burst(anim: string, pos: Vec): void {
    if (this.bursts.length < 64) this.bursts.push({ anim, x: pos.x, y: pos.y, t: 0 });
  }

  shake(power: number): void {
    this.shakePower = Math.max(this.shakePower, power);
    this.shakeT = 0.28;
  }

  onEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      const p = e.pos;
      switch (e.type) {
        case 'needleEmbedded':
          if (p) {
            this.burst('fx_embed', p);
            this.spray(p, 5, P.resoLite, P.reso, 40, 0.25);
          }
          break;
        case 'needleBounced':
          if (p) {
            this.burst('fx_spark', p);
            this.spray(p, 4, P.pale, P.ash, 50, 0.2);
          }
          break;
        case 'capture':
        case 'overload':
          if (p && e.sig) {
            const [c, c2] = SIG_COLORS[e.sig];
            this.spray(p, e.type === 'overload' ? 22 : 14, c2, c, 70, 0.45);
            this.burst(e.sig === 'Impact' ? 'fx_impact' : 'fx_deliver', p);
          }
          break;
        case 'pulseDelivered':
          if (p) {
            if (e.result === 'fail') {
              this.burst('fx_fizzle', p);
              this.spray(p, 8, P.ash, P.slate, 40, 0.35, 60);
            } else {
              this.burst('fx_deliver', p);
              this.spray(p, e.result === 'success' ? 26 : 10, P.resoLite, P.bone, 90, 0.5);
            }
          }
          break;
        case 'pulseFizzled':
        case 'chargeLost':
          if (p) this.spray(p, 6, P.slate, P.dusk, 30, 0.3);
          break;
        case 'linkBroken':
          if (p) {
            this.spray(p, 16, P.heat, P.heatLite, 80, 0.4);
            this.shake(2);
          }
          break;
        case 'playerHit':
          if (p) {
            this.burst('fx_shards', { x: p.x, y: p.y - 10 });
            this.spray({ x: p.x, y: p.y - 10 }, 14, P.resoLite, P.reso, 90, 0.45);
          }
          break;
        case 'playerDied':
          if (p) this.spray({ x: p.x, y: p.y - 8 }, 40, P.reso, P.resoLite, 50, 1.0, -20);
          break;
        case 'shieldRestored':
          if (p) this.spray({ x: p.x, y: p.y - 12 }, 18, P.resoLite, P.bone, 40, 0.6, -40);
          break;
        case 'sealBroken':
          if (p) {
            this.spray(p, 40, P.bone, P.resoLite, 120, 0.7);
            this.burst('fx_deliver', p);
          }
          break;
        case 'coreExposed':
          if (p) this.spray(p, 30, P.flare, P.ember, 90, 0.8);
          break;
        case 'bossVictory':
          if (p) {
            this.spray(p, 90, P.resoLite, P.bone, 140, 1.2, -10);
            this.spray(p, 40, P.flare, P.ember, 100, 1.0);
          }
          break;
        case 'dash':
          if (p) this.burst('fx_dust', p);
          break;
        case 'threadStep':
          if (p) this.spray(p, 12, P.resoLite, P.reso, 60, 0.35);
          break;
        case 'recallDenied':
          if (p) this.spray(p, 6, P.heat, P.heatLite, 30, 0.3);
          break;
        case 'shake':
          this.shake(e.value ?? 2);
          break;
        default:
          break;
      }
    }
  }

  update(dt: number): void {
    for (const q of this.particles) {
      q.life -= dt;
      q.vy += q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.92;
      q.vy *= 0.92;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const b of this.bursts) b.t += dt * 1000;
    this.bursts = this.bursts.filter((b) => b.t < 600);
    for (const g of this.ghosts) g.life -= dt;
    this.ghosts = this.ghosts.filter((g) => g.life > 0);
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.shakeT === 0) this.shakePower = 0;
  }

  drawParticles(layer: PixelLayer): void {
    for (const q of this.particles) layer.px(q.x, q.y, q.life > q.max * 0.5 ? q.c : q.c2);
  }

  shakeOffset(scale: number): { x: number; y: number } {
    if (this.shakeT <= 0 || scale <= 0) return { x: 0, y: 0 };
    const a = Math.round(this.shakePower * scale * (this.shakeT / 0.28));
    if (a <= 0) return { x: 0, y: 0 };
    return { x: Math.round((this.rand() * 2 - 1) * a), y: Math.round((this.rand() * 2 - 1) * a) };
  }
}
