// Предметы, что были до сейва v3: материалы, еда, деревянные инструменты.
import type { ItemDef } from "../../types";
import { item, tool } from "./define";

export const BASIC_ITEMS: ItemDef[] = [
  item({ name: "stick", tile: "stick", fuel: 5 }),
  item({ name: "coal", tile: "coal_item", fuel: 80 }),
  item({ name: "feather", tile: "feather" }),

  // Еда (food = очки голода из 20). Сырая курятина слабая, жареная — сытная, яблоко — с листвы.
  item({ name: "raw_chicken", tile: "raw_chicken", food: 2, saturation: 1.2 }),
  item({
    name: "cooked_chicken",
    tile: "cooked_chicken",
    food: 6,
    saturation: 7.2,
  }),
  item({ name: "apple", tile: "apple", food: 4, saturation: 2.4 }),

  tool("wooden", "pickaxe"),
  tool("wooden", "axe"),
  tool("wooden", "sword"),
];
