// Рецепты инструментов, брони, блоков хранения и самородков — как в Minecraft.
import type { Recipe } from "../../types";

const r = (pattern: (string | null)[][], item: string, count = 1): Recipe => ({
  pattern,
  result: { item, count },
});

/** Материал головы инструмента по уровню (деревянные — любые доски, каменные — любой булыжник). */
const HEAD: Record<string, string> = {
  wooden: "#planks",
  stone: "#stone_crafting",
  iron: "iron_ingot",
  golden: "gold_ingot",
  diamond: "diamond",
};

const S = "stick";
const _ = null;

const TOOL_PATTERNS: Record<string, (m: string) => (string | null)[][]> = {
  pickaxe: (m) => [
    [m, m, m],
    [_, S, _],
    [_, S, _],
  ],
  axe: (m) => [
    [m, m],
    [m, S],
    [_, S],
  ],
  shovel: (m) => [[m], [S], [S]],
  hoe: (m) => [
    [m, m],
    [_, S],
    [_, S],
  ],
  sword: (m) => [[m], [m], [S]],
};

const ARMOR_PATTERNS: Record<string, (m: string) => (string | null)[][]> = {
  helmet: (m) => [
    [m, m, m],
    [m, _, m],
  ],
  chestplate: (m) => [
    [m, _, m],
    [m, m, m],
    [m, m, m],
  ],
  leggings: (m) => [
    [m, m, m],
    [m, _, m],
    [m, _, m],
  ],
  boots: (m) => [
    [m, _, m],
    [m, _, m],
  ],
};

export const TOOL_RECIPES: Recipe[] = [];

for (const [mat, head] of Object.entries(HEAD))
  for (const [type, pattern] of Object.entries(TOOL_PATTERNS)) {
    // деревянные кирка, топор и меч — в basic.ts
    if (
      mat === "wooden" &&
      (type === "pickaxe" || type === "axe" || type === "sword")
    )
      continue;
    TOOL_RECIPES.push(r(pattern(head), `${mat}_${type}`));
  }

// броня: железная, золотая, алмазная (кожаная — из кожи мобов; кольчуга не крафтится, как в Minecraft)
for (const [mat, m] of [
  ["iron", "iron_ingot"],
  ["golden", "gold_ingot"],
  ["diamond", "diamond"],
] as const)
  for (const [piece, pattern] of Object.entries(ARMOR_PATTERNS))
    TOOL_RECIPES.push(r(pattern(m), `${mat}_${piece}`));

// девять в блок и обратно
const NINE = (m: string): (string | null)[][] => [
  [m, m, m],
  [m, m, m],
  [m, m, m],
];
for (const [unit, blockName] of [
  ["coal", "coal_block"],
  ["iron_ingot", "iron_block"],
  ["copper_ingot", "copper_block"],
  ["gold_ingot", "gold_block"],
  ["redstone", "redstone_block"],
  ["lapis_lazuli", "lapis_block"],
  ["diamond", "diamond_block"],
  ["emerald", "emerald_block"],
  ["iron_nugget", "iron_ingot"],
  ["gold_nugget", "gold_ingot"],
  ["infernite_ingot", "infernite_block"],
] as const) {
  TOOL_RECIPES.push(r(NINE(unit), blockName));
  TOOL_RECIPES.push({
    shapeless: [blockName],
    result: { item: unit, count: 9 },
  });
}

TOOL_RECIPES.push(
  r(
    [
      ["brick", "brick"],
      ["brick", "brick"],
    ],
    "bricks",
  ),
  r(
    [
      ["clay_ball", "clay_ball"],
      ["clay_ball", "clay_ball"],
    ],
    "clay",
  ),
);
