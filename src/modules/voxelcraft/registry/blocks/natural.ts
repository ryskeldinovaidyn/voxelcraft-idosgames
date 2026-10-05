// Природные блоки (сейв v3): лава, обсидиан. Руды, породы и растения этапа выживания дописываются
// сюда же.
import type { BlockDef } from "../../types";
import { all, block } from "./define";

export const NATURAL_BLOCKS: BlockDef[] = [
  block({
    name: "lava",
    solid: false,
    opaque: false,
    liquid: true,
    hardness: Infinity,
    resistance: 100,
    light: 15,
    filter: 2,
    drops: [],
    replaceable: true,
    noItem: true,
    tex: all("lava"),
    mapColor: 0xe8661c,
  }),
  // Огонь: светит, горит на горючем и распространяется по нему (world/behaviours/fire.ts).
  block({
    name: "fire",
    shape: "fire",
    solid: false,
    opaque: false,
    hardness: 0,
    light: 15,
    drops: [],
    replaceable: true,
    noItem: true,
    tex: { side: "fire" },
    mapColor: 0xf5a023,
  }),
  block({
    name: "obsidian",
    hardness: 50,
    resistance: 1200,
    tool: "pickaxe",
    harvest: 4, // только алмазной киркой
    tex: all("obsidian"),
    mapColor: 0x1a1024,
  }),
];
