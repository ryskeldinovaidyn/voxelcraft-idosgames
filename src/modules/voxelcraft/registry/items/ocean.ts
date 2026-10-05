// Добыча океана: осколки и кристаллы морского камня (глубинники, морской фонарь), щиток черепахи
// (роняет выросший черепашонок) и черепаший панцирь — шлем, который над водой копит Подводное
// дыхание (Game.tick).
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const OCEAN_ITEMS: ItemDef[] = [
  item({ name: "sea_shard", tile: "sea_shard" }),
  item({ name: "sea_crystals", tile: "sea_crystals" }),
  item({ name: "scute", tile: "scute" }),
  item({
    name: "turtle_helmet",
    tile: "turtle_helmet",
    kind: "armor",
    armorSlot: "head",
    armor: 2,
    durability: 275,
    maxStack: 1,
  }),
];

addNames({
  sea_shard: "Осколок морского камня",
  sea_crystals: "Кристаллы моря",
  scute: "Щиток черепахи",
  turtle_helmet: "Черепаший панцирь",
  turtle: "Черепаха",
  deepling: "Глубинник",
  elder_deepling: "Древний глубинник",
});
