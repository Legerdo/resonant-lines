// B03 거울비늘 네라 — "공명선을 센서로 쓸 수 있는가?"
// Four identical figures stand in the mirror pool; only the true body bends a resonance line passing through it
// (refraction). Needles shatter reflections (and provoke them); the true body takes a needle as a Moving Anchor.
// Seals (in order): A = Heat into the body, B = Heat arriving from BEHIND it (it faces you), C = Overloaded Heat.
// Core: the reflections break and Nera circles the pool; close a lattice around her and discharge Heat.
import { DT } from '../../core/clock/fixedStep.ts';
import { type Vec, copy, sub, norm, dot, fromAngle, add, scale, len } from '../../core/math/vec.ts';
import { makeBody, circle } from '../../core/sim/bodies.ts';
import { pointSegDist2, pointInTriangle } from '../../core/geometry/geom.ts';
import type { Attack, Body, DeliveryInfo, Link, Needle, PulseResult } from '../../core/sim/types.ts';
import type { RayHit } from '../../core/sim/bodies.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { type BossController, makeSeals, newView } from '../framework/boss.ts';
import { datan2, dcos, dsin } from '../../core/math/dmath.ts';

export const NERA_SPOTS: readonly Vec[] = [
  { x: 96, y: 88 }, { x: 320, y: 88 }, { x: 72, y: 196 }, { x: 344, y: 196 }, { x: 208, y: 76 }, { x: 150, y: 222 },
];
export const NERA = { relocate: 7.5, dive: 0.6, beamTele: 0.75, beamActive: 0.95, beamGap: 1.25, hookedMax: 9, swimR: 72, swimPeriod: 10 };

interface Figure {
  body: Body;
  spot: number;
  hidden: number; // >0 shattered / submerged
  true: boolean;
}

type State = 'surface' | 'dive' | 'core';

export class NeraBoss implements BossController {
  readonly id = 'B03';
  phase = 'mirror';
  seals = makeSeals([{ id: 'scaleA', glyph: 0 }, { id: 'scaleB', glyph: 1 }, { id: 'scaleC', glyph: 2 }], 'B03');
  coreExposed = false;
  defeated = false;
  view = newView();
  figs: Figure[] = [];
  state: State = 'surface';
  t = 0;
  age = 0;
  beamT = 1.2;
  beamIdx = 0;
  hookedT = 0;
  facing: Vec = { x: 0, y: 1 };
  swimA = 0;
  refracted: Set<string> = new Set();

  setup(sim: Sim): void {
    // deterministic initial arrangement: the true body starts on spot 1
    const spots = [1, 2, 4, 5];
    spots.forEach((s, i) => {
      const p = NERA_SPOTS[s]!;
      const isTrue = i === 0;
      const body = sim.addBody(makeBody(`nera${i}`, 'boss', copy(p), [
        circle(`nera${i}:body`, { x: 0, y: 0 }, 12, isTrue ? 'BossAnchorable' : 'NonAnchorable', { blocksMove: true, receiver: isTrue ? 'nera' : undefined }),
      ]));
      this.figs.push({ body, spot: s, hidden: 0, true: isTrue });
    });
    this.syncView(sim);
  }

  get trueFig(): Figure {
    return this.figs.find((f) => f.true)!;
  }

  private hookedNeedle(sim: Sim): Needle | undefined {
    const tb = this.trueFig.body;
    return sim.needles.find((n) => n.state === 'EmbeddedBoss' && n.host?.bodyId === tb.id);
  }

  private relocate(sim: Sim): void {
    const hooked = !!this.hookedNeedle(sim);
    const free = NERA_SPOTS.map((_, i) => i).filter((i) => !(hooked && i === this.trueFig.spot));
    // Fisher-Yates with the sim RNG
    for (let i = free.length - 1; i > 0; i--) {
      const j = sim.rng.int(i + 1);
      [free[i], free[j]] = [free[j]!, free[i]!];
    }
    let k = 0;
    for (const f of this.figs) {
      if (hooked && f.true) continue;
      f.spot = free[k++]!;
      f.body.pos = copy(NERA_SPOTS[f.spot]!);
    }
    sim.record(`B03 relocate true@${this.trueFig.spot}`);
  }

