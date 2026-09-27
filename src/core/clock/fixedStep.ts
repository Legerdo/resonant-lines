export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

/**
 * Accumulator that converts arbitrary render frame deltas into a whole number of fixed simulation ticks.
 * Render FPS never changes simulation results: 30/60/144 Hz produce the same tick sequence for the same elapsed time.
 */
export class FixedStepClock {
  private acc = 0;
  /** scale < 1 implements the optional slow mode */
  timeScale = 1;
  private readonly maxTicksPerFrame: number;
  constructor(maxTicksPerFrame = 8) {
    this.maxTicksPerFrame = maxTicksPerFrame;
  }

  /** @returns number of ticks to simulate for this frame */
  advance(frameSeconds: number): number {
    const dt = Math.min(Math.max(frameSeconds, 0), 0.25) * this.timeScale;
    this.acc += dt;
    let n = 0;
    while (this.acc >= DT - 1e-9 && n < this.maxTicksPerFrame) {
      this.acc -= DT;
      n++;
    }
    if (n === this.maxTicksPerFrame) this.acc = Math.min(this.acc, DT);
    return n;
  }

  /** fraction of a tick left in the accumulator (0..1) */
  get alpha(): number {
    return Math.min(1, Math.max(0, this.acc / DT));
  }

  reset(): void {
    this.acc = 0;
  }
}
