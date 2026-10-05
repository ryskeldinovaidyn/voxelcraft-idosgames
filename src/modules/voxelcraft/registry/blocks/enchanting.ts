// Стол зачарований (сейв v3): предмет + лазурит → три варианта за уровни опыта; сила вариантов
// растёт от книжных полок вокруг (systems/Enchant.ts, экран — ui/InventoryUI).
import type { BlockDef } from "../../types";
import { block } from "./define";

export const ENCHANTING_BLOCKS: BlockDef[] = [
  block({
    name: "enchanting_table",
    shape: "chest",
    opaque: false,
    hardness: 5,
    resistance: 1200,
    tool: "pickaxe",
    harvest: 1,
    light: 7,
    tex: {
      top: "enchanting_table_top",
      side: "enchanting_table_side",
      bottom: "obsidian",
    },
    mapColor: 0x6a1a2a,
  }),
  // наковальня: чинит, соединяет вещи и переносит зачарования с книг; падает, как песок
  block({
    name: "anvil",
    shape: "chest",
    opaque: false,
    hardness: 5,
    resistance: 1200,
    tool: "pickaxe",
    harvest: 1,
    gravity: true,
    tex: { top: "anvil_top", side: "anvil_side", bottom: "anvil_side" },
    mapColor: 0x444444,
  }),
];
