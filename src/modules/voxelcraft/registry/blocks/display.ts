// Рамка для предметов: вешается на стену (форма wall_mounted), ПКМ кладёт предмет — он висит перед
// рамкой и медленно крутится (gfx/DisplayItems), ПКМ ещё раз — забираешь.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

export const DISPLAY_BLOCKS: BlockDef[] = [
  block({
    name: "display_stand",
    shape: "wall_mounted",
    solid: false,
    opaque: false,
    hardness: 0.4,
    tool: "axe",
    flammable: true,
    blockEntity: "display",
    tex: all("display_stand"),
    mapColor: 0x8a6a3a,
  }),
];

addNames({ display_stand: "Рамка" });
