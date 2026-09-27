// Shield / Core survival (LOCKED-P01): Shield 2 -> Shield 1 -> Core -> Dead. Lethal (Crush) attacks skip to Dead.
import { lerp, copy } from '../core/math/vec.ts';
import { CFG } from '../core/sim/config.ts';
import { worldCircle } from '../core/sim/bodies.ts';
import type { Sim, PendingHit } from '../core/sim/sim.ts';
import { lerpShape, shapeHitsCircle } from '../bosses/framework/attacks.ts';

export function playerImmune(sim: Sim): boolean {
  const p = sim.player;
  return p.dead || p.invuln > 0 || (p.dash.active && p.dash.t < CFG.player.dashIFrames);
}

/** Continuous (sub-stepped) attack vs player hurtbox. Records the earliest sub-tick time per attack. */
export function detectPlayerHits(sim: Sim): void {
  const p = sim.player;
  if (!sim.fight || sim.fight.result !== 'ongoing' || p.dead) return;
  const n = CFG.substeps;
  for (const a of sim.attacks) {
    if (a.phase !== 'active' || !a.harmful || a.hitPlayer || !a.shape) continue;
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      // dash i-frames are evaluated at the sampled time, so dashing through a ring is exact
      const pp = lerp(p.prevPos, p.pos, t);
      const sh = lerpShape(a.prevShape, a.shape, t);
      if (shapeHitsCircle(sh, pp, p.radius)) {
        sim.pendingHits.push({ t, attack: a, lethal: a.lethal });
        break;
      }
    }
  }
  // contact hazards on bodies (e.g. spinning blades attached to a boss)
  for (const b of sim.bodies) {
    if (!b.enabled || b.kind === 'world') continue;
    for (const s of b.shapes) {
      if (!s.enabled || !s.hazard || s.kind !== 'circle') continue;
      const w = worldCircle(b, s);
      if ((w.c.x - p.pos.x) ** 2 + (w.c.y - p.pos.y) ** 2 <= (w.r + p.radius) ** 2) {
        const fake = sim.attacks.find((a) => a.owner === `hazard:${s.id}`) ?? sim.spawnAttack({ kind: 'contact', owner: `hazard:${s.id}`, phase: 'done' });
        sim.pendingHits.push({ t: 1, attack: fake, lethal: false });
      }
    }
  }
}

export function resolveHits(sim: Sim, hits: PendingHit[]): void {
  if (hits.length === 0) return;
  const p = sim.player;
  const f = sim.fight;
  if (!f || f.result !== 'ongoing' || p.dead) return;
  if (playerImmune(sim)) return;
  const h = hits[0]!;
  h.attack.hitPlayer = true;
  if (sim.debug.invulnerable) {
    p.invuln = CFG.player.hitInvuln;
    sim.emit({ type: 'playerHit', pos: copy(p.pos), value: p.shield, text: 'debug' });
    return;
  }
  p.lastHitTick = sim.tick;
  p.hitFlash = 0.3;
  if (h.lethal || p.shield <= 0) {
    p.shield = 0;
    killPlayer(sim, h.attack.kind, h.lethal);
    return;
  }
  p.shield -= 1;
  p.invuln = CFG.player.hitInvuln;
  sim.record(`hit ${h.attack.kind} shield=${p.shield}`);
  sim.emit({ type: 'playerHit', pos: copy(p.pos), value: p.shield, text: h.attack.kind });
  sim.emit({ type: 'shake', value: 4 });
}

export function killPlayer(sim: Sim, cause: string, lethal: boolean): void {
  const p = sim.player;
  const f = sim.fight;
  p.dead = true;
  p.deathTick = sim.tick;
  p.dash.active = false;
  sim.pendingPulse = false;
  if (f) {
    f.result = 'defeat';
    f.resultTick = sim.tick;
    f.deathCause = cause;
  }
  sim.record(`death ${cause}${lethal ? ' lethal' : ''}`);
  sim.emit({ type: 'playerHit', pos: copy(p.pos), value: -1, text: cause });
  sim.emit({ type: 'playerDied', pos: copy(p.pos), text: cause });
  sim.emit({ type: 'shake', value: 6 });
}

/** Two clean resonance successes while damaged restore one Shield step, at most once per boss fight. */
export function tryShieldRecovery(sim: Sim): void {
  const f = sim.fight;
  const p = sim.player;
  if (!f || p.dead) return;
  if (p.shield >= 2) {
    // successes only bank while damaged
    f.pulseSuccesses = 0;
    return;
  }
  if (f.recoveriesUsed >= CFG.recovery.maxPerFight) return;
  if (f.pulseSuccesses >= CFG.recovery.successesNeeded) {
    f.pulseSuccesses -= CFG.recovery.successesNeeded;
    f.recoveriesUsed++;
    p.shield += 1;
    sim.record(`shieldRestored shield=${p.shield}`);
    sim.emit({ type: 'shieldRestored', pos: copy(p.pos), value: p.shield });
  }
}
