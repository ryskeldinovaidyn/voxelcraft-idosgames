// Синонимы имён: Minecraft-имена (их знают игроки и ИИ-модели) → id этой игры. Нужны командам
// (/give grass_block) и разбору чужих данных. Названия в интерфейсе — отдельно, в names.ts.
import { B } from "./Blocks";
import { ITEMS } from "./Items";

export const ALIASES: Record<string, string> = {
  grass_block: "grass",
  short_grass: "tallgrass",
  tall_grass: "tallgrass",
  dandelion: "flower_yellow",
  poppy: "flower_red",
  oak_planks: "planks",
  oak_leaves: "leaves",
  dark_oak_planks: "dark_planks",
  snow_block: "snow",
  stone_brick: "stone_bricks",
  brick_block: "bricks",
  wall_torch: "torch",
  // Minecraft-имена, которым здесь дано своё название
  netherite_ingot: "infernite_ingot",
  netherite_scrap: "infernite_scrap",
  netherite_pickaxe: "infernite_pickaxe",
  netherite_axe: "infernite_axe",
  netherite_shovel: "infernite_shovel",
  netherite_hoe: "infernite_hoe",
  // Пекло
  netherrack: "infernal_stone",
  nether_portal: "inferno_portal",
  nether_quartz_ore: "quartz_ore",
  nether_bricks: "inferno_bricks",
  nether_brick_fence: "inferno_brick_fence",
  nether_brick_stairs: "inferno_brick_stairs",
  nether_brick: "inferno_brick",
  // Предел
  end_portal_frame: "rim_frame",
  end_portal: "beyond_portal",
  end_stone: "beyond_stone",
  ender_eye: "rim_eye",
  eye_of_ender: "rim_eye",
  blaze_rod: "flame_rod",
  blaze_powder: "flame_powder",
  ghast_tear: "wailer_tear",
  nether_wart: "inferno_wart",
  netherite_block: "infernite_block",
  reeds: "sugar_cane",
  nether_wart_block: "inferno_wart_block",
  glistering_melon_slice: "glistering_melon",
  netherite_sword: "infernite_sword",
  netherite_helmet: "infernite_helmet",
  netherite_chestplate: "infernite_chestplate",
  netherite_leggings: "infernite_leggings",
  netherite_boots: "infernite_boots",
  // иссушитель и его добыча
  wither_skeleton_skull: "ash_skull",
  nether_star: "inferno_star",
  wither_skeleton: "ash_skeleton",
  wither: "ash_lord",
  // океан
  prismarine: "sea_stone",
  prismarine_bricks: "sea_bricks",
  dark_prismarine: "dark_sea_stone",
  prismarine_shard: "sea_shard",
  prismarine_crystals: "sea_crystals",
  turtle_scute: "scute",
  guardian: "deepling",
  elder_guardian: "elder_deepling",
  // разбойники
  pillager: "marauder",
  vindicator: "axeman",
  evoker: "conjurer",
  vex: "wisp",
  endermite: "rim_mite",
  ravager: "crusher",
  totem_of_undying: "life_totem",
  // мобы, которым здесь дано своё имя: /summon creeper раньше отвечал «нет такого существа»
  creeper: "bomber",
  enderman: "stalker",
  ghast: "wailer",
  blaze: "flamer",
  piglin: "hogman",
  piglin_brute: "hogman_brute",
  zombified_piglin: "hogman_dead",
  ender_dragon: "void_dragon",
  end_crystal: "beyond_crystal",
  shulker: "shellkeeper",
  // сырая крольчатина в Minecraft — просто rabbit (здесь так зовут самого кролика)
  rabbit: "raw_rabbit",
};

/** Имя без префикса `minecraft:` и в нижнем регистре. */
const clean = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/^minecraft:/, "");

/** id предмета по имени или синониму; null — такого нет. */
export function resolveItem(name: string): string | null {
  const n = clean(name);
  if (ITEMS[n]) return n;
  const a = ALIASES[n];
  return a && ITEMS[a] ? a : null;
}

/** id блока по имени или синониму; null — такого нет. */
export function resolveBlock(name: string): number | null {
  const n = clean(name);
  return B[n] ?? B[ALIASES[n] ?? ""] ?? null;
}
