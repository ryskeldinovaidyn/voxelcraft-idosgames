// Фермерство (сейв v3): пашня, посевы (мета — стадия 0..7), сноп сена. Рост и увлажнение —
// world/behaviours/farming.ts; спелость решает дроп (systems/Mining.dropsOf: недозревший посев
// отдаёт только то, чем сажали).
import type { BlockDef, BlockDrop } from "../../types";
import { block } from "./define";

/** Посев: `seed` — предмет, которым сажают (и что выпадает до спелости), `ripe` — урожай. */
const crop = (
  name: string,
  seed: string,
  ripe: BlockDrop[],
  mapColor: number,
): BlockDef =>
  block({
    name,
    shape: "crop",
    solid: false,
    opaque: false,
    hardness: 0,
    noItem: true,
    item: seed,
    drops: ripe,
    tex: { side: name },
    mapColor,
  });

export const FARMING_BLOCKS: BlockDef[] = [
  // пашня: мета — влажность 0..7 (7 — мокрая, темнее); ломается в землю
  block({
    name: "farmland",
    shape: "farmland",
    opaque: false,
    hardness: 0.6,
    tool: "shovel",
    noItem: true,
    drops: [{ item: "dirt", n: 1 }],
    tex: { top: "farmland", side: "dirt", bottom: "dirt", on: "farmland_wet" },
    mapColor: 0x5a3b22,
  }),
  crop(
    "wheat",
    "wheat_seeds",
    [
      { item: "wheat", n: 1 },
      { item: "wheat_seeds", n: 1, max: 4 },
    ],
    0xc8a83a,
  ),
  crop("carrots", "carrot", [{ item: "carrot", n: 2, max: 5 }], 0xe8761c),
  crop("potatoes", "potato", [{ item: "potato", n: 2, max: 5 }], 0xb8943a),
  crop(
    "beetroots",
    "beetroot_seeds",
    [
      { item: "beetroot", n: 1 },
      { item: "beetroot_seeds", n: 1, max: 4 },
    ],
    0x9a1e3a,
  ),
  block({
    name: "hay_block",
    axis: true,
    hardness: 0.5,
    tool: "hoe",
    flammable: true,
    tex: { top: "hay_top", side: "hay_side" },
    mapColor: 0xc8a83a,
  }),
  // тростник: до 3 блоков, только на траве/земле/песке у воды (world/Support.ts)
  block({
    name: "sugar_cane",
    shape: "cross",
    cross: true,
    solid: false,
    opaque: false,
    hardness: 0,
    tex: { side: "sugar_cane" },
    mapColor: 0x8ac060,
  }),
  // кактус: до 3 блоков на песке, колет, ломается рядом с твёрдым блоком
  block({
    name: "cactus",
    shape: "cactus",
    opaque: false,
    hardness: 0.4,
    tex: { top: "cactus_top", side: "cactus_side", bottom: "cactus_top" },
    mapColor: 0x3a8a2a,
  }),
  block({
    name: "pumpkin",
    hardness: 1,
    tool: "axe",
    tex: { top: "pumpkin_top", side: "pumpkin_side" },
    mapColor: 0xe08a1a,
  }),
  block({
    name: "melon",
    hardness: 1,
    tool: "axe",
    drops: [{ item: "melon_slice", n: 3, max: 7 }],
    tex: { top: "melon_top", side: "melon_side" },
    mapColor: 0x7aa83a,
  }),
  // ростки: созрев, ставят плод на соседнюю землю (world/behaviours/farming.ts)
  crop(
    "pumpkin_stem",
    "pumpkin_seeds",
    [{ item: "pumpkin_seeds", n: 1, max: 3 }],
    0x8aa040,
  ),
  crop(
    "melon_stem",
    "melon_seeds",
    [{ item: "melon_seeds", n: 1, max: 3 }],
    0x8aa040,
  ),
  block({
    name: "bookshelf",
    hardness: 1.5,
    tool: "axe",
    flammable: true,
    drops: [{ item: "book", n: 3 }],
    tex: { top: "planks", side: "bookshelf", bottom: "planks" },
    mapColor: 0x8a6a3a,
  }),
];
