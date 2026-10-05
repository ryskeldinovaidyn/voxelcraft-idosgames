// Снежный слой (форма snow_layer): его оставляет за собой снеговик; лопатой — снежок.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

export const FROST_BLOCKS: BlockDef[] = [
  block({
    name: "snow_layer",
    shape: "snow_layer",
    solid: false,
    opaque: false,
    hardness: 0.1,
    tool: "shovel",
    drops: [{ item: "snowball", n: 1 }],
    tex: all("snow"),
    mapColor: 0xf2f6fa,
  }),
];

addNames({ snow_layer: "Снежный слой" });
