// Deterministic transcendental functions for the simulation (and the input-only QA bots).
//
// JavaScript engines do not guarantee bit-identical Math.sin / cos / atan2 / exp results: measured on this project,
// Node 24 (V8 13) and Chromium 153 differ in the last bits. Because the sim is chaotic (a 1-ulp difference in an aim
// angle can flip a later decision), the same seed + input sequence then produced different fights in the headless
// tests and in the browser. Everything below uses only IEEE-754 basic operations (+ - * / and sqrt), which every
// engine must round identically, so the sim is bit-for-bit reproducible across engines (A15).
// Accuracy is within a few ulps of the native functions, far below anything gameplay can observe.
// Presentation code may keep using native Math (it never feeds back into the sim).

const PI = 3.141592653589793;
const PIO2 = 1.5707963267948966;
const TWO_OVER_PI = 0.6366197723675814;
// Cody-Waite split of pi/2: PIO2_HI has 33 significant bits, so k * PIO2_HI is exact for |k| < 2^20
const PIO2_HI = 1.5707963267341256;
const PIO2_LO = 6.077100506506192e-11;

// Taylor coefficients (1/n! with alternating sign), evaluated with Horner's rule
const S1 = -1 / 6;
const S2 = 1 / 120;
const S3 = -1 / 5040;
const S4 = 1 / 362880;
const S5 = -1 / 39916800;
const S6 = 1 / 6227020800;
const S7 = -1 / 1307674368000;
const C1 = -1 / 2;
const C2 = 1 / 24;
const C3 = -1 / 720;
const C4 = 1 / 40320;
const C5 = -1 / 3628800;
const C6 = 1 / 479001600;
const C7 = -1 / 87178291200;
const C8 = 1 / 20922789888000;

/** sin on [-pi/4, pi/4] (truncation error < 5e-17) */
function kSin(r: number): number {
  const s = r * r;
  return r + r * s * (S1 + s * (S2 + s * (S3 + s * (S4 + s * (S5 + s * (S6 + s * S7))))));
}

/** cos on [-pi/4, pi/4] (truncation error < 3e-18) */
function kCos(r: number): number {
  const s = r * r;
  return 1 + s * (C1 + s * (C2 + s * (C3 + s * (C4 + s * (C5 + s * (C6 + s * (C7 + s * C8)))))));
}

/** range reduction x = k * pi/2 + r, |r| <= ~pi/4; returns [quadrant 0..3, r] */
function reduce(x: number): [number, number] {
  const k = Math.round(x * TWO_OVER_PI);
  const r = x - k * PIO2_HI - k * PIO2_LO;
  return [((k % 4) + 4) % 4, r];
}

export function dsin(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  const [q, r] = reduce(x);
  switch (q) {
    case 0: return kSin(r);
    case 1: return kCos(r);
    case 2: return -kSin(r);
    default: return -kCos(r);
  }
}

export function dcos(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  const [q, r] = reduce(x);
  switch (q) {
    case 0: return kCos(r);
    case 1: return -kSin(r);
    case 2: return -kCos(r);
    default: return kSin(r);
  }
}

export function dtan(x: number): number {
  return dsin(x) / dcos(x);
}

// odd series for atan on |x| <= tan(pi/16): x * (1 - x^2/3 + x^4/5 - ...), 12 terms (error < 1e-18)
const ATAN_INV = [1, 1 / 3, 1 / 5, 1 / 7, 1 / 9, 1 / 11, 1 / 13, 1 / 15, 1 / 17, 1 / 19, 1 / 21, 1 / 23];

export function datan(x: number): number {
  if (Number.isNaN(x)) return NaN;
  let sign = 1;
  if (x < 0) {
    x = -x;
    sign = -1;
  }
  let inv = false;
  if (x > 1) {
    x = 1 / x;
    inv = true;
  }
  // two half-angle steps: atan(x) = 2 atan(x / (1 + sqrt(1 + x^2)))  ->  |x| <= tan(pi/16)
  x = x / (1 + Math.sqrt(1 + x * x));
  x = x / (1 + Math.sqrt(1 + x * x));
  const s = x * x;
  let t = ATAN_INV[11]!;
  for (let k = 10; k >= 0; k--) t = ATAN_INV[k]! - s * t;
  let a = 4 * x * t;
  if (inv) a = PIO2 - a;
  return sign * a;
}

export function datan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  const yNeg = y < 0 || Object.is(y, -0);
  if (x === 0) {
    if (y === 0) return Object.is(x, -0) ? (yNeg ? -PI : PI) : y;
    return y > 0 ? PIO2 : -PIO2;
  }
  const a = datan(y / x);
  if (x > 0) return a;
  return yNeg ? a - PI : a + PI;
}

/** sqrt(x^2 + y^2) with basic ops only (Math.hypot is not required to be correctly rounded) */
export function dhypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function dasin(x: number): number {
  if (x > 1 || x < -1 || Number.isNaN(x)) return NaN;
  return datan2(x, Math.sqrt(1 - x * x));
}

const LN2_HI = 0.6931471803691238; // 33 significant bits
const LN2_LO = 1.9082149292705877e-10;
const INV_LN2 = 1.4426950408889634;

export function dexp(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x > 709) return Infinity;
  if (x < -745) return 0;
  const k = Math.round(x * INV_LN2);
  const r = x - k * LN2_HI - k * LN2_LO;
  // Taylor to r^14/14!, |r| <= ln2/2 (error < 2e-19)
  let t = 1;
  for (let i = 14; i >= 1; i--) t = 1 + (r / i) * t;
  // exact power of two by repeated doubling/halving
  let p = 1;
  if (k > 0) for (let i = 0; i < k; i++) p *= 2;
  else for (let i = 0; i < -k; i++) p *= 0.5;
  return t * p;
}
