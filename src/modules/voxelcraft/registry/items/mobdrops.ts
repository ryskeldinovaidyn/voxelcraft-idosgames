// Добыча с мобов и оружие дальнего боя: мясо (сырое и жареное), кожа, нить, кость, порох, стрелы,
// лук, ножницы, Жемчуг Предела. Пищевая ценность — как в Minecraft (food/saturation).
import type { ItemDef } from "../../types";
import { item } from "./define";

const food = (name: string, points: number, saturation: number): ItemDef =>
  item({ name, tile: name, food: points, saturation });

export const MOB_ITEMS: ItemDef[] = [
  item({ name: "leather", tile: "leather" }),
  food("beef", 3, 1.8),
  food("cooked_beef", 8, 12.8),
  food("porkchop", 3, 1.8),
  food("cooked_porkchop", 8, 12.8),
  food("mutton", 2, 1.2),
  food("cooked_mutton", 6, 9.6),
  food("rotten_flesh", 4, 0.8),
  food("spider_eye", 2, 3.2),
  item({ name: "string", tile: "string" }),
  item({ name: "bone", tile: "bone" }),
  item({ name: "gunpowder", tile: "gunpowder" }),
  item({ name: "arrow", tile: "arrow" }),
  item({
    name: "bow",
    tile: "bow",
    kind: "tool",
    maxStack: 1,
    durability: 384,
  }),
  item({
    name: "shears",
    tile: "shears",
    kind: "tool",
    toolType: "shears",
    speed: 5,
    maxStack: 1,
    durability: 238,
  }),
  item({ name: "rim_pearl", tile: "rim_pearl", maxStack: 16 }),
];
