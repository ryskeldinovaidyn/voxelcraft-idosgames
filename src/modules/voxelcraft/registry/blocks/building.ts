// Строительные блоки с формами (сейв v3): факел, лестница, дверь, люк, забор, калитка, плиты,
// ступени, стена, стеклянная панель. Семейства по породам дерева и видам камня дописываются
// таблицами в своих частях.
import type { BlockDef } from "../../types";
import { all, block } from "./define";

const WOOD = {
  hardness: 2,
  resistance: 3,
  tool: "axe",
  flammable: true,
  mapColor: 0xa4824c,
} as const;
const COBBLE = {
  hardness: 2,
  resistance: 6,
  tool: "pickaxe",
  harvest: 1,
  tex: all("cobblestone"),
  mapColor: 0x828282,
} as const;

export const BUILDING_BLOCKS: BlockDef[] = [
  block({
    name: "torch",
    shape: "torch",
    solid: false,
    hardness: 0,
    light: 14,
    tex: all("torch"),
    mapColor: 0xffd35a,
  }),
  block({
    name: "ladder",
    shape: "ladder",
    hardness: 0.4,
    tool: "axe",
    flammable: true,
    tex: all("ladder"),
    mapColor: 0x9a7442,
  }),
  block({
    name: "oak_door",
    shape: "door",
    ...WOOD,
    hardness: 3,
    tex: {
      side: "oak_door_bottom",
      upper: "oak_door_top",
      icon: "oak_door_item",
    },
  }),
  block({
    name: "oak_trapdoor",
    shape: "trapdoor",
    ...WOOD,
    hardness: 3,
    tex: all("oak_trapdoor"),
  }),
  block({ name: "oak_fence", shape: "fence", ...WOOD, tex: all("planks") }),
  block({
    name: "oak_fence_gate",
    shape: "fence_gate",
    ...WOOD,
    tex: all("planks"),
  }),
  block({ name: "oak_slab", shape: "slab", ...WOOD, tex: all("planks") }),
  block({ name: "oak_stairs", shape: "stairs", ...WOOD, tex: all("planks") }),
  block({ name: "cobblestone_slab", shape: "slab", ...COBBLE }),
  block({ name: "cobblestone_stairs", shape: "stairs", ...COBBLE }),
  block({ name: "cobblestone_wall", shape: "wall", ...COBBLE }),
  block({
    name: "stone_slab",
    shape: "slab",
    hardness: 2,
    resistance: 6,
    tool: "pickaxe",
    harvest: 1,
    tex: all("stone"),
    mapColor: 0x7d7d7d,
  }),
  block({
    name: "glass_pane",
    shape: "pane",
    hardness: 0.3,
    drops: [],
    tex: all("glass"),
    mapColor: 0xcfe8f0,
  }),
];
