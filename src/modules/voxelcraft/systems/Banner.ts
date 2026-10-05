// Знамёна, как в Minecraft: полотно основного цвета плюс до шести слоёв узора. Узор кладут на
// ткацком станке (экран — ui/InventoryUI, вид "loom"): знамя + краситель + выбранный узор.
// Слои живут в tag.banner стака строкой "cross:red,border:black" — так они переживают сейв и
// возвращаются в блочную сущность при установке (world/blockentities/banner).
// Здесь только чистые функции: рисование — gfx/BannerArt, экран — ui/InventoryUI.
import { DYE_COLORS } from "../registry/blocks/colors";
import type { ItemStack } from "../types";

/** Сколько слоёв узора помещается на знамени (как в Minecraft). */
export const MAX_LAYERS = 6;

export interface BannerLayer {
  pattern: string;
  color: string;
}

export interface BannerPattern {
  id: string;
  name: string;
}

/** Узоры ткацкого станка. Рисует их gfx/BannerArt — список и порядок общие. */
export const BANNER_PATTERNS: readonly BannerPattern[] = [
  { id: "top", name: "Верхнее поле" },
  { id: "bottom", name: "Нижнее поле" },
  { id: "pale", name: "Столб" },
  { id: "fess", name: "Пояс" },
  { id: "cross", name: "Крест" },
  { id: "saltire", name: "Косой крест" },
  { id: "border", name: "Кайма" },
  { id: "bend", name: "Перевязь" },
  { id: "lozenge", name: "Ромб" },
  { id: "roundel", name: "Круг" },
];

const PATTERN_IDS = new Set(BANNER_PATTERNS.map((p) => p.id));
const COLOR_IDS = new Set(DYE_COLORS.map((c) => c.id));

/** Имя узора для подписи; неизвестный — как есть. */
export const patternName = (id: string): string =>
  BANNER_PATTERNS.find((p) => p.id === id)?.name ?? id;

/** Цвет знамени по имени блока или предмета: "red_banner" → "red"; не знамя — null. */
export function bannerColor(item: string): string | null {
  const c = item.endsWith("_banner") ? item.slice(0, -7) : null;
  return c && COLOR_IDS.has(c) ? c : null;
}

/** Цвет красителя: "red_dye" → "red"; не краситель — null. */
export function dyeColor(item: string): string | null {
  const c = item.endsWith("_dye") ? item.slice(0, -4) : null;
  return c && COLOR_IDS.has(c) ? c : null;
}

/** Слои из строки tag.banner; мусор и неизвестные узоры отбрасываются. */
export function decodeLayers(tag: unknown): BannerLayer[] {
  if (typeof tag !== "string" || !tag) return [];
  const out: BannerLayer[] = [];
  for (const part of tag.split(",")) {
    const [pattern, color] = part.split(":");
    if (pattern && color && PATTERN_IDS.has(pattern) && COLOR_IDS.has(color))
      out.push({ pattern, color });
    if (out.length >= MAX_LAYERS) break;
  }
  return out;
}

/** Строка для tag.banner. */
export const encodeLayers = (layers: readonly BannerLayer[]): string =>
  layers.map((l) => `${l.pattern}:${l.color}`).join(",");

/** Слои знамени-стака. */
export const layersOf = (s: ItemStack | null): BannerLayer[] =>
  decodeLayers(s?.tag?.banner);

/**
 * Результат станка: одно такое же знамя с добавленным слоем. null — сделать нечего:
 * не знамя, не краситель или слоёв уже шесть.
 */
export function loomResult(
  banner: ItemStack | null,
  dye: ItemStack | null,
  pattern: string,
): ItemStack | null {
  if (!banner || !dye) return null;
  if (!bannerColor(banner.item) || !PATTERN_IDS.has(pattern)) return null;
  const color = dyeColor(dye.item);
  if (!color) return null;
  const layers = layersOf(banner);
  if (layers.length >= MAX_LAYERS) return null;
  const tag = { ...(banner.tag ?? {}) };
  tag.banner = encodeLayers([...layers, { pattern, color }]);
  return { ...banner, count: 1, tag };
}

/** Подпись знамени: «Красное знамя, крест (белый)» — для подсказки в экране. */
export function bannerSummary(layers: readonly BannerLayer[]): string {
  return layers
    .map((l) => {
      const adj = DYE_COLORS.find((c) => c.id === l.color)?.adj[0] ?? l.color;
      return `${patternName(l.pattern).toLowerCase()} (${adj.toLowerCase()})`;
    })
    .join(", ");
}
