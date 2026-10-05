// Общие инструменты рисования тайлов атласа (16×16): оттенки, шум, рудные вкрапления, пиксель-арт по
// строковым шаблонам — и общий реестр painter-функций. Отдельный модуль, чтобы части с тайлами
// (gfx/painters/*) не импортировали TextureAtlas: иначе цикл при инициализации модулей.
//
// ⚠ Функции перенесены из TextureAtlas без изменений: у каждого тайла свой сид PRNG, и любая правка
// порядка случайных чисел перерисовала бы старые тайлы.

export const TILE = 16; // пикселей в тайле

/** Закрашивает один пиксель тайла. */
export type PxFn = (x: number, y: number, color: string) => void;
/** Сидированный PRNG. */
export type RngFn = () => number;
/** painter-функция: рисует один тайл 16×16. */
export type Painter = (px: PxFn, rng: RngFn) => void;

/** Реестр: имя тайла → painter. Заполняют TextureAtlas (исходные тайлы) и gfx/painters/*. */
export const PAINTERS: Record<string, Painter> = {};

/** Смешивание hex-цвета с чёрным/белым: amt в [-1..1]. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/** База: заливка цветом + пиксельный шум яркости. */
export function noisy(
  px: PxFn,
  base: string,
  variance: number,
  rng: RngFn,
): void {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      px(x, y, shade(base, (rng() - 0.5) * 2 * variance));
}

/** Рудные вкрапления поверх породы. */
export function oreBlobs(px: PxFn, rng: RngFn, color: string): void {
  for (let i = 0; i < 5; i++) {
    const cx = (2 + rng() * 12) | 0,
      cy = (2 + rng() * 12) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (Math.abs(dx) + Math.abs(dy) < 2 || rng() < 0.4)
          px((cx + dx) & 15, (cy + dy) & 15, shade(color, (rng() - 0.5) * 0.2));
  }
}

// ---- пиксель-арт по строковым шаблонам (растения, предметы, инструменты) -----
// Каждая строка — 16 символов; '.' = прозрачно, буквы — цвета из палитры (hex).

export function patternPainter(
  rows: string[],
  palette: Record<string, string>,
): Painter {
  return (px, rng) => {
    for (let y = 0; y < TILE; y++) {
      const row = rows[y] || "";
      for (let x = 0; x < TILE; x++) {
        const ch = row[x];
        if (!ch || ch === ".") continue;
        px(x, y, shade(palette[ch]!, (rng() - 0.5) * 0.1));
      }
    }
  };
}

export const P = patternPainter;
