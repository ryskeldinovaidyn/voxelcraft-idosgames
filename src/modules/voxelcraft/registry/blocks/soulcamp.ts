// Костёр душ: как костёр (жарит еду — блочная сущность campfire, лопатой гасят, огнивом зажигают —
// world/behaviours/camp), но пламя бирюзовое, светит 10, жжёт вдвое сильнее и роняет почву душ.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { block } from "./define";

const soulCampfire = (
  name: string,
  top: string,
  light: number,
  extra: Partial<BlockDef> = {},
): BlockDef =>
  block({
    name,
    shape: "campfire",
    opaque: false,
    hardness: 2,
    tool: "axe",
    light,
    blockEntity: "campfire",
    drops: [{ item: "soul_soil", n: 1 }],
    tex: { top, side: "campfire_side", bottom: "campfire_side" },
    mapColor: 0x3a6a7a,
    ...extra,
  });

export const SOUL_CAMP_BLOCKS: BlockDef[] = [
  soulCampfire("soul_campfire", "soul_campfire_top", 10),
  soulCampfire("soul_campfire_out", "campfire_off", 0, {
    item: "soul_campfire",
    noItem: true,
  }),
];

addNames({
  soul_campfire: "Костёр душ",
  soul_campfire_out: "Потухший костёр душ",
});
