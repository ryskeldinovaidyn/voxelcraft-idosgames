// Руды, глубинный сланец и блоки хранения (сейв v3). Уровни добычи и дроп — как в Minecraft:
// медь и лазурит — каменной киркой, золото, алмаз, изумруд и красная пыль — железной.
import type { BlockDef, BlockDrop } from "../../types";
import { all, block } from "./define";

const ore = (
  name: string,
  harvest: number,
  drops: BlockDrop[],
  mapColor: number,
): BlockDef =>
  block({
    name,
    hardness: 3,
    resistance: 3,
    tool: "pickaxe",
    harvest,
    drops,
    tex: all(name),
    mapColor,
  });

const storage = (
  name: string,
  harvest: number,
  mapColor: number,
  hardness = 5,
): BlockDef =>
  block({
    name,
    hardness,
    resistance: 6,
    tool: "pickaxe",
    harvest,
    tex: all(name),
    mapColor,
  });

export const ORE_BLOCKS: BlockDef[] = [
  ore("copper_ore", 2, [{ item: "raw_copper", n: 2, max: 5 }], 0x9a7458),
  ore("gold_ore", 3, [{ item: "raw_gold", n: 1 }], 0x9a8a5a),
  ore("redstone_ore", 3, [{ item: "redstone", n: 4, max: 5 }], 0x8a5a5a),
  ore("lapis_ore", 2, [{ item: "lapis_lazuli", n: 4, max: 9 }], 0x5a6a8a),
  ore("diamond_ore", 3, [{ item: "diamond", n: 1 }], 0x6a9a9a),
  ore("emerald_ore", 3, [{ item: "emerald", n: 1 }], 0x6a9a74),
  block({
    name: "deepslate",
    hardness: 3,
    resistance: 6,
    tool: "pickaxe",
    harvest: 1,
    drops: [{ item: "cobbled_deepslate", n: 1 }],
    tex: all("deepslate"),
    mapColor: 0x4d4d52,
  }),
  block({
    name: "cobbled_deepslate",
    hardness: 3.5,
    resistance: 6,
    tool: "pickaxe",
    harvest: 1,
    tex: all("cobbled_deepslate"),
    mapColor: 0x454548,
  }),
  storage("coal_block", 1, 0x1c1c1c),
  storage("iron_block", 2, 0xd8d8d8),
  storage("copper_block", 2, 0xc06a3e, 3),
  storage("gold_block", 3, 0xf2c93c, 3),
  storage("redstone_block", 1, 0xb01818),
  storage("lapis_block", 2, 0x2848a8, 3),
  storage("diamond_block", 3, 0x5ee8dc),
  storage("emerald_block", 3, 0x2fcf5a),
];
