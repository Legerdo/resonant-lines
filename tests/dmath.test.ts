// Deterministic math: accurate against the native functions, and a golden bit-fingerprint that any JS engine must
// reproduce (the same fingerprint is checked in the browser by e2e/e06_production.spec.ts).
import { describe, it, expect } from 'vitest';
import { dsin, dcos, datan2, dasin, dtan, dexp, datan } from '../src/core/math/dmath.ts';
import { dmathFingerprint } from '../src/core/math/dmathFingerprint.ts';
import { DMATH_GOLDEN } from './fixtures/dmathGolden.ts';

function samples(n: number, spread: number): number[] {
  let s = 987654321;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out.push((s / 4294967296 - 0.5) * spread);
  }
  return out;
}

describe('dmath', () => {
  it('matches native sin/cos/tan within 1e-14 over [-200, 200]', () => {
    for (const x of samples(20000, 400)) {
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-14);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-14);
      if (Math.abs(Math.cos(x)) > 1e-3) expect(Math.abs(dtan(x) - Math.tan(x)) / Math.max(1, Math.abs(Math.tan(x)))).toBeLessThan(1e-12);
    }
  });
  it('matches native atan/atan2/asin/exp', () => {
    const ys = samples(20000, 800);
    const xs = samples(20000, 800).reverse();
    for (let i = 0; i < ys.length; i++) {
      expect(Math.abs(datan2(ys[i]!, xs[i]!) - Math.atan2(ys[i]!, xs[i]!))).toBeLessThan(1e-14);
      expect(Math.abs(datan(ys[i]!) - Math.atan(ys[i]!))).toBeLessThan(1e-14);
    }
    for (const x of samples(5000, 2)) expect(Math.abs(dasin(x) - Math.asin(x))).toBeLessThan(1e-13);
    for (const x of samples(5000, 40)) expect(Math.abs(dexp(x) - Math.exp(x)) / Math.exp(x)).toBeLessThan(1e-14);
  });
  it('edge cases follow Math semantics', () => {
    expect(datan2(0, 0)).toBe(0);
    expect(datan2(0, -1)).toBeCloseTo(Math.PI, 15);
    expect(datan2(-0, -1)).toBeCloseTo(-Math.PI, 15);
    expect(datan2(1, 0)).toBe(Math.PI / 2);
    expect(datan2(-1, 0)).toBe(-Math.PI / 2);
    expect(dsin(0)).toBe(0);
    expect(dcos(0)).toBe(1);
    expect(dexp(0)).toBe(1);
    expect(Number.isNaN(dsin(Infinity))).toBe(true);
  });
  it('golden fingerprint (engine independent)', () => {
    expect(dmathFingerprint()).toBe(GOLDEN);
  });
});

// recorded with Node 24; the browser E2E asserts the same value in Chromium
const GOLDEN = DMATH_GOLDEN;
