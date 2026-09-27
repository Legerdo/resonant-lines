// B02 종루의 허밍 — "같은 에너지라도 어디로 보내느냐가 중요하다."
// Every hum is a Wave with a pitch (0 low / 1 mid / 2 high) shown by waveform size, bell vibration and sound.
// Seal k breaks only when a Wave of pitch k is delivered into bell k. A wrong bell rings back and makes the next
// attack dissonant (double ring). With all bells answered, the clapper drops and swings as a TemporaryAnchor;
// catch the chord (pitch 3) and deliver it into the clapper.
import { DT } from '../../core/clock/fixedStep.ts';
import { type Vec, copy, sub, len, norm } from '../../core/math/vec.ts';
import { makeBody, circle } from '../../core/sim/bodies.ts';
import type { Body, DeliveryInfo, PulseResult } from '../../core/sim/types.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { type BossController, makeSeals, newView } from '../framework/boss.ts';
import { datan2, dcos, dsin } from '../../core/math/dmath.ts';

type State = 'drift' | 'inhale' | 'fan' | 'recover' | 'drop';

export const HUM = {
  center: { x: 208, y: 140 },
  inhale: 0.95,
  gap: 1.35,
  ringSpeed: [95, 135, 175, 120],
  ringTh: [10, 7, 5, 8],
  rMax: 205,
  clapLen: 58,
  swingPeriod: 2.4,
  glowCycle: 3.0,
  glowOn: 1.8,
};

export class HummingBoss implements BossController {
  readonly id = 'B02';
  phase = 'hum';
  seals = makeSeals([{ id: 'bell0', glyph: 0 }, { id: 'bell1', glyph: 1 }, { id: 'bell2', glyph: 2 }], 'B02');
  coreExposed = false;
  defeated = false;
  view = newView();
  body!: Body;
  clapper!: Body;
  state: State = 'drift';
  t = 0;
  age = 0;
  tone = 0;
  private pattern = [0, 1, 2, 1];
  private idx = 0;
  private attacks = 0;
  dissonant = false;
  fanAng = 0;
  private wrongT: Record<string, number> = {};
  private exposedT = 0;

  setup(sim: Sim): void {
    this.body = sim.addBody(makeBody('hum', 'boss', copy(HUM.center), [
      circle('hum:bell', { x: 0, y: 0 }, 18, 'NonAnchorable', { blocksMove: true }),
      circle('hum:crown', { x: 0, y: -18 }, 9, 'NonAnchorable', { blocksMove: false }),
    ]));
    this.clapper = sim.addBody(makeBody('hum:clap', 'boss', { x: HUM.center.x, y: HUM.center.y + 10 }, [
      circle('hum:clapper', { x: 0, y: 0 }, 6, 'TemporaryAnchor', { enabled: false, blocksMove: false, receiver: 'clapper' }),
    ]));
    this.clapper.enabled = false;
    this.syncView(sim);
  }

  private go(sim: Sim, s: State): void {
    this.state = s;
    this.t = 0;
    sim.record(`B02 ${s}`);
  }

  private nextTone(): number {
    if (this.coreExposed) return 3;
    const live = this.pattern.filter((k) => !this.seals[k]!.broken);
    const k = live[this.idx % live.length] ?? 3;
    this.idx++;
    return k;
  }

  private ring(sim: Sim, tone: number, delay = 0): void {
    const b = this.body.pos;
    sim.spawnAttack({
      kind: 'ring', owner: 'hum', sig: 'Wave', tone, capturable: true, harmful: true,
      p: { x: b.x, y: b.y, r: 16, speed: HUM.ringSpeed[tone]!, rMax: HUM.rMax, th: HUM.ringTh[tone]!, tele: delay },
    });
  }

  update(sim: Sim): void {
    this.t += DT;
    this.age += DT;
    for (const k of Object.keys(this.wrongT)) this.wrongT[k] = Math.max(0, this.wrongT[k]! - DT);
    // slow hovering drift (the bell never charges; its danger is sound)
    const c = HUM.center;
    const amp = this.coreExposed ? 10 : 22;
    this.body.pos = { x: c.x + dsin(this.age * 0.45) * amp, y: c.y + dsin(this.age * 0.31) * (amp * 0.5) };
    if (this.coreExposed) this.updateClapper(sim);

    switch (this.state) {
      case 'drift':
      case 'recover': {
        const wait = this.state === 'recover' ? HUM.gap : 0.9;
        if (this.t >= wait) {
          this.attacks++;
          if (!this.coreExposed && this.attacks % 3 === 0) {
            this.tone = this.nextTone();
            this.go(sim, 'fan');
          } else {
            this.tone = this.nextTone();
            sim.emit({ type: 'sfx', text: 'hum', value: Math.min(2, this.tone), pos: copy(this.body.pos) });
            this.go(sim, 'inhale');
          }
        }
        break;
      }
      case 'inhale':
        if (this.t >= HUM.inhale) {
          this.ring(sim, this.tone);
          if (this.dissonant) {
            // a wrong bell answered: the next song is doubled with a clashing pitch
            this.ring(sim, (this.tone + 1) % 3, 0.35);
            this.dissonant = false;
          }
          sim.emit({ type: 'shake', value: 1 });
          this.go(sim, 'recover');
        }
        break;
      case 'fan': {
        // three short arcs along ONE direction chosen at the start (readable: step out of the cone)
        if (this.t <= DT) {
          const d = norm(sub(sim.player.pos, this.body.pos));
          this.fanAng = datan2(d.y, d.x);
        }
        const shots = [0.6, 0.9, 1.2];
        for (const s of shots) {
          if (this.t - DT < s && this.t >= s) {
            sim.spawnAttack({
              kind: 'ring', owner: 'hum', sig: 'Wave', tone: this.tone, capturable: true, harmful: true,
              p: { x: this.body.pos.x, y: this.body.pos.y, r: 16, speed: 150, rMax: 190, th: 6, tele: 0, arcAng: this.fanAng, arcHalf: 0.5 },
            });
          }
        }
        if (this.t >= 1.3) this.go(sim, 'recover');
        break;
      }
      case 'drop':
        if (this.t >= 1.2) this.go(sim, 'recover');
        break;
    }
    this.syncView(sim);
  }

