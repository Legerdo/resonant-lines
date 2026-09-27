// Input = user intent. Keyboard/mouse/gamepad are merged into one InputFrame per simulation tick.
// Edge-triggered actions are buffered until the next tick consumes them; focus loss clears everything (A18).
import { emptyInput, type InputFrame } from '../core/sim/types.ts';
import type { Vec } from '../core/math/vec.ts';

export type Action = 'up' | 'down' | 'left' | 'right' | 'dash' | 'pulse' | 'recallAll' | 'select' | 'pause';
export type Bindings = Record<Action, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  dash: ['ShiftLeft', 'Space'],
  pulse: ['KeyE'],
  recallAll: ['KeyR'],
  select: ['KeyQ'],
  pause: ['Escape'],
};

export const ACTIONS: readonly Action[] = ['up', 'down', 'left', 'right', 'dash', 'pulse', 'recallAll', 'select', 'pause'];

interface Edges {
  fire: boolean;
  recall: boolean;
  recallAll: boolean;
  selNext: boolean;
  selPrev: boolean;
  selIndex: number;
  pulse: boolean;
  dash: boolean;
}

const noEdges = (): Edges => ({ fire: false, recall: false, recallAll: false, selNext: false, selPrev: false, selIndex: -1, pulse: false, dash: false });

export interface PadState {
  connected: boolean;
  id: string;
}

export class InputManager {
  bindings: Bindings = structuredClone(DEFAULT_BINDINGS);
  deadzone = 0.2;
  aimSensitivity = 1;
  vibration = true;
  /** logical (640x360) mouse position */
  mouse: Vec = { x: 320, y: 200 };
  mouseActive = true;
  private held = new Set<string>();
  private edges: Edges = noEdges();
  private padPrev: boolean[] = [];
  private padAim: Vec | null = null;
  private padMove: Vec = { x: 0, y: 0 };
  pad: PadState = { connected: false, id: '' };
  /** UI hooks (pause, retry, menu) — called on key down, outside the sim */
  onKey: ((code: string, e: KeyboardEvent) => void) | null = null;
  onPadButton: ((button: number) => void) | null = null;
  /** when set, a bot supplies frames instead of devices */
  override: (() => InputFrame) | null = null;
  enabled = true;
  private readonly toLogical: (clientX: number, clientY: number) => Vec;

  constructor(target: HTMLElement, toLogical: (clientX: number, clientY: number) => Vec) {
    this.toLogical = toLogical;
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.clearAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearAll();
    });
    target.addEventListener('mousemove', (e) => {
      this.mouse = this.toLogical(e.clientX, e.clientY);
      this.mouseActive = true;
    });
    target.addEventListener('mousedown', (e) => {
      this.mouse = this.toLogical(e.clientX, e.clientY);
      this.mouseActive = true;
      if (!this.enabled) return;
      if (e.button === 0) this.edges.fire = true;
      if (e.button === 2) this.edges.recall = true;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        if (e.deltaY > 0) this.edges.selNext = true;
        else if (e.deltaY < 0) this.edges.selPrev = true;
        e.preventDefault();
      },
      { passive: false },
    );
  }

  private is(action: Action, code: string): boolean {
    return this.bindings[action].includes(code);
  }

  private keyDown(e: KeyboardEvent): void {
    if (e.repeat) {
      this.onKey?.(e.code, e);
      return;
    }
    this.held.add(e.code);
    this.onKey?.(e.code, e);
    if (!this.enabled) return;
    const c = e.code;
    if (this.is('dash', c)) this.edges.dash = true;
    if (this.is('pulse', c)) this.edges.pulse = true;
    if (this.is('recallAll', c)) this.edges.recallAll = true;
    if (this.is('select', c)) this.edges.selNext = true;
    if (c === 'Digit1') this.edges.selIndex = 0;
    if (c === 'Digit2') this.edges.selIndex = 1;
    if (c === 'Digit3') this.edges.selIndex = 2;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c) && this.enabled) e.preventDefault();
  }

  clearAll(): void {
    this.held.clear();
    this.edges = noEdges();
    this.padMove = { x: 0, y: 0 };
    this.padAim = null;
    this.padPrev = [];
  }

  heldCount(): number {
    return this.held.size + (Math.hypot(this.padMove.x, this.padMove.y) > 0 ? 1 : 0);
  }

  /** poll gamepads once per render frame */
  pollPad(): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(pads ?? []).find((p) => p && p.connected) ?? null;
    this.pad = { connected: !!gp, id: gp?.id ?? '' };
    if (!gp) {
      this.padMove = { x: 0, y: 0 };
      return;
    }
    const dz = (x: number, y: number): Vec => {
      const m = Math.hypot(x, y);
      if (m < this.deadzone) return { x: 0, y: 0 };
      const k = Math.min(1, (m - this.deadzone) / (1 - this.deadzone)) / m;
      return { x: x * k, y: y * k };
    };
    this.padMove = dz(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
    const aim = dz(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
    if (Math.hypot(aim.x, aim.y) > 0.05) {
      this.padAim = aim;
      this.mouseActive = false;
    }
    const btn = (i: number) => !!gp.buttons[i]?.pressed || (gp.buttons[i]?.value ?? 0) > 0.5;
    for (let i = 0; i < gp.buttons.length; i++) {
      const now = btn(i);
      const was = this.padPrev[i] ?? false;
      if (now && !was) {
        this.onPadButton?.(i);
        if (this.enabled) {
          if (i === 7) this.edges.fire = true;
          if (i === 6) this.edges.recall = true;
          if (i === 3) this.edges.recallAll = true;
          if (i === 2) this.edges.pulse = true;
          if (i === 0) this.edges.dash = true;
          if (i === 5) this.edges.selNext = true;
          if (i === 4) this.edges.selPrev = true;
        }
      }
      this.padPrev[i] = now;
    }
  }

  rumble(ms: number, strength: number): void {
    if (!this.vibration) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(pads ?? []).find((p) => p && p.connected);
    const act = (gp as unknown as { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } } | undefined)?.vibrationActuator;
    act?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch(() => undefined);
  }

  /** Build the frame for one simulation tick. `worldOf` converts logical screen -> world. */
  consumeFrame(playerPos: Vec, worldOf: (v: Vec) => Vec): InputFrame {
    if (this.override) {
      this.edges = noEdges();
      return this.override();
    }
    const f = emptyInput();
    if (this.enabled) {
      let mx = 0;
      let my = 0;
      for (const c of this.held) {
        if (this.is('left', c)) mx -= 1;
        if (this.is('right', c)) mx += 1;
        if (this.is('up', c)) my -= 1;
        if (this.is('down', c)) my += 1;
      }
      mx += this.padMove.x;
      my += this.padMove.y;
      const m = Math.hypot(mx, my);
      f.move = m > 1 ? { x: mx / m, y: my / m } : { x: mx, y: my };
      Object.assign(f, this.edges);
    }
    if (!this.mouseActive && this.padAim) {
      const reach = (70 + 110 * Math.min(1, Math.hypot(this.padAim.x, this.padAim.y))) * this.aimSensitivity;
      const l = Math.hypot(this.padAim.x, this.padAim.y) || 1;
      f.aim = { x: playerPos.x + (this.padAim.x / l) * reach, y: playerPos.y + (this.padAim.y / l) * reach };
    } else {
      f.aim = worldOf(this.mouse);
    }
    this.edges = noEdges();
    return f;
  }
}
