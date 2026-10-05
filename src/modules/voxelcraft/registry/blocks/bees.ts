// Пчелиное гнездо (в лесу на деревьях) и улей (крафт), как в Minecraft. Мета — уровень мёда 0..5
// (биты 0..2), бит HIVE_SEEDED — гнездо из генератора, пчёл в нём ещё не заводили. Пчёлы и мёд —
// блочная сущность hive (world/blockentities/hive.ts), сбор — world/Hive.ts.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { block } from "./define";

/** Уровень мёда полного улья. */
export const HONEY_FULL = 5;
/** Гнездо из генератора: на первом случайном тике в нём заводятся три пчелы. */
export const HIVE_SEEDED = 0x8;

export const BEE_BLOCKS: BlockDef[] = [
  block({
    name: "bee_nest",
    hardness: 0.3,
    tool: "axe",
    flammable: true,
    blockEntity: "hive",
    drops: [],
    tex: {
      top: "bee_nest_top",
      bottom: "bee_nest_top",
      side: "bee_nest_side",
      on: "bee_nest_honey",
    },
    mapColor: 0xc8a040,
  }),
  block({
    name: "beehive",
    hardness: 0.6,
    tool: "axe",
    flammable: true,
    blockEntity: "hive",
    tex: {
      top: "beehive_end",
      bottom: "beehive_end",
      side: "beehive_side",
      on: "beehive_honey",
    },
    mapColor: 0xb08a50,
  }),
];

addNames({ bee_nest: "Пчелиное гнездо", beehive: "Улей" });
