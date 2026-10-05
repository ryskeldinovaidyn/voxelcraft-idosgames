// Функциональные блоки с блочными сущностями: печь (и она же горящая — свой id ради света) и сундук.
import type { BlockDef } from "../../types";
import { block } from "./define";

const FURNACE_TEX = {
  top: "furnace_top",
  bottom: "furnace_top",
  side: "furnace_side",
  front: "furnace_front",
};

export const FUNCTIONAL_BLOCKS: BlockDef[] = [
  block({
    name: "furnace",
    hardness: 3.5,
    tool: "pickaxe",
    harvest: 1,
    blockEntity: "furnace",
    tex: FURNACE_TEX,
    mapColor: 0x6a6a6a,
  }),
  // Горящая печь: тот же тип блочной сущности (состояние живёт при смене id), светит на 13.
  block({
    name: "lit_furnace",
    hardness: 3.5,
    tool: "pickaxe",
    harvest: 1,
    light: 13,
    blockEntity: "furnace",
    noItem: true,
    item: "furnace",
    drops: [{ item: "furnace", n: 1 }],
    tex: { ...FURNACE_TEX, front: "furnace_front_on" },
    mapColor: 0x7a6a5a,
  }),
  // Кровать: две клетки (изножье и изголовье — бит TOP), задаёт точку возрождения, ночью — сон.
  block({
    name: "red_bed",
    shape: "bed",
    hardness: 0.2,
    flammable: true,
    tex: {
      top: "bed_top",
      side: "bed_side",
      bottom: "planks",
      upper: "bed_head",
    },
    mapColor: 0xb02020,
  }),
  // TNT: огниво, огонь или соседний взрыв превращают блок во взведённый заряд (entities/PrimedTnt).
  block({
    name: "tnt",
    hardness: 0,
    flammable: true,
    tex: { top: "tnt_top", bottom: "tnt_bottom", side: "tnt_side" },
    mapColor: 0xd02020,
  }),
  block({
    name: "chest",
    shape: "chest",
    hardness: 2.5,
    tool: "axe",
    flammable: true,
    blockEntity: "chest",
    tex: {
      top: "chest_top",
      bottom: "chest_top",
      side: "chest_side",
      front: "chest_front",
    },
    mapColor: 0x9a7040,
  }),
];
