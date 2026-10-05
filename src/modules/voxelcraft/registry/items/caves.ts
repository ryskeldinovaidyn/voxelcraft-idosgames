// Предметы пещер: осколок аметиста (из друз), светящиеся ягоды (еда и то, чем сажают пещерную лозу —
// под потолок), подзорная труба (ПКМ держать — приближение, main.ts _spyglass).
import type { ItemDef } from "../../types";
import { B } from "../Blocks";
import { addNames } from "../names";
import { item } from "./define";

export const CAVE_ITEMS: ItemDef[] = [
  item({ name: "amethyst_shard", tile: "amethyst_shard" }),
  item({
    name: "glow_berries",
    tile: "glow_berries",
    food: 2,
    saturation: 0.4,
    blockId: B.cave_vines!,
  }),
  item({ name: "spyglass", tile: "spyglass", maxStack: 1 }),
];

addNames({
  amethyst_shard: "Осколок аметиста",
  glow_berries: "Светящиеся ягоды",
  spyglass: "Подзорная труба",
  axolotl: "Аксолотль",
});
