// Рисование знамён (systems/Banner): узор — маска на сетке 16×16, как тайл атласа. Одна таблица
// масок обслуживает три места: тайлы полотна (gfx/painters/banner), полотно узора в мире
// (gfx/Banners) и картинку варианта на ткацком станке (ui/InventoryUI).
import { DYE_COLORS } from "../registry/blocks/colors";
import type { BannerLayer } from "../systems/Banner";
import { TILE, shade, type PxFn } from "./paint";

/** Маска узора: попадает ли пиксель сетки 16×16 в фигуру. */
type Mask = (x: number, y: number) => boolean;

export const PATTERN_MASKS: Record<string, Mask> = {
  top: (_x, y) => y < 8,
  bottom: (_x, y) => y >= 8,
  pale: (x) => x >= 6 && x <= 9,
  fess: (_x, y) => y >= 6 && y <= 9,
  cross: (x, y) => (x >= 6 && x <= 9) || (y >= 6 && y <= 9),
  saltire: (x, y) => Math.abs(x - y) <= 1.5 || Math.abs(x + y - 15) <= 1.5,
  border: (x, y) => x < 2 || x > 13 || y < 2 || y > 13,
  bend: (x, y) => x > y,
  lozenge: (x, y) => Math.abs(x - 7.5) / 7.5 + Math.abs(y - 7.5) / 7.5 <= 1,
  roundel: (x, y) => Math.hypot(x - 7.5, y - 7.5) < 4.5,
};

const hexOf = (color: string): string =>
  DYE_COLORS.find((c) => c.id === color)?.hex ?? "#e9ecec";

/** Слои поверх полотна: узор за узором, поздний закрывает ранний. */
export function paintLayers(px: PxFn, layers: readonly BannerLayer[]): void {
  for (const l of layers) {
    const mask = PATTERN_MASKS[l.pattern];
    if (!mask) continue;
    const hex = hexOf(l.color);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        if (mask(x, y)) px(x, y, shade(hex, (x + y) % 4 === 0 ? -0.07 : 0));
  }
}

/** Полотно знамени: складки ткани основного цвета. */
export function paintCloth(px: PxFn, hex: string): void {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      px(
        x,
        y,
        shade(
          hex,
          ((x + y) % 4 === 0 ? -0.07 : 0) - (x === 0 || x === 15 ? 0.18 : 0),
        ),
      );
  for (let x = 0; x < TILE; x++) px(x, 0, shade(hex, -0.35)); // перекладина сверху
}

/** Canvas со знаменем: полотно основного цвета (или прозрачное) плюс узоры. */
export function bannerCanvas(
  base: string | null,
  layers: readonly BannerLayer[],
  scale = 2,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = TILE * scale;
  const g = c.getContext("2d")!;
  const px: PxFn = (x, y, color) => {
    g.fillStyle = color;
    g.fillRect(x * scale, y * scale, scale, scale);
  };
  if (base) paintCloth(px, hexOf(base));
  paintLayers(px, layers);
  return c;
}
