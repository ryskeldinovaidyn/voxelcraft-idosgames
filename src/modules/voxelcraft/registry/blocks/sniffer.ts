// Нюхач и древние растения (Minecraft 1.20): яйцо нюхача (находка раскопок; на мху вылупляется вдвое
// быстрее) и то, что нюхач выкапывает, — семена факелоцвета и стручок кувшинки. Ростки живут только на
// пашне и, дозрев, становятся цветком — факелоцветом или кувшинным растением (world/behaviours/sniffer).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

/** Росток → [стадий до цветка, какой цветок]. */
export const ANCIENT_CROPS: Record<string, [number, string]> = {
  torchflower_crop: [2, "torchflower"],
  pitcher_crop: [4, "pitcher_plant"],
};

const PLANT = {
  shape: "cross" as const,
  solid: false,
  opaque: false,
  hardness: 0,
};

export const SNIFFER_BLOCKS: BlockDef[] = [
  block({
    name: "sniffer_egg",
    shape: "skull",
    opaque: false,
    hardness: 0.5,
    tex: all("sniffer_egg"),
    mapColor: 0x8a3a2a,
  }),
  block({
    name: "torchflower_crop",
    ...PLANT,
    noItem: true,
    item: "torchflower_seeds",
    drops: [{ item: "torchflower_seeds", n: 1 }],
    tex: all("torchflower_crop"),
    mapColor: 0x5a8a2a,
  }),
  block({
    name: "torchflower",
    ...PLANT,
    tex: all("torchflower"),
    mapColor: 0xe88a20,
  }),
  block({
    name: "pitcher_crop",
    ...PLANT,
    noItem: true,
    item: "pitcher_pod",
    drops: [{ item: "pitcher_pod", n: 1 }],
    tex: all("pitcher_crop"),
    mapColor: 0x3a8a8a,
  }),
  block({
    name: "pitcher_plant",
    ...PLANT,
    tex: all("pitcher_plant"),
    mapColor: 0x3a8aa0,
  }),
];

addNames({
  sniffer_egg: "Яйцо нюхача",
  torchflower_crop: "Росток факелоцвета",
  torchflower: "Факелоцвет",
  pitcher_crop: "Росток кувшинки",
  pitcher_plant: "Кувшинное растение",
});
