// Стол картографа — рабочее место картографа в деревне (у него карты-исследователи к особняку и
// подводному храму — systems/Trading.ts).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { block } from "./define";

export const MANSION_BLOCKS: BlockDef[] = [
  block({
    name: "cartography_table",
    hardness: 2.5,
    tool: "axe",
    flammable: true,
    tex: {
      top: "cartography_table_top",
      side: "cartography_table_side",
      bottom: "planks",
    },
    mapColor: 0x6a4a2a,
  }),
];

addNames({ cartography_table: "Стол картографа" });
