// Капельниковые пещеры: капельниковый блок и острый капельник — сталагмит (растёт вверх, на него больно
// падать) и сталактит (свисает; без опоры падает и ранит, под водой растёт и капает в котёл). Котёл:
// пустой, с водой (уровень 1..3 в мете) и с лавой. Поведение — world/behaviours/dripstone.ts.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

const DRIP = 0x86705a;
const SPIKE = {
  shape: "cross" as const,
  solid: false,
  opaque: false,
  hardness: 1.5,
  tool: "pickaxe" as const,
  mapColor: DRIP,
};
const POT = {
  opaque: false,
  hardness: 2,
  tool: "pickaxe" as const,
  harvest: 1,
  mapColor: 0x3a3a3a,
};

export const DRIPSTONE_BLOCKS: BlockDef[] = [
  block({
    name: "dripstone_block",
    hardness: 1.5,
    tool: "pickaxe",
    harvest: 1,
    tex: all("dripstone_block"),
    mapColor: DRIP,
  }),
  block({
    name: "pointed_dripstone",
    ...SPIKE,
    tex: all("pointed_dripstone_up"),
  }),
  block({
    name: "pointed_dripstone_down",
    ...SPIKE,
    noItem: true,
    item: "pointed_dripstone",
    drops: [{ item: "pointed_dripstone", n: 1 }],
    tex: all("pointed_dripstone_down"),
  }),
  block({
    name: "cauldron",
    ...POT,
    tex: {
      top: "cauldron_top",
      side: "cauldron_side",
      bottom: "cauldron_bottom",
    },
  }),
  block({
    name: "water_cauldron",
    ...POT,
    noItem: true,
    item: "cauldron",
    drops: [{ item: "cauldron", n: 1 }],
    tex: {
      top: "cauldron_water",
      side: "cauldron_side",
      bottom: "cauldron_bottom",
    },
  }),
  block({
    name: "lava_cauldron",
    ...POT,
    light: 15,
    noItem: true,
    item: "cauldron",
    drops: [{ item: "cauldron", n: 1 }],
    tex: {
      top: "cauldron_lava",
      side: "cauldron_side",
      bottom: "cauldron_bottom",
    },
  }),
];

addNames({
  dripstone_block: "Капельниковый блок",
  pointed_dripstone: "Острый капельник",
  pointed_dripstone_down: "Острый капельник",
  cauldron: "Котёл",
  water_cauldron: "Котёл с водой",
  lava_cauldron: "Котёл с лавой",
});
