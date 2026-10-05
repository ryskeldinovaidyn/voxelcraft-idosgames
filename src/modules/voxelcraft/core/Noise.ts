// Сидированный PRNG (mulberry32) и 2D-симплекс-шум — самодостаточно, без зависимостей.

/** Детерминированный PRNG: одинаковый сид → одинаковый мир. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Хэш строки в 32-битный сид (для под-генераторов: "trees:3,-2" и т.п.). */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const GRAD2 = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export class Simplex2 {
  perm: Uint8Array;
  constructor(seed: number) {
    const rand = mulberry32(seed);
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      const pi = p[i]!,
        pj = p[j]!;
      p[i] = pj;
      p[j] = pi;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]!;
  }

  /** Значение шума в диапазоне примерно [-1, 1]. */
  noise(xin: number, yin: number): number {
    const perm = this.perm;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s),
      j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t),
      y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0,
      j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2,
      y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2,
      y2 = y0 - 1 + 2 * G2;
    const ii = i & 255,
      jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = GRAD2[perm[ii + perm[jj]!]! & 7]!;
      t0 *= t0;
      n += t0 * t0 * (g[0]! * x0 + g[1]! * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = GRAD2[perm[ii + i1 + perm[jj + j1]!]! & 7]!;
      t1 *= t1;
      n += t1 * t1 * (g[0]! * x1 + g[1]! * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = GRAD2[perm[ii + 1 + perm[jj + 1]!]! & 7]!;
      t2 *= t2;
      n += t2 * t2 * (g[0]! * x2 + g[1]! * y2);
    }
    return 70 * n;
  }

  /** Фрактальный шум (несколько октав), диапазон примерно [-1, 1]. */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 1,
      freq = 1,
      sum = 0,
      norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}

const GRAD3 = [
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 1],
  [0, -1, 1],
  [0, 1, -1],
  [0, -1, -1],
];
const F3 = 1 / 3;
const G3 = 1 / 6;

/** 3D-симплекс-шум (пещеры, пласты). Значение примерно в [-1, 1]. */
export class Simplex3 {
  private readonly perm: Uint8Array;
  private readonly pm12: Uint8Array;

  constructor(seed: number) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      const pi = p[i]!,
        pj = p[j]!;
      p[i] = pj;
      p[j] = pi;
    }
    this.perm = new Uint8Array(512);
    this.pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255]!;
      this.pm12[i] = this.perm[i]! % 12;
    }
  }

  noise(xin: number, yin: number, zin: number): number {
    const p = this.perm,
      pm = this.pm12;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s),
      j = Math.floor(yin + s),
      k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t),
      y0 = yin - (j - t),
      z0 = zin - (k - t);
    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
    if (x0 >= y0) {
      if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0];
      else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1];
      else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1];
    } else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1];
    else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1];
    else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0];
    const x1 = x0 - i1 + G3,
      y1 = y0 - j1 + G3,
      z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3,
      y2 = y0 - j2 + 2 * G3,
      z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3,
      y3 = y0 - 1 + 3 * G3,
      z3 = z0 - 1 + 3 * G3;
    const ii = i & 255,
      jj = j & 255,
      kk = k & 255;
    const corner = (g: number, x: number, y: number, z: number): number => {
      let tt = 0.6 - x * x - y * y - z * z;
      if (tt < 0) return 0;
      const gr = GRAD3[g]!;
      tt *= tt;
      return tt * tt * (gr[0]! * x + gr[1]! * y + gr[2]! * z);
    };
    const n =
      corner(pm[ii + p[jj + p[kk]!]!]!, x0, y0, z0) +
      corner(pm[ii + i1 + p[jj + j1 + p[kk + k1]!]!]!, x1, y1, z1) +
      corner(pm[ii + i2 + p[jj + j2 + p[kk + k2]!]!]!, x2, y2, z2) +
      corner(pm[ii + 1 + p[jj + 1 + p[kk + 1]!]!]!, x3, y3, z3);
    return 32 * n;
  }
}
