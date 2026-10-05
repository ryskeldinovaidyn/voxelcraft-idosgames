// Варка: пузырёк, зелья (пьются — ItemDef.drink, после питья остаётся пузырёк), адский нарост,
// золотая морковь. Что во что варится — world/blockentities/brewing.ts.
import type { DrinkDef, ItemDef } from "../../types";
import { B } from "../Blocks";
import { item } from "./define";

const potion = (name: string, drink: DrinkDef): ItemDef =>
  item({ name, tile: name, maxStack: 1, remainder: "glass_bottle", drink });

export const BREWING_ITEMS: ItemDef[] = [
  item({ name: "glass_bottle", tile: "glass_bottle", maxStack: 16 }),
  potion("potion_water", {}),
  potion("potion_awkward", {}),
  potion("potion_strength", { effect: "strength", seconds: 180 }),
  potion("potion_regeneration", { effect: "regeneration", seconds: 45 }),
  potion("potion_night_vision", { effect: "night_vision", seconds: 180 }),
  potion("potion_healing", { heal: 4 }),
  potion("potion_swiftness", { effect: "speed", seconds: 180 }),
  item({
    name: "inferno_wart",
    tile: "inferno_wart_item",
    blockId: B.inferno_wart!,
  }),
  item({
    name: "golden_carrot",
    tile: "golden_carrot",
    food: 6,
    saturation: 14.4,
  }),
  // книга, зачарованная на столе; её зачарования переносит наковальня
  item({ name: "enchanted_book", tile: "enchanted_book", maxStack: 1 }),
];
