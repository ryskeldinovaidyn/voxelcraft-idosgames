// Рабочие блоки жителей, как в Minecraft: бочка (сундук на 27 слотов — блочная сущность chest), коптильня и
// плавильная печь (блочная сущность furnace в своём режиме: еда или руды, вдвое быстрее —
// world/blockentities/furnace; горящие — отдельные блоки), компостер (растения → костная мука —
// world/behaviours/composter; уровень 0..7 в мете, 8 — готово).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { block } from "./define";

const STONE = {
  hardness: 3.5,
  tool: "pickaxe",
  harvest: 1,
  blockEntity: "furnace",
} as const;

/** Печь-вариант и её горящий двойник (тот же тип сущности, свет 13). */
const oven = (
  name: string,
  tex: { top: string; side: string; front: string; on: string },
  mapColor: number,
): BlockDef[] => [
  block({
    name,
    ...STONE,
    tex: { top: tex.top, bottom: tex.top, side: tex.side, front: tex.front },
    mapColor,
  }),
  block({
    name: `lit_${name}`,
    ...STONE,
    light: 13,
    noItem: true,
    item: name,
    drops: [{ item: name, n: 1 }],
    tex: { top: tex.top, bottom: tex.top, side: tex.side, front: tex.on },
    mapColor,
  }),
];

export const WORKSTATION_BLOCKS: BlockDef[] = [
  block({
    name: "barrel",
    hardness: 2.5,
    tool: "axe",
    flammable: true,
    blockEntity: "chest",
    tex: { top: "barrel_top", bottom: "barrel_top", side: "barrel_side" },
    mapColor: 0x8a6a3a,
  }),
  ...oven(
    "smoker",
    {
      top: "smoker_top",
      side: "smoker_side",
      front: "smoker_front",
      on: "smoker_front_on",
    },
    0x5a4a3a,
  ),
  ...oven(
    "blast_furnace",
    {
      top: "blast_furnace_top",
      side: "blast_furnace_side",
      front: "blast_furnace_front",
      on: "blast_furnace_front_on",
    },
    0x5a5a62,
  ),
  block({
    name: "composter",
    hardness: 0.6,
    tool: "axe",
    flammable: true,
    tex: {
      top: "composter_top",
      bottom: "composter_side",
      side: "composter_side",
    },
    mapColor: 0x7a5a32,
  }),
];

addNames({
  barrel: "Бочка",
  smoker: "Коптильня",
  lit_smoker: "Коптильня",
  blast_furnace: "Плавильная печь",
  lit_blast_furnace: "Плавильная печь",
  composter: "Компостер",
});