  update(sim: Sim): void {
    this.t += DT;
    this.age += DT;
    for (const f of this.figs) {
      if (f.hidden > 0) {
        f.hidden -= DT;
        if (f.hidden <= 0 && !this.coreExposed) f.body.enabled = true;
      }
    }
    const tb = this.trueFig.body;
    const toP = norm(sub(sim.player.pos, tb.pos));
    // after the first seal the true body keeps its mirrored face toward the player
    this.facing = toP;
    const hooked = this.hookedNeedle(sim);
    this.hookedT = hooked ? this.hookedT + DT : 0;
    if (hooked && this.hookedT > NERA.hookedMax) {
      sim.disableNeedle(hooked, 1.0);
      sim.record('B03 shakeOff');
      this.hookedT = 0;
    }
    // refraction probe: which live links pass through the true body (presentation + debug only)
    this.refracted.clear();
    for (const l of sim.links) {
      if (!l.valid) continue;
      const a = sim.needle(l.a).pos;
      const b = sim.needle(l.b).pos;
      if (pointSegDist2(tb.pos, a, b) < 13 * 13 && tb.enabled && !this.coreExposed) this.refracted.add(l.id);
    }
    if (this.coreExposed) {
      this.swimA += (DT / NERA.swimPeriod) * Math.PI * 2;
      tb.pos = { x: 208 + dcos(this.swimA) * NERA.swimR, y: 148 + dsin(this.swimA) * NERA.swimR * 0.8 };
    }
    switch (this.state) {
      case 'surface':
        if (!this.coreExposed && this.t >= NERA.relocate && !hooked) {
          this.state = 'dive';
          this.t = 0;
          for (const f of this.figs) f.body.enabled = false;
        }
        break;
      case 'dive':
        if (this.t >= NERA.dive) {
          this.relocate(sim);
          for (const f of this.figs) if (f.hidden <= 0) f.body.enabled = true;
          this.state = 'surface';
          this.t = 0;
        }
        break;
      case 'core':
        break;
    }
    // glare beams: figures take turns; beams sweep through an arc (Heat, continuous)
    this.beamT -= DT;
    if (this.beamT <= 0 && this.state !== 'dive') {
      const live = this.figs.filter((f) => f.body.enabled && (!this.coreExposed || f.true));
      if (live.length) {
        const f = live[this.beamIdx % live.length]!;
        this.beamIdx++;
        const d = sub(sim.player.pos, f.body.pos);
        const ang = datan2(d.y, d.x);
        sim.spawnAttack({
          kind: 'beam', owner: f.body.id, sig: 'Heat', capturable: true, continuous: true, harmful: true,
          p: { x: f.body.pos.x, y: f.body.pos.y, ang, len: 260, w: 3, spin: 0, tele: NERA.beamTele, active: NERA.beamActive },
        });
      }
      this.beamT = this.coreExposed ? NERA.beamGap * 0.9 : NERA.beamGap + (this.seals.filter((s) => s.broken).length === 0 ? 0.4 : 0);
    }
    this.syncView(sim);
  }

  onNeedleHit(sim: Sim, n: Needle, hit: RayHit) {
    const f = this.figs.find((x) => x.body.id === hit.body.id);
    if (!f || f.true) return undefined;
    // a reflection shatters; the others answer with mirror shards
    f.body.enabled = false;
    f.hidden = 2.5;
    sim.record(`B03 shatter nera${this.figs.indexOf(f)}`);
    sim.emit({ type: 'sfx', text: 'shatter', pos: copy(hit.point) });
    for (const o of this.figs) {
      if (o === f || !o.body.enabled) continue;
      const d = norm(sub(sim.player.pos, o.body.pos));
      sim.spawnAttack({ kind: 'projectile', owner: o.body.id, harmful: true, p: { x: o.body.pos.x, y: o.body.pos.y, vx: d.x * 150, vy: d.y * 150, r: 3, range: 320 } });
    }
    void n;
    return 'disable' as const;
  }

  onAttackLink(sim: Sim, a: Attack, l: Link) {
    // a figure's own glare cannot charge a line anchored on that same figure
    const own = (id: 'A' | 'B' | 'C') => sim.needle(id).host?.bodyId === a.owner;
    if (own(l.a) || own(l.b)) return 'ignore' as const;
    return undefined;
  }

