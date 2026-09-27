// Player intent handling (selection, fire, recall, dash, pulse press) and movement integration.
import { DT } from '../core/clock/fixedStep.ts';
import { type Vec, clampLen, len, norm, scale, addScaled, copy, dist2 } from '../core/math/vec.ts';
import { CFG } from '../core/sim/config.ts';
import { resolveCircle } from '../core/sim/bodies.ts';
import type { InputFrame } from '../core/sim/types.ts';
import type { Sim } from '../core/sim/sim.ts';
import { fireNeedle, recallNeedle } from '../resonance/needle.ts';
import { planPulse } from '../resonance/pulse.ts';

export function nearInteractable(sim: Sim): boolean {
  const p = sim.player.pos;
  return sim.area.interactables.some((it) => dist2(p, it.pos) <= it.r * it.r);
}

export function handleCombatInput(sim: Sim, input: InputFrame): void {
  const p = sim.player;
  p.aim = copy(input.aim);
  p.aimDir = sim.aimDir();

  // --- selection
  if (input.selIndex >= 0 && input.selIndex <= 2) p.selected = input.selIndex;
  if (input.selNext) p.selected = (p.selected + 1) % 3;
  if (input.selPrev) p.selected = (p.selected + 2) % 3;

  // --- needles
  if (input.fire) fireNeedle(sim);
  if (input.recallAll) {
    let any = false;
    for (const n of sim.needles) if (n.state !== 'Held' && n.state !== 'Returning') any = recallNeedle(sim, n) || any;
    if (any) p.recallAnim = 0.22;
  } else if (input.recall) {
    const sel = sim.needles[p.selected]!;
    let target = sel.state !== 'Held' && sel.state !== 'Returning' ? sel : null;
    if (!target) {
      // selected needle is in hand: recall the out needle closest to the cursor
      let best = Infinity;
      for (const n of sim.needles) {
        if (n.state === 'Held' || n.state === 'Returning') continue;
        const d = dist2(n.pos, input.aim);
        if (d < best) {
          best = d;
          target = n;
        }
      }
    }
    if (target && recallNeedle(sim, target)) p.recallAnim = 0.22;
  }

  // --- dash
  if (input.dash && !p.dash.active && p.dash.cd <= 0) {
    const m = clampLen(input.move, 1);
    const dir: Vec = len(m) > 0.2 ? norm(m) : p.facing;
    p.dash.active = true;
    p.dash.t = 0;
    p.dash.dur = CFG.player.dashDuration;
    p.dash.dir = dir;
    sim.emit({ type: 'dash', pos: copy(p.pos), dir: copy(dir) });
  }

  // --- pulse press (E). Outside combat, E near an interactable is an interaction instead.
  if (input.pulse && !(sim.fight === null && nearInteractable(sim))) {
    if (p.pulseCd <= 0 && !sim.pendingPulse) {
      if (planPulse(sim)) {
        sim.pendingPulse = true;
        p.pulseStartup = sim.mods.pulseStartup;
        p.pulseAnim = 0.32;
      } else {
        sim.emit({ type: 'pulseEmpty', pos: copy(p.pos) });
      }
    }
  }
}

/** countdown that snaps to exactly 0 (avoids 1e-16 float residue blocking a cooldown check) */
export const countdown = (v: number): number => (v - DT <= 1e-6 ? 0 : v - DT);

export function updatePlayerMovement(sim: Sim, input: InputFrame | null): void {
  const p = sim.player;
  // timers
  p.fireCd = countdown(p.fireCd);
  p.pulseCd = countdown(p.pulseCd);
  p.invuln = countdown(p.invuln);
  p.hitFlash = countdown(p.hitFlash);
  p.throwAnim = countdown(p.throwAnim);
  p.recallAnim = countdown(p.recallAnim);
  p.pulseAnim = countdown(p.pulseAnim);
  if (!p.dash.active) p.dash.cd = countdown(p.dash.cd);

  if (p.dead) {
    p.vel = { x: 0, y: 0 };
    p.moving = false;
    p.dash.active = false;
    return;
  }
  let v: Vec;
  if (p.dash.active) {
    p.dash.t += DT;
    v = scale(p.dash.dir, CFG.player.dashSpeed);
    if (p.dash.t >= p.dash.dur) {
      p.dash.active = false;
      p.dash.cd = sim.mods.dashCooldown;
    }
  } else {
    const m = input ? clampLen(input.move, 1) : { x: 0, y: 0 };
    const slow = p.pulseStartup > 0 ? 0.5 : 1;
    v = scale(m, CFG.player.moveSpeed * slow);
    if (len(m) > 0.15) p.facing = norm(m);
  }
  p.vel = v;
  p.moving = len(v) > 1;
  p.pos = resolveCircle(sim.bodies, addScaled(p.pos, v, DT), p.radius);
}
