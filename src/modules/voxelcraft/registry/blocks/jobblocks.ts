// Рабочие блоки жителей: точило снимает зачарования и чинит (systems/Grindstone), ткацкий станок
// кладёт узоры на знамёна (systems/Banner), кафедра держит книгу и открывает её на правку или
// чтение (systems/Book, world/blockentities/lectern). Экраны у всех трёх — ui/InventoryUI и
// ui/BookScreen. Стол фехтовальщика стоит ради профессии жителя (systems/Jobs).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { block } from "./define";

const WOOD = { hardness: 2.5, tool: "axe", flammable: true } as const;

export const JOB_BLOCKS: BlockDef[] = [
  block({
    name: "grindstone",
    hardness: 2,
    tool: "pickaxe",
    tex: {
      top: "grindstone_top",
      bottom: "grindstone_side",
      side: "grindstone_side",
    },
    mapColor: 0x8a8a8a,
  }),
  block({
    name: "loom",
    ...WOOD,
    tex: { top: "loom_top", bottom: "loom_side", side: "loom_side" },
    mapColor: 0xa08a5a,
  }),
  block({
    name: "lectern",
    ...WOOD,
    blockEntity: "lectern",
    tex: { top: "lectern_top", bottom: "lectern_side", side: "lectern_side" },
    mapColor: 0x9a7a48,
  }),
  block({
    name: "fletching_table",
    ...WOOD,
    tex: {
      top: "fletching_table_top",
      bottom: "fletching_table_side",
      side: "fletching_table_side",
    },
    mapColor: 0xc8bc98,
  }),
];

addNames({
  grindstone: "Точило",
  loom: "Ткацкий станок",
  lectern: "Кафедра",
  fletching_table: "Стол фехтовальщика",
});
