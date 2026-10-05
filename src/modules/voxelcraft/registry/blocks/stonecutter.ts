// Камнерез: ПКМ — экран «блок → изделие» (systems/Stonecutter, ui/InventoryUI). Железо над тремя камнями.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { block } from "./define";

export const STONECUTTER_BLOCKS: BlockDef[] = [
  block({
    name: "stonecutter",
    hardness: 3.5,
    tool: "pickaxe",
    harvest: 1,
    tex: {
      top: "stonecutter_top",
      bottom: "stonecutter_side",
      side: "stonecutter_side",
    },
    mapColor: 0x7a7a7a,
  }),
];

addNames({ stonecutter: "Камнерез" });
