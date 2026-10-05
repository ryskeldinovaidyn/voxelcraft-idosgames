// Рецепты оружия и снаряжения: стрелы, лук, ножницы, кожаная броня, шерсть из нити — как в Minecraft.
import type { Recipe } from "../../types";

const r = (pattern: (string | null)[][], item: string, count = 1): Recipe => ({
  pattern,
  result: { item, count },
});

const S = "stick";
const T = "string";
const L = "leather";
const I = "iron_ingot";
const _ = null;

const G = "gunpowder";
const SA = "#sand";

export const COMBAT_RECIPES: Recipe[] = [
  r(
    [
      [G, SA, G],
      [SA, G, SA],
      [G, SA, G],
    ],
    "tnt",
  ),
  r(
    [
      ["#wool", "#wool", "#wool"],
      ["#planks", "#planks", "#planks"],
    ],
    "red_bed",
  ),
  r(
    [
      [I, _, I],
      [_, I, _],
    ],
    "bucket",
  ),
  { shapeless: [I, "flint"], result: { item: "flint_and_steel", count: 1 } },
  r([["flint"], [S], ["feather"]], "arrow", 4),
  r(
    [
      [_, S, T],
      [S, _, T],
      [_, S, T],
    ],
    "bow",
  ),
  r(
    [
      [_, I],
      [I, _],
    ],
    "shears",
  ),
  r(
    [
      [T, T],
      [T, T],
    ],
    "white_wool",
  ),
  r(
    [
      [L, L, L],
      [L, _, L],
    ],
    "leather_helmet",
  ),
  r(
    [
      [L, _, L],
      [L, L, L],
      [L, L, L],
    ],
    "leather_chestplate",
  ),
  r(
    [
      [L, L, L],
      [L, _, L],
      [L, _, L],
    ],
    "leather_leggings",
  ),
  r(
    [
      [L, _, L],
      [L, _, L],
    ],
    "leather_boots",
  ),
];
