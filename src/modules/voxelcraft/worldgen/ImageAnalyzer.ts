// Разбор картинки БЕЗ ИИ, прямо в браузере. Два прочтения:
//
//  - «карта сверху»: картинка — вид на мир сверху. Синее — вода, остальное — суша; высота суши
//    растёт от берега вглубь и от яркости; цвет пикселя → ближайший по цвету блок поверхности.
//  - «настроение»: картинка задаёт только характер мира — доли воды/зелени/песка/снега и
//    доминирующие цвета (из них — биомы, форма и материалы построек).
//
// Здесь только чистые функции над RGBA-массивом: они тестируются без DOM. Загрузка файла и canvas —
// в loadImage.ts.
import { B, BLOCKS } from "../registry/Blocks";

export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** Блоки, которыми картинка может покрыть землю в режиме «карта сверху». */
export const IMAGE_LAND_PALETTE: readonly string[] = [
  "grass",
  "dirt",
  "stone",
  "sand",
  "red_sand",
  "gravel",
  "clay",
  "snow",
  "ice",
  "sandstone",
  "terracotta",
  "dirt_path",
  "planks",
  "dark_planks",
  "stone_bricks",
  "bricks",
  "white_wool",
  "red_wool",
  "orange_wool",
  "yellow_wool",
  "green_wool",
  "purple_wool",
  "pink_wool",
  "brown_wool",
  "gray_wool",
  "black_wool",
];

// ---- цвет -----------------------------------------------------------------------

type Lab = [number, number, number];

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** sRGB → CIE Lab (D65): расстояние в Lab ближе к тому, как цвета различает глаз. */
export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = srgbToLinear(r),
    G = srgbToLinear(g),
    Bl = srgbToLinear(b);
  const x = (R * 0.4124 + G * 0.3576 + Bl * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + Bl * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + Bl * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x),
    fy = f(y),
    fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** HSV: hue 0..360, s и v 0..1. */
export function rgbToHsv(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const R = r / 255,
    G = g / 255,
    Bl = b / 255;
  const max = Math.max(R, G, Bl),
    min = Math.min(R, G, Bl);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === R) h = ((G - Bl) / d) % 6;
    else if (max === G) h = (Bl - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

const labCache = new Map<string, Lab>();
function blockLab(name: string): Lab {
  let lab = labCache.get(name);
  if (!lab) {
    const c = BLOCKS[B[name]!]!.mapColor;
    lab = rgbToLab((c >> 16) & 255, (c >> 8) & 255, c & 255);
    labCache.set(name, lab);
  }
  return lab;
}

/** Индекс ближайшего по цвету блока палитры. */
export function nearestBlock(
  r: number,
  g: number,
  b: number,
  palette: readonly string[],
): number {
  const [L, A, Bv] = rgbToLab(r, g, b);
  let best = 0,
    bestD = Infinity;
  palette.forEach((name, i) => {
    const [l2, a2, b2] = blockLab(name);
    const d = (L - l2) ** 2 + (A - a2) ** 2 + (Bv - b2) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Похоже ли на воду: насыщенный голубой/синий. */
export function looksLikeWater(r: number, g: number, b: number): boolean {
  const [h, s, v] = rgbToHsv(r, g, b);
  return h >= 185 && h <= 250 && s > 0.25 && v > 0.15;
}

// ---- пересэмплирование ----------------------------------------------------------

/**
 * Картинка → сетка w×h усреднённых RGB с кадрированием «cover»: пропорции мира сохраняются,
 * лишнее по краям обрезается. На клетку — до 16 выборок (быстро даже для больших фото).
 */
export function resampleCover(
  img: RGBAImage,
  w: number,
  h: number,
): Float32Array {
  const out = new Float32Array(w * h * 3);
  const srcAspect = img.width / img.height,
    dstAspect = w / h;
  let cx0 = 0,
    cy0 = 0,
    cw = img.width,
    ch = img.height;
  if (srcAspect > dstAspect) {
    cw = img.height * dstAspect;
    cx0 = (img.width - cw) / 2;
  } else {
    ch = img.width / dstAspect;
    cy0 = (img.height - ch) / 2;
  }
  const cellW = cw / w,
    cellH = ch / h;
  const sx = Math.max(1, Math.min(4, Math.floor(cellW))),
    sy = Math.max(1, Math.min(4, Math.floor(cellH)));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let j = 0; j < sy; j++)
        for (let i = 0; i < sx; i++) {
          const px = Math.min(
            img.width - 1,
            Math.floor(cx0 + (x + (i + 0.5) / sx) * cellW),
          );
          const py = Math.min(
            img.height - 1,
            Math.floor(cy0 + (y + (j + 0.5) / sy) * cellH),
          );
          const k = (px + py * img.width) * 4;
          const a = img.data[k + 3]! / 255;
          // прозрачное — как белый фон
          r += img.data[k]! * a + 255 * (1 - a);
          g += img.data[k + 1]! * a + 255 * (1 - a);
          b += img.data[k + 2]! * a + 255 * (1 - a);
          n++;
        }
      const o = (x + y * w) * 3;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
    }
  return out;
}

// ---- «карта сверху» ------------------------------------------------------------------

export interface TopDownResult {
  w: number;
  h: number;
  /** 1 — вода. */
  water: Uint8Array;
  /** Высота суши 0..1 (у воды — 0). */
  elevation: Float32Array;
  /** Индекс блока поверхности в IMAGE_LAND_PALETTE (у воды — 0, не используется). */
  surface: Uint8Array;
  waterShare: number;
}

export function analyzeTopDown(
  img: RGBAImage,
  w: number,
  h: number,
): TopDownResult {
  const rgb = resampleCover(img, w, h);
  const n = w * h;
  const water = new Uint8Array(n);
  const lum = new Float32Array(n);
  const surface = new Uint8Array(n);
  let waterCount = 0;
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3]!,
      g = rgb[i * 3 + 1]!,
      b = rgb[i * 3 + 2]!;
    lum[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (looksLikeWater(r, g, b)) {
      water[i] = 1;
      waterCount++;
    } else surface[i] = nearestBlock(r, g, b, IMAGE_LAND_PALETTE);
  }

  // расстояние до воды (BFS по 8 соседям): суша поднимается от берега вглубь
  const dist = new Float32Array(n).fill(Infinity);
  const queue: number[] = [];
  for (let i = 0; i < n; i++)
    if (water[i]) {
      dist[i] = 0;
      queue.push(i);
    }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    const x = i % w,
      y = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = nx + ny * w;
        if (dist[j]! > dist[i]! + 1) {
          dist[j] = dist[i]! + 1;
          queue.push(j);
        }
      }
  }

  const waterShare = waterCount / n;
  const reach = Math.max(4, Math.max(w, h) / 5);
  let elevation = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (water[i]) continue;
    const d = waterShare > 0.02 ? Math.min(1, dist[i]! / reach) : 1;
    elevation[i] =
      waterShare > 0.02 ? 0.1 + 0.55 * d + 0.35 * lum[i]! : 0.1 + 0.9 * lum[i]!;
  }
  // сгладить сушу: шум пикселей не должен превращаться в частокол
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(n);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = x + y * w;
        if (water[i]) continue;
        let s = 0,
          c = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx,
              ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = nx + ny * w;
            if (water[j]) continue;
            s += elevation[j]!;
            c++;
          }
        next[i] = s / c;
      }
    elevation = next;
  }
  return { w, h, water, elevation, surface, waterShare };
}

