// Камнерез, как в Minecraft: один блок камня → одно изделие (плиты — по две) без верстака и без потерь.
// Экран — ui/InventoryUI (вид "stonecutter"). Изделия, которых нет в реестре, пропускаются. Чистые функции.
import { ITEMS } from "../registry/Items";
import type { ItemStack } from "../types";

/** Что можно вырезать из блока: [изделие, сколько]. */
export const STONECUTTING: Record<string, readonly [string, number][]> = {
  stone: [
    ["stone_slab", 2],
    ["stone_stairs", 1],
    ["stone_bricks", 1],
    ["stone_brick_slab", 2],
    ["stone_brick_stairs", 1],
  ],
  cobblestone: [
    ["cobblestone_slab", 2],
    ["cobblestone_stairs", 1],
    ["cobblestone_wall", 1],
  ],
  stone_bricks: [
    ["stone_brick_slab", 2],
    ["stone_brick_stairs", 1],
  ],
  blackstone: [
    ["blackstone_slab", 2],
    ["blackstone_stairs", 1],
    ["blackstone_wall", 1],
    ["polished_blackstone", 1],
    ["polished_blackstone_bricks", 1],
  ],
  polished_blackstone: [["polished_blackstone_bricks", 1]],
  basalt: [["polished_basalt", 1]],
  inferno_bricks: [["inferno_brick_stairs", 1]],
  copper_block: [["cut_copper", 4]],
  granite: [["polished_granite", 1]],
  diorite: [["polished_diorite", 1]],
  andesite: [["polished_andesite", 1]],
  deepslate: [
    ["polished_deepslate", 1],
    ["deepslate_bricks", 1],
    ["deepslate_tiles", 1],
  ],
  cobbled_deepslate: [
    ["polished_deepslate", 1],
    ["deepslate_bricks", 1],
    ["deepslate_tiles", 1],
  ],
  tuff: [
    ["polished_tuff", 1],
    ["tuff_bricks", 1],
  ],
  sandstone: [["cut_sandstone", 1]],
};

/** Варианты для входа (только существующие изделия); пусто — камнерез этот блок не берёт. */
export function stonecutOptions(input: string): ItemStack[] {
  return (STONECUTTING[input] ?? [])
    .filter(([item]) => ITEMS[item])
    .map(([item, count]) => ({ item, count }));
}