  private updateClapper(sim: Sim): void {
    this.exposedT += DT;
    const a = dsin((this.exposedT / HUM.swingPeriod) * Math.PI * 2) * 1.05;
    const b = this.body.pos;
    this.clapper.enabled = true;
    this.clapper.pos = { x: b.x + dsin(a) * HUM.clapLen, y: b.y + 8 + dcos(a) * HUM.clapLen * 0.62 };
    const glow = this.exposedT % HUM.glowCycle < HUM.glowOn;
    const s = this.clapper.shapes[0]!;
    if (s.enabled !== glow) sim.record(`B02 clapper ${glow ? 'glow' : 'dim'}`);
    s.enabled = glow;
  }

  onPulseDelivered(sim: Sim, d: DeliveryInfo): PulseResult | undefined {
    const r = d.receiver;
    if (r === 'bell0' || r === 'bell1' || r === 'bell2') {
      const k = Number(r.slice(4));
      const seal = this.seals[k]!;
      if (seal.broken) return 'none';
      if (d.pulse.sig !== 'Wave') return 'fail';
      if (d.pulse.tone !== k) {
        this.wrongT[r] = 1.0;
        this.dissonant = true;
        sim.record(`B02 wrongBell ${r} tone${d.pulse.tone}`);
        sim.emit({ type: 'sealRejected', id: r, pos: d.pos, text: 'pitch' });
        return 'fail';
      }
      if (sim.breakSeal(r, `pulse${d.pulse.id}`, d.pos)) {
        if (this.coreExposed) {
          this.go(sim, 'drop');
          sim.setBossPhase('clapper');
        } else sim.setBossPhase(`silenced${this.seals.filter((s) => s.broken).length}`);
        return 'success';
      }
      return 'none';
    }
    if (r === 'clapper') {
      if (!this.coreExposed || d.pulse.sig !== 'Wave') return 'fail';
      if (d.pulse.tone === 3) {
        sim.requestVictory(d.t, d.pos);
        return 'success';
      }
      this.dissonant = true;
      return 'fail';
    }
    return undefined;
  }

  updateDefeated(sim: Sim): void {
    this.view.pose = 'defeat';
    this.view.poseT += DT;
    this.body.pos = { x: this.body.pos.x, y: Math.min(HUM.center.y + 20, this.body.pos.y + DT * 12) };
    this.clapper.shapes[0]!.enabled = false;
    this.syncProps();
    void sim;
  }

  private syncProps(): void {
    for (let k = 0; k < 3; k++) {
      const id = `bell${k}`;
      const humming = (this.state === 'inhale' || this.state === 'fan') && this.tone === k;
      this.view.props[id] = this.seals[k]!.broken ? 'lit' : (this.wrongT[id] ?? 0) > 0 ? 'wrong' : humming ? 'ring' : 'idle';
    }
  }

  private syncView(sim: Sim): void {
    const v = this.view;
    const pose = this.state === 'inhale' ? 'inhale' : this.state === 'fan' ? 'sing' : this.coreExposed ? 'open' : 'idle';
    if (v.pose !== pose) {
      v.pose = pose;
      v.poseT = 0;
    } else v.poseT += DT;
    v.parts.body = { x: this.body.pos.x, y: this.body.pos.y };
    v.parts.clapper = { x: this.clapper.pos.x, y: this.clapper.pos.y, on: this.coreExposed, f: this.clapper.shapes[0]!.enabled ? 1 : 0 };
    v.parts.pitch = { x: this.body.pos.x, y: this.body.pos.y - 40, f: this.tone, on: this.state === 'inhale' || this.state === 'fan' };
    v.flash = this.seals.some((s) => s.brokenTick === sim.tick) ? 0.3 : Math.max(0, v.flash - DT);
    this.syncProps();
  }

  debugInfo() {
    return { state: this.state, tone: this.tone, dissonant: this.dissonant, clapper: this.clapper?.shapes[0]?.enabled ?? false };
  }
}

export const humDist = (a: Vec, b: Vec): number => len(sub(a, b));
