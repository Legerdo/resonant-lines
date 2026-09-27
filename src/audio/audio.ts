// Procedural WebAudio engine (no audio files). Buses: Master > Music/Boss/Resonance/Impact/Environment/UI.
// Everything audible also has a visual counterpart (links, telegraphs, HUD) so the game is playable muted.
import type { SimEvent, Link } from '../core/sim/types.ts';

export type Bus = 'music' | 'boss' | 'resonance' | 'impact' | 'environment' | 'ui';
export const BUSES: readonly Bus[] = ['music', 'boss', 'resonance', 'impact', 'environment', 'ui'];

interface Track {
  root: number; // Hz
  scale: number[]; // semitone offsets
  bpm: number;
  pulse: boolean; // rhythmic low pulse (boss tracks)
  bright: number; // 0..1 arpeggio density
}

const TRACKS: Record<string, Track> = {
  title: { root: 110, scale: [0, 3, 7, 10, 14], bpm: 56, pulse: false, bright: 0.25 },
  hub: { root: 98, scale: [0, 2, 7, 9, 14], bpm: 60, pulse: false, bright: 0.3 },
  region_quarry: { root: 87.3, scale: [0, 3, 5, 7, 10], bpm: 64, pulse: false, bright: 0.25 },
  region_garden: { root: 110, scale: [0, 2, 4, 7, 9], bpm: 62, pulse: false, bright: 0.35 },
  region_belfry: { root: 123.5, scale: [0, 3, 7, 8, 12], bpm: 58, pulse: false, bright: 0.3 },
  region_marsh: { root: 92.5, scale: [0, 2, 3, 7, 10], bpm: 54, pulse: false, bright: 0.28 },
  boss_gram: { root: 73.4, scale: [0, 3, 5, 6, 7, 10], bpm: 96, pulse: true, bright: 0.45 },
  boss_hum: { root: 82.4, scale: [0, 4, 7, 11], bpm: 84, pulse: true, bright: 0.5 },
  boss_nera: { root: 98, scale: [0, 1, 5, 7, 8], bpm: 90, pulse: true, bright: 0.5 },
  boss_mora: { root: 69.3, scale: [0, 3, 7, 10], bpm: 88, pulse: true, bright: 0.4 },
  boss_eye: { root: 77.8, scale: [0, 2, 3, 7, 8], bpm: 80, pulse: true, bright: 0.45 },
  boss_brak: { root: 65.4, scale: [0, 3, 5, 6, 10], bpm: 104, pulse: true, bright: 0.4 },
  boss_orbit: { root: 103.8, scale: [0, 4, 7, 9, 14], bpm: 92, pulse: true, bright: 0.55 },
  boss_crown: { root: 87.3, scale: [0, 1, 4, 7, 8], bpm: 86, pulse: true, bright: 0.5 },
  boss_star: { root: 61.7, scale: [0, 3, 7, 10, 12, 15], bpm: 100, pulse: true, bright: 0.6 },
  ending: { root: 130.8, scale: [0, 4, 7, 11, 14], bpm: 52, pulse: false, bright: 0.4 },
  none: { root: 0, scale: [0], bpm: 60, pulse: false, bright: 0 },
};

