// Материалы этапа выживания: сырая руда, слитки, самородки, самоцветы, пыль, кремень, глина.
import type { ItemDef } from "../../types";
import { item } from "./define";

const mat = (name: string, extra: Partial<ItemDef> = {}): ItemDef =>
  item({ name, tile: name, ...extra });

export const MATERIAL_ITEMS: ItemDef[] = [
  mat("raw_iron"),
  mat("raw_gold"),
  mat("raw_copper"),
  mat("iron_ingot"),
  mat("gold_ingot"),
  mat("copper_ingot"),
  mat("iron_nugget"),
  mat("gold_nugget"),
  mat("diamond"),
  mat("emerald"),
  mat("lapis_lazuli"),
  mat("redstone"),
  mat("meteor_fragment", { tile: "iron_nugget" }),
  mat("charcoal", { fuel: 80 }),
  mat("flint"),
  mat("clay_ball"),
  mat("brick"),
  mat("slime_ball"),
];