// ---- «настроение» ------------------------------------------------------------------

export interface MoodResult {
  /** Доли клеток картинки по классам 0..1. */
  shares: {
    water: number;
    green: number;
    sand: number;
    snow: number;
    red: number;
    dark: number;
    gray: number;
  };
  /** Доминирующие цвета (k-means), по убыванию доли. */
  dominant: { r: number; g: number; b: number; share: number }[];
  luma: number;
}

export function analyzeMood(img: RGBAImage): MoodResult {
  const G = 48;
  const rgb = resampleCover(img, G, G);
  const n = G * G;
  const shares = {
    water: 0,
    green: 0,
    sand: 0,
    snow: 0,
    red: 0,
    dark: 0,
    gray: 0,
  };
  let luma = 0;
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3]!,
      g = rgb[i * 3 + 1]!,
      b = rgb[i * 3 + 2]!;
    const [hue, s, v] = rgbToHsv(r, g, b);
    luma += v;
    if (looksLikeWater(r, g, b)) shares.water++;
    else if (v < 0.2) shares.dark++;
    else if (s < 0.12 && v > 0.85) shares.snow++;
    else if (s < 0.15) shares.gray++;
    else if (hue >= 65 && hue <= 170 && s > 0.2) shares.green++;
    else if (hue >= 30 && hue < 65 && v > 0.5) shares.sand++;
    else if (hue < 30 || hue > 330) shares.red++;
  }
  for (const k of Object.keys(shares) as (keyof typeof shares)[])
    shares[k] /= n;

  // k-means на 5 цветов; старт — клетки, равномерно разнесённые по яркости (детерминированно)
  const K = 5;
  const order = [...Array(n).keys()].sort(
    (a, b) =>
      rgb[a * 3]! +
      rgb[a * 3 + 1]! +
      rgb[a * 3 + 2]! -
      (rgb[b * 3]! + rgb[b * 3 + 1]! + rgb[b * 3 + 2]!),
  );
  const cent = Array.from({ length: K }, (_, k) => {
    const i = order[Math.floor(((k + 0.5) / K) * n)]!;
    return [rgb[i * 3]!, rgb[i * 3 + 1]!, rgb[i * 3 + 2]!];
  });
  const assign = new Uint8Array(n);
  for (let iter = 0; iter < 8; iter++) {
    const sum = Array.from({ length: K }, () => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      let best = 0,
        bd = Infinity;
      for (let k = 0; k < K; k++) {
        const c = cent[k]!;
        const d =
          (rgb[i * 3]! - c[0]!) ** 2 +
          (rgb[i * 3 + 1]! - c[1]!) ** 2 +
          (rgb[i * 3 + 2]! - c[2]!) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      assign[i] = best;
      const s = sum[best]!;
      s[0]! += rgb[i * 3]!;
      s[1]! += rgb[i * 3 + 1]!;
      s[2]! += rgb[i * 3 + 2]!;
      s[3]! += 1;
    }
    sum.forEach((s, k) => {
      if (s[3]) cent[k] = [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!];
    });
  }
  const counts = new Array<number>(K).fill(0);
  for (let i = 0; i < n; i++) counts[assign[i]!]!++;
  const dominant = cent
    .map((c, k) => ({
      r: Math.round(c[0]!),
      g: Math.round(c[1]!),
      b: Math.round(c[2]!),
      share: counts[k]! / n,
    }))
    .filter((d) => d.share > 0)
    .sort((a, b) => b.share - a.share);

  return { shares, dominant, luma: luma / n };
}