const SIG_FREQ: Record<string, number> = { Impact: 196, Wave: 330, Heat: 440, Void: 147, Rotational: 262 };
const TONE_FREQ = [110, 165, 247];

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses = new Map<Bus, GainNode>();
  private noise: AudioBuffer | null = null;
  private hums = new Map<string, { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode }>();
  private track: Track = TRACKS.none!;
  private trackId = 'none';
  private nextBeat = 0;
  private beat = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  volumes: Record<'master' | Bus, number> = { master: 0.8, music: 0.6, boss: 0.8, resonance: 0.8, impact: 0.8, environment: 0.6, ui: 0.7 };
  muted = false;

  get state(): string {
    return this.ctx?.state ?? 'none';
  }

  /** Must be called from a user gesture (browser autoplay policy). Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        for (const b of BUSES) {
          const g = this.ctx.createGain();
          g.connect(this.master);
          this.buses.set(b, g);
        }
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        let s = 12345;
        for (let i = 0; i < len; i++) {
          s = (s * 1103515245 + 12345) & 0x7fffffff;
          d[i] = (s / 0x7fffffff) * 2 - 1;
        }
        this.applyVolumes();
        this.timer = setInterval(() => this.schedule(), 60);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(v: Partial<Record<'master' | Bus, number>>): void {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volumes.master, t, 0.02);
    for (const b of BUSES) this.buses.get(b)!.gain.setTargetAtTime(this.volumes[b], t, 0.02);
  }

  private bus(b: Bus): GainNode | null {
    return this.buses.get(b) ?? null;
  }

  private tone(bus: Bus, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, pan = 0, delay = 0): void {
    const ctx = this.ctx;
    const out = this.bus(bus);
    if (!ctx || !out) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = g;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
      g.connect(p);
      node = p;
    }
    node.connect(out);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(bus: Bus, freq: number, q: number, dur: number, vol: number, sweep = 1, delay = 0): void {
    const ctx = this.ctx;
    const out = this.bus(bus);
    if (!ctx || !out || !this.noise) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  sfx(name: string, value = 0, pan = 0): void {
    if (!this.ctx) return;
    switch (name) {
      case 'fire': this.hiss('resonance', 3200, 4, 0.12, 0.25, 2); this.tone('resonance', 'sine', 900, 1800, 0.1, 0.08, pan); break;
      case 'embed': this.tone('resonance', 'triangle', 820, 260, 0.09, 0.22, pan); this.hiss('impact', 1800, 8, 0.04, 0.2); break;
      case 'bounce': this.tone('impact', 'square', 1400, 900, 0.06, 0.06, pan); break;
      case 'disabled': this.tone('impact', 'triangle', 300, 120, 0.2, 0.12, pan); break;
      case 'recall': this.hiss('resonance', 600, 3, 0.25, 0.12, 4); break;
      case 'catch': this.tone('resonance', 'sine', 1300, 1600, 0.05, 0.08); break;
      case 'link': this.tone('resonance', 'sine', 440, 440, 0.25, 0.06, pan); this.tone('resonance', 'sine', 660, 660, 0.3, 0.04, pan, 0.03); break;
      case 'unlink': this.tone('resonance', 'sine', 500, 250, 0.15, 0.05, pan); break;
      case 'capture': {
        const f = SIG_FREQ[value as unknown as string] ?? 262;
        this.tone('resonance', 'triangle', f, f * 1.5, 0.35, 0.16, pan);
        this.tone('resonance', 'sine', f * 2, f * 2, 0.5, 0.06, pan, 0.05);
        break;
      }
      case 'overload': this.tone('resonance', 'sawtooth', 220, 233, 0.5, 0.07, pan); this.tone('resonance', 'sawtooth', 227, 240, 0.5, 0.07, pan); break;
      case 'pulse': this.tone('resonance', 'sine', 300, 1400, 0.28, 0.2, pan); this.hiss('resonance', 1500, 2, 0.25, 0.1, 3); break;
      case 'deliver': this.tone('resonance', 'sine', 988, 988, 0.6, 0.14, pan); this.tone('resonance', 'sine', 1480, 1480, 0.5, 0.07, pan, 0.02); break;
      case 'reject': this.tone('impact', 'square', 180, 90, 0.25, 0.1, pan); this.hiss('impact', 300, 1, 0.2, 0.2); break;
      case 'fizzle': this.hiss('resonance', 900, 2, 0.2, 0.1, 0.3); break;
      case 'empty': this.tone('ui', 'square', 160, 140, 0.07, 0.05); break;
      case 'hit': this.hiss('impact', 4000, 1.5, 0.18, 0.4, 0.5); this.tone('impact', 'square', 1900, 700, 0.15, 0.1); break;
      case 'death': this.tone('impact', 'sine', 330, 55, 1.2, 0.3); this.hiss('impact', 800, 1, 0.8, 0.2, 0.2); break;
      case 'restore': [0, 1, 2].forEach((i) => this.tone('resonance', 'sine', 660 * (1 + i * 0.25), 660 * (1 + i * 0.25), 0.25, 0.08, 0, i * 0.07)); break;
      case 'dash': this.hiss('impact', 1200, 1, 0.16, 0.12, 0.4); break;
      case 'thread': this.tone('resonance', 'sine', 700, 1400, 0.12, 0.1, pan); break;
      case 'seal': [196, 294, 392, 587].forEach((f, i) => this.tone('boss', 'triangle', f, f, 1.4, 0.12, 0, i * 0.04)); this.hiss('impact', 120, 0.7, 0.9, 0.5, 0.6); break;
      case 'core': this.tone('boss', 'sine', 60, 40, 0.5, 0.4); this.tone('boss', 'sine', 60, 40, 0.5, 0.35, 0, 0.35); break;
      case 'victory': [131, 196, 262, 330, 392, 523].forEach((f, i) => this.tone('boss', 'sine', f, f, 2.4, 0.08, 0, i * 0.09)); break;
      case 'boom': this.tone('impact', 'sine', 110, 38, 0.45, 0.45, pan); this.hiss('impact', 200, 0.8, 0.4, 0.4, 0.4); break;
      case 'crash': this.tone('impact', 'sine', 90, 30, 0.6, 0.5, pan); this.hiss('impact', 400, 0.6, 0.6, 0.5, 0.3); break;
      case 'rumble': this.hiss('boss', 90, 0.5, 0.8, 0.35, 1.2); break;
      case 'telegraph': this.tone('boss', 'triangle', 150, 220, 0.3, 0.07, pan); break;
      case 'hum': { const f = TONE_FREQ[value] ?? 165; this.tone('boss', 'sine', f, f, 0.9, 0.18, pan); this.tone('boss', 'sine', f * 2, f * 2, 0.9, 0.05, pan); break; }
      case 'door': this.hiss('environment', 180, 0.6, 1.0, 0.35, 0.7); this.tone('environment', 'sine', 98, 147, 1.0, 0.1); break;
      case 'ui': this.tone('ui', 'square', 880, 880, 0.04, 0.04); break;
      case 'uiMove': this.tone('ui', 'square', 660, 660, 0.03, 0.03); break;
      case 'uiBack': this.tone('ui', 'square', 440, 330, 0.06, 0.04); break;
      default: break;
    }
  }

  /** Map sim events to sounds. `panOf` maps world x -> stereo pan. */
  onEvents(events: readonly SimEvent[], panOf: (x: number) => number): void {
    if (!this.ctx) return;
    for (const e of events) {
      const pan = e.pos ? panOf(e.pos.x) : 0;
      switch (e.type) {
        case 'needleFired': this.sfx('fire', 0, pan); break;
        case 'needleEmbedded': this.sfx('embed', 0, pan); break;
        case 'needleBounced': this.sfx('bounce', 0, pan); break;
        case 'needleDisabled': this.sfx('disabled', 0, pan); break;
        case 'needleRecalled': this.sfx('recall'); break;
        case 'needleCaught': this.sfx('catch'); break;
        case 'recallDenied': this.sfx('reject', 0, pan); break;
        case 'linkFormed': this.sfx('link', 0, pan); break;
        case 'linkLost': this.sfx('unlink', 0, pan); break;
        case 'linkBroken': this.sfx('reject', 0, pan); break;
        case 'capture': this.sfx('capture', (e.sig ?? 'Impact') as unknown as number, pan); break;
        case 'overload': this.sfx('overload', 0, pan); break;
        case 'pulseFired': this.sfx('pulse', 0, e.dir ? Math.max(-1, Math.min(1, e.dir.x)) : pan); break;
        case 'pulseDelivered': this.sfx(e.result === 'fail' ? 'reject' : 'deliver', 0, pan); break;
        case 'pulseFizzled': this.sfx('fizzle', 0, pan); break;
        case 'pulseEmpty': this.sfx('empty'); break;
        case 'playerHit': this.sfx('hit', 0, pan); break;
        case 'playerDied': this.sfx('death'); break;
        case 'shieldRestored': this.sfx('restore'); break;
        case 'dash': this.sfx('dash'); break;
        case 'threadStep': this.sfx('thread', 0, pan); break;
        case 'sealBroken': this.sfx('seal'); break;
        case 'sealRejected': this.sfx('reject', 0, pan); break;
        case 'coreExposed': this.sfx('core'); break;
        case 'bossVictory': this.sfx('victory'); break;
        case 'telegraph': if (e.id === 'charge' || e.id === 'slam') this.sfx('rumble'); break;
        case 'attack': if (e.sig === 'Impact') this.sfx('boom', 0, pan); break;
        case 'doorOpened': this.sfx('door'); break;
        case 'sfx': if (e.text === 'crash') this.sfx('crash', 0, pan); else if (e.text === 'hum') this.sfx('hum', e.value ?? 1, pan); else if (e.text === 'coreHum') this.sfx('core'); else if (e.text === 'empty') this.sfx('empty'); break;
        default: break;
      }
    }
  }

  /** Continuous per-link hum reflecting link state (Idle hum / Charging rise / Charged tone / Overloaded beat). */
  updateHums(links: readonly Link[]): void {
    const ctx = this.ctx;
    const out = this.bus('resonance');
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    for (const l of links) {
      let h = this.hums.get(l.id);
      if (!h) {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc2.type = 'sine';
        gain.gain.value = 0;
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(out);
        osc.start();
        osc2.start();
        h = { osc, osc2, gain };
        this.hums.set(l.id, h);
      }
      const base = l.id === 'AB' ? 110 : l.id === 'BC' ? 123.5 : 98;
      let f = base;
      let f2 = base * 1.5;
      let g = 0;
      if (l.valid) {
        g = 0.018;
        if (l.state === 'Charging' || l.progress > 0) {
          f = base * (1 + l.progress);
          f2 = f * 1.5;
          g = 0.03;
        }
        if (l.state === 'Charged') {
          f = base * 2;
          f2 = base * 3;
          g = 0.035;
        }
        if (l.state === 'Overloaded') {
          f = base * 2;
          f2 = base * 2 + 5; // unstable beat
          g = 0.05;
        }
      }
      h.osc.frequency.setTargetAtTime(f, t, 0.05);
      h.osc2.frequency.setTargetAtTime(f2, t, 0.05);
      h.gain.gain.setTargetAtTime(g, t, 0.08);
    }
  }

  silenceHums(): void {
    if (!this.ctx) return;
    for (const h of this.hums.values()) h.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  setMusic(id: string): void {
    if (id === this.trackId) return;
    this.trackId = id;
    this.track = TRACKS[id] ?? TRACKS.none!;
    this.beat = 0;
    if (this.ctx) this.nextBeat = this.ctx.currentTime + 0.1;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.track.root === 0) return;
    const spb = 60 / this.track.bpm / 2; // eighth notes
    while (this.nextBeat < ctx.currentTime + 0.25) {
      this.playBeat(this.nextBeat - ctx.currentTime, this.beat);
      this.nextBeat += spb;
      this.beat++;
    }
  }

  private playBeat(delay: number, b: number): void {
    const tr = this.track;
    const bus: Bus = tr.pulse ? 'music' : 'music';
    const note = (deg: number, oct = 0) => tr.root * Math.pow(2, (tr.scale[((deg % tr.scale.length) + tr.scale.length) % tr.scale.length]! + 12 * (oct + Math.floor(deg / tr.scale.length))) / 12);
    if (b % 16 === 0) {
      // drone pad
      this.tone(bus, 'triangle', note(0), note(0), 3.8, 0.05, 0, delay);
      this.tone(bus, 'sine', note(2, 1), note(2, 1), 3.6, 0.025, 0, delay);
    }
    if (tr.pulse && b % 2 === 0) this.tone(bus, 'sine', note(0, -1), note(0, -1) * 0.9, 0.18, b % 8 === 0 ? 0.12 : 0.06, 0, delay);
    // deterministic sparse arpeggio
    const h = ((b * 2654435761) >>> 0) % 100;
    if (h < tr.bright * 100) {
      const deg = (b * 3 + (h % 5)) % (tr.scale.length * 2);
      this.tone(bus, 'sine', note(deg, 1), note(deg, 1), 0.6, 0.03, ((h % 7) - 3) / 6, delay);
    }
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    void this.ctx?.close();
  }
}