  onPulseDelivered(sim: Sim, d: DeliveryInfo): PulseResult | undefined {
    if (this.coreExposed) {
      if (d.pulse.sig !== 'Heat' || !sim.lattice.formed) return undefined;
      const [A, B, C] = [sim.needle('A').pos, sim.needle('B').pos, sim.needle('C').pos];
      if (pointInTriangle(this.trueFig.body.pos, A, B, C)) {
        sim.requestVictory(d.t, d.pos);
        return 'success';
      }
      sim.emit({ type: 'sealRejected', id: 'lattice', pos: d.pos, text: 'outside' });
      return 'fail';
    }
    if (d.receiver !== 'nera') return undefined;
    if (d.pulse.sig !== 'Heat') return 'fail';
    const next = this.seals.find((s) => !s.broken);
    if (!next) return 'none';
    if (next.id === 'scaleB') {
      // must arrive from behind: the pulse travels the same way the mirrored face looks
      if (dot(d.pulse.dir, this.facing) < 0.3) {
        this.reflect(sim, d.pos);
        return 'fail';
      }
    }
    if (next.id === 'scaleC' && d.pulse.power < 2) {
      this.reflect(sim, d.pos);
      return 'fail';
    }
    if (sim.breakSeal(next.id, `pulse${d.pulse.id}`, d.pos)) {
      const broken = this.seals.filter((s) => s.broken).length;
      if (this.coreExposed) this.enterCore(sim);
      else sim.setBossPhase(broken === 1 ? 'turned' : 'hardened');
      return 'success';
    }
    return 'none';
  }

  private reflect(sim: Sim, at: Vec): void {
    // mirror scales throw the energy back as a short beam toward the player
    const d = norm(sub(sim.player.pos, at));
    sim.spawnAttack({ kind: 'beam', owner: 'reflect', sig: null, harmful: true, p: { x: at.x, y: at.y, ang: datan2(d.y, d.x), len: 160, w: 2, spin: 0, tele: 0.35, active: 0.3 } });
    sim.emit({ type: 'sealRejected', id: 'scale', pos: at, text: 'reflect' });
  }

  private enterCore(sim: Sim): void {
    sim.setBossPhase('shattered');
    this.state = 'core';
    const hooked = this.hookedNeedle(sim);
    if (hooked) sim.disableNeedle(hooked, 0.8);
    for (const f of this.figs) {
      if (f.true) continue;
      f.body.enabled = false;
      f.hidden = 1e9;
    }
    const tb = this.trueFig;
    tb.body.shapes[0]!.tag = 'NonAnchorable';
    this.swimA = datan2(tb.body.pos.y - 148, tb.body.pos.x - 208);
  }

  updateDefeated(sim: Sim): void {
    this.view.pose = 'defeat';
    this.view.poseT += DT;
    void sim;
  }

  private syncView(sim: Sim): void {
    const v = this.view;
    const pose = this.state === 'dive' ? 'dive' : this.coreExposed ? 'swim' : 'idle';
    if (v.pose !== pose) {
      v.pose = pose;
      v.poseT = 0;
    } else v.poseT += DT;
    this.figs.forEach((f, i) => {
      const toP = sub(sim.player.pos, f.body.pos);
      v.parts[`fig${i}`] = { x: f.body.pos.x, y: f.body.pos.y, on: f.body.enabled || (this.state === 'dive' && f.hidden <= 0), f: toP.x >= 0 ? 1 : -1, a: f.true ? 1 : 0 };
    });
    v.parts.refract = { x: this.trueFig.body.pos.x, y: this.trueFig.body.pos.y, on: this.refracted.size > 0 };
    v.parts.face = { x: this.facing.x, y: this.facing.y };
    v.flash = this.seals.some((s) => s.brokenTick === sim.tick) ? 0.3 : Math.max(0, v.flash - DT);
  }

  debugInfo() {
    return { state: this.state, trueSpot: this.trueFig.spot, hooked: +this.hookedT.toFixed(1), refracted: [...this.refracted].join(',') };
  }
}

export const neraHelpers = { add, scale, len, fromAngle };
