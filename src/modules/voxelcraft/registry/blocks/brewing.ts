// Варка (сейв v3): варочная стойка (блочная сущность «brewing») и адский нарост — растёт только
// на песке душ, при любом свете; грядки есть в адских крепостях.
import type { BlockDef } from "../../types";
import { block } from "./define";

export const BREWING_BLOCKS: BlockDef[] = [
  block({
    name: "brewing_stand",
    shape: "cross",
    solid: false,
    opaque: false,
    cross: true,
    hardness: 0.5,
    tool: "pickaxe",
    light: 1,
    blockEntity: "brewing",
    tex: { side: "brewing_stand" },
    mapColor: 0x8a7a5a,
  }),
  block({
    name: "inferno_wart",
    shape: "crop",
    solid: false,
    opaque: false,
    hardness: 0,
    noItem: true,
    item: "inferno_wart",
    drops: [{ item: "inferno_wart", n: 2, max: 4 }],
    tex: { side: "inferno_wart" },
    mapColor: 0x8a1a22,
  }),
];
