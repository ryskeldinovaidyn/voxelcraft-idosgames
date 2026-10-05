// Остальные зелья Minecraft: огнестойкость, яд и ветка «испорченных» через сброженный паучий глаз —
// слабость, замедление и урон. Что во что варится — BREWS в world/blockentities/brewing.ts.
import type { DrinkDef, ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

const potion = (name: string, drink: DrinkDef): ItemDef =>
  item({ name, tile: name, maxStack: 1, remainder: "glass_bottle", drink });

export const POTION_ITEMS: ItemDef[] = [
  // сброженный паучий глаз: сам не пьётся, но портит зелья в противоположные
  item({ name: "fermented_spider_eye", tile: "fermented_spider_eye" }),
  potion("potion_fire_resistance", { effect: "fire_resistance", seconds: 180 }),
  potion("potion_poison", { effect: "poison", seconds: 45 }),
  potion("potion_weakness", { effect: "weakness", seconds: 90 }),
  potion("potion_slowness", { effect: "slowness", seconds: 90 }),
  potion("potion_harming", { damage: 6 }),
];

addNames({
  fermented_spider_eye: "Сброженный паучий глаз",
  potion_fire_resistance: "Зелье огнестойкости",
  potion_poison: "Зелье яда",
  potion_weakness: "Зелье слабости",
  potion_slowness: "Зелье замедления",
  potion_harming: "Зелье урона",
});
