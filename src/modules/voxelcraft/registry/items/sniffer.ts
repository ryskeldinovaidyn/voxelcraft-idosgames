// Древние семена, которые выкапывает нюхач: сажаются на пашню (blockId — росток), семена факелоцвета —
// ещё и приманка нюхача.
import type { ItemDef } from "../../types";
import { B } from "../Blocks";
import { addNames } from "../names";
import { item } from "./define";

export const SNIFFER_ITEMS: ItemDef[] = [
  item({
    name: "torchflower_seeds",
    tile: "torchflower_seeds",
    blockId: B.torchflower_crop!,
  }),
  item({ name: "pitcher_pod", tile: "pitcher_pod", blockId: B.pitcher_crop! }),
];

addNames({
  torchflower_seeds: "Семена факелоцвета",
  pitcher_pod: "Стручок кувшинки",
  sniffer: "Нюхач",
  camel: "Верблюд",
});
