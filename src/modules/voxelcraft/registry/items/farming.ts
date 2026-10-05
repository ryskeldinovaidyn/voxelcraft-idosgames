// Фермерство: семена и урожай (сажаются на пашню — blockId посева), хлеб, костная мука.
import type { ItemDef } from "../../types";
import { B } from "../Blocks";
import { item } from "./define";

export const FARMING_ITEMS: ItemDef[] = [
  item({ name: "wheat_seeds", tile: "wheat_seeds", blockId: B.wheat! }),
  item({
    name: "beetroot_seeds",
    tile: "beetroot_seeds",
    blockId: B.beetroots!,
  }),
  item({ name: "wheat", tile: "wheat_item" }),
  // морковь и картофель — и еда, и то, чем сажают (как в Minecraft)
  item({
    name: "carrot",
    tile: "carrot",
    food: 3,
    saturation: 3.6,
    blockId: B.carrots!,
  }),
  item({
    name: "potato",
    tile: "potato",
    food: 1,
    saturation: 0.6,
    blockId: B.potatoes!,
  }),
  item({ name: "baked_potato", tile: "baked_potato", food: 5, saturation: 6 }),
  item({ name: "beetroot", tile: "beetroot", food: 1, saturation: 1.2 }),
  item({ name: "bread", tile: "bread", food: 5, saturation: 6 }),
  item({ name: "bone_meal", tile: "bone_meal" }),
  // тростник → сахар и бумага; бумага + кожа → книга
  item({ name: "sugar", tile: "sugar" }),
  item({ name: "paper", tile: "paper" }),
  item({ name: "book", tile: "book" }),
  // тыква и арбуз
  item({ name: "melon_slice", tile: "melon_slice", food: 2, saturation: 1.2 }),
  item({
    name: "pumpkin_seeds",
    tile: "pumpkin_seeds",
    blockId: B.pumpkin_stem!,
  }),
  item({ name: "melon_seeds", tile: "melon_seeds", blockId: B.melon_stem! }),
  item({ name: "glistering_melon", tile: "glistering_melon" }),
];
