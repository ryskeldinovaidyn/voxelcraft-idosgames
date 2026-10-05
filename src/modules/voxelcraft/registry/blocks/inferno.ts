// Пекло (сейв v3): блок портала, адский камень, песок душ, светокамень, кварцевая руда, магма,
// адский кирпич. Генератор — worldgen/inferno; рамка и переход — world/Portal.ts.
import type { BlockDef } from "../../types";
import { all, block } from "./define";

const BRICK = {
  hardness: 2,
  resistance: 6,
  tool: "pickaxe",
  harvest: 1,
  tex: all("inferno_bricks"),
  mapColor: 0x2c1418,
} as const;

export const INFERNO_BLOCKS: BlockDef[] = [
  // портал: не ломается сам — гаснет, когда ломают рамку (world/Support.ts); светит 11
  block({
    name: "inferno_portal",
    shape: "portal",
    solid: false,
    opaque: false,
    hardness: Infinity,
    resistance: 0,
    light: 11,
    filter: 0,
    drops: [],
    noItem: true,
    tex: all("inferno_portal"),
    mapColor: 0x7a2ae0,
  }),
  block({
    name: "infernal_stone",
    hardness: 0.4,
    resistance: 0.4,
    tool: "pickaxe",
    harvest: 1,
    tex: all("infernal_stone"),
    mapColor: 0x6e2a2a,
  }),
  block({
    name: "soul_sand",
    hardness: 0.5,
    tool: "shovel",
    tex: all("soul_sand"),
    mapColor: 0x4e3a2c,
  }),
  block({
    name: "glowstone",
    hardness: 0.3,
    light: 15,
    drops: [{ item: "glowstone_dust", n: 2, max: 4 }],
    tex: all("glowstone"),
    mapColor: 0xe8c878,
  }),
  block({
    name: "quartz_ore",
    hardness: 3,
    tool: "pickaxe",
    harvest: 1,
    drops: [{ item: "quartz", n: 1 }],
    tex: all("quartz_ore"),
    mapColor: 0x8a5a52,
  }),
  block({
    name: "magma_block",
    hardness: 0.5,
    tool: "pickaxe",
    harvest: 1,
    light: 3,
    tex: all("magma_block"),
    mapColor: 0x8a3a10,
  }),
  block({ name: "inferno_bricks", ...BRICK }),
  block({ name: "inferno_brick_fence", shape: "fence", ...BRICK }),
  block({ name: "inferno_brick_stairs", shape: "stairs", ...BRICK }),
  // пеклит: обломки — только алмазной киркой, в лаве не горят (entities/ItemDrop)
  block({
    name: "ancient_debris",
    hardness: 30,
    resistance: 1200,
    tool: "pickaxe",
    harvest: 4,
    tex: { top: "ancient_debris_top", side: "ancient_debris_side" },
    mapColor: 0x5a3a30,
  }),
  block({
    name: "infernite_block",
    hardness: 50,
    resistance: 1200,
    tool: "pickaxe",
    harvest: 4,
    tex: all("infernite_block"),
    mapColor: 0x4d4450,
  }),
  // кузнечный стол: алмазная вещь + пеклитовый слиток → пеклитовая (systems/Smithing.ts)
  block({
    name: "smithing_table",
    hardness: 2.5,
    tool: "axe",
    flammable: true,
    tex: {
      top: "smithing_table_top",
      side: "smithing_table_side",
      bottom: "planks",
    },
    mapColor: 0x3a3440,
  }),
];
