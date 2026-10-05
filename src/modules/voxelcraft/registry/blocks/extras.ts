// Три блока, которых не хватало: сундук Предела (общий склад игрока — один на все свои копии и
// измерения, systems/Inventory + ui/InventoryUI), строительные леса (systems/Scaffold — держатся на
// расстоянии до опоры, по ним лезут) и мишень (стрела даёт красный сигнал тем сильнее, чем ближе к
// центру — world/behaviours/extras, world/Redstone).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

export const EXTRA_BLOCKS: BlockDef[] = [
  block({
    name: "ender_chest",
    hardness: 22.5,
    resistance: 600,
    tool: "pickaxe",
    harvest: 1,
    light: 7,
    shape: "chest",
    opaque: false,
    tex: {
      top: "ender_chest_top",
      bottom: "ender_chest_top",
      side: "ender_chest_side",
      front: "ender_chest_front",
    },
    mapColor: 0x1a4a4a,
  }),
  block({
    name: "scaffolding",
    shape: "scaffold",
    solid: false,
    opaque: false,
    hardness: 0,
    tool: "axe",
    flammable: true,
    tex: {
      top: "scaffolding_top",
      bottom: "scaffolding_top",
      side: "scaffolding_side",
    },
    mapColor: 0xc8a860,
  }),
  block({
    name: "target",
    hardness: 0.5,
    tex: all("target"),
    mapColor: 0xd8d0c0,
  }),
];

addNames({
  ender_chest: "Сундук Предела",
  scaffolding: "Строительные леса",
  target: "Мишень",
});
