// Бартер свинорылов, как в Minecraft: золотой слиток → одно случайное из таблицы по весам. Строки с
// предметами, которых нет в реестре, пропускаются. Чистая функция.
import { ITEMS } from "../registry/Items";
import type { ItemStack } from "../types";

/** [предмет, вес, от, до] — веса и количества Minecraft 1.20 (без того, чего у нас нет). */
export const BARTER: readonly [string, number, number, number][] = [
  ["rim_pearl", 10, 2, 4],
  ["string", 20, 3, 9],
  ["quartz", 20, 5, 12],
  ["obsidian", 40, 1, 1],
  ["crying_obsidian", 40, 1, 3],
  ["fire_charge", 40, 1, 1],
  ["leather", 40, 2, 4],
  ["soul_sand", 40, 2, 8],
  ["gravel", 40, 8, 16],
  ["blackstone", 40, 8, 16],
  ["iron_nugget", 10, 10, 36],
  ["potion_fire_resistance", 8, 1, 1],
];

/** Бросок бартера. */
export function barterRoll(rng: () => number): ItemStack {
  const rows = BARTER.filter(([item]) => ITEMS[item]);
  let r = rng() * rows.reduce((s, [, w]) => s + w, 0);
  for (const [item, w, lo, hi] of rows) {
    r -= w;
    if (r < 0) return { item, count: lo + Math.floor(rng() * (hi - lo + 1)) };
  }
  const [item, , lo] = rows[rows.length - 1]!;
  return { item, count: lo };
}
