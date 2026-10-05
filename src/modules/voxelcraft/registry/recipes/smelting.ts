// Плавка в печи — как в Minecraft: что во что превращается и сколько опыта даёт.
export interface SmeltRecipe {
  result: string;
  count: number;
  xp: number;
}

const s = (result: string, xp: number, count = 1): SmeltRecipe => ({
  result,
  count,
  xp,
});

export const SMELTING: Record<string, SmeltRecipe> = {
  raw_iron: s("iron_ingot", 0.7),
  raw_gold: s("gold_ingot", 1),
  raw_copper: s("copper_ingot", 0.7),
  iron_ore: s("iron_ingot", 0.7),
  gold_ore: s("gold_ingot", 1),
  copper_ore: s("copper_ingot", 0.7),
  diamond_ore: s("diamond", 1),
  emerald_ore: s("emerald", 1),
  lapis_ore: s("lapis_lazuli", 0.2),
  redstone_ore: s("redstone", 0.7),
  coal_ore: s("coal", 0.1),
  cobblestone: s("stone", 0.1),
  cobbled_deepslate: s("deepslate", 0.1),
  sand: s("glass", 0.1),
  red_sand: s("glass", 0.1),
  echo_fruit: s("popped_echo_fruit", 0.1),
  wet_sponge: s("sponge", 0.15),
  kelp: s("dried_kelp", 0.1),
  clay_ball: s("brick", 0.3),
  clay: s("terracotta", 0.35),
  oak_log: s("charcoal", 0.15),
  spruce_log: s("charcoal", 0.15),
  birch_log: s("charcoal", 0.15),
  jungle_log: s("charcoal", 0.15),
  acacia_log: s("charcoal", 0.15),
  dark_oak_log: s("charcoal", 0.15),
  cactus: s("green_dye", 1),
  raw_chicken: s("cooked_chicken", 0.35),
  beef: s("cooked_beef", 0.35),
  porkchop: s("cooked_porkchop", 0.35),
  mutton: s("cooked_mutton", 0.35),
  potato: s("baked_potato", 0.35),
  cod: s("cooked_cod", 0.35),
  raw_rabbit: s("cooked_rabbit", 0.35),
  salmon: s("cooked_salmon", 0.35),
  infernal_stone: s("inferno_brick", 0.1),
  quartz_ore: s("quartz", 0.2),
  ancient_debris: s("infernite_scrap", 2),
};

/** Во что плавится предмет; null — не плавится. */
export function smeltResult(item: string): SmeltRecipe | null {
  return SMELTING[item] ?? null;
}
