// Bit-level fingerprint of the deterministic math functions over a fixed input set. Identical on every engine that
// implements IEEE-754 double arithmetic correctly; exposed to E2E through the test API.
import { dsin, dcos, datan2, dasin, dexp } from './dmath.ts';

export function dmathFingerprint(): string {
  const buf = new Float64Array(1);
  const u = new Uint32Array(buf.buffer);
  let h = 2166136261;
  const mix = (v: number) => {
    buf[0] = v;
    h = Math.imul(h ^ u[0]!, 16777619) >>> 0;
    h = Math.imul(h ^ u[1]!, 16777619) >>> 0;
  };
  let s = 12345;
  for (let i = 0; i < 4000; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const a = (s / 4294967296 - 0.5) * 800;
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const b = (s / 4294967296 - 0.5) * 800;
    mix(dsin(a));
    mix(dcos(b));
    mix(datan2(a, b));
    mix(dasin(Math.max(-1, Math.min(1, a / 400))));
    mix(dexp(b / 40));
  }
  return h.toString(16).padStart(8, '0');
}
