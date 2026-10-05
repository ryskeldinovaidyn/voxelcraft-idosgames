// Базальтовые дельты и долина душ: базальт (столбы), чернокамень, костяной блок (окаменелости) и огонь
// душ — синий, горит только на песке и почве душ (world/behaviours/fire).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

const STONE = {
  hardness: 1.25,
  resistance: 4.2,
  tool: "pickaxe",
  harvest: 1,
} as const;

export const BASALT_BLOCKS: BlockDef[] = [
  block({
    name: "basalt",
    ...STONE,
    tex: { top: "basalt_top", side: "basalt_side" },
    mapColor: 0x4a4a52,
  }),
  block({
    name: "blackstone",
    ...STONE,
    hardness: 1.5,
    tex: all("blackstone"),
    mapColor: 0x2a2428,
  }),
  block({
    name: "bone_block",
    ...STONE,
    hardness: 2,
    tex: { top: "bone_block_top", side: "bone_block_side" },
    mapColor: 0xe0dcc8,
  }),
  block({
    name: "soul_fire",
    shape: "fire",
    solid: false,
    opaque: false,
    hardness: 0,
    light: 10,
    drops: [],
    replaceable: true,
    noItem: true,
    tex: { side: "soul_fire" },
    mapColor: 0x40c8e0,
  }),
];

addNames({
  basalt: "Базальт",
  blackstone: "Чернокамень",
  bone_block: "Костяной блок",
  soul_fire: "Огонь душ",
});
