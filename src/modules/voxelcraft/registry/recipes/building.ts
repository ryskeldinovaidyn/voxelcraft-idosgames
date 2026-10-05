// Рецепты строительных блоков с формами — те же, что в Minecraft.
import type { Recipe } from "../../types";

const r = (
  pattern: (string | null)[][],
  item: string,
  count: number,
): Recipe => ({ pattern, result: { item, count } });

const P = "planks";
const C = "cobblestone";

export const BUILDING_RECIPES: Recipe[] = [
  r([["#coals"], ["stick"]], "torch", 4),
  r(
    [
      ["stick", null, "stick"],
      ["stick", "stick", "stick"],
      ["stick", null, "stick"],
    ],
    "ladder",
    3,
  ),
  r(
    [
      [P, P],
      [P, P],
      [P, P],
    ],
    "oak_door",
    3,
  ),
  r(
    [
      [P, P, P],
      [P, P, P],
    ],
    "oak_trapdoor",
    2,
  ),
  r(
    [
      [P, "stick", P],
      [P, "stick", P],
    ],
    "oak_fence",
    3,
  ),
  r(
    [
      ["stick", P, "stick"],
      ["stick", P, "stick"],
    ],
    "oak_fence_gate",
    1,
  ),
  r([[P, P, P]], "oak_slab", 6),
  r(
    [
      [P, null, null],
      [P, P, null],
      [P, P, P],
    ],
    "oak_stairs",
    4,
  ),
  r([[C, C, C]], "cobblestone_slab", 6),
  r(
    [
      [C, null, null],
      [C, C, null],
      [C, C, C],
    ],
    "cobblestone_stairs",
    4,
  ),
  r(
    [
      [C, C, C],
      [C, C, C],
    ],
    "cobblestone_wall",
    6,
  ),
  r([["stone", "stone", "stone"]], "stone_slab", 6),
  r(
    [
      ["glass", "glass", "glass"],
      ["glass", "glass", "glass"],
    ],
    "glass_pane",
    16,
  ),
  r(
    [
      ["#stone_crafting", "#stone_crafting", "#stone_crafting"],
      ["#stone_crafting", null, "#stone_crafting"],
      ["#stone_crafting", "#stone_crafting", "#stone_crafting"],
    ],
    "furnace",
    1,
  ),
  r(
    [
      ["#planks", "#planks", "#planks"],
      ["#planks", null, "#planks"],
      ["#planks", "#planks", "#planks"],
    ],
    "chest",
    1,
  ),
];
