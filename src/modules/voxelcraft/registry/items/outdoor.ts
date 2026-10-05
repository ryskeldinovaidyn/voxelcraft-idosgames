// Рыбалка, лодки, компас и часы. Лодка — по породе дерева (registry/blocks/wood), ставится на воду
// или на блок ПКМ (world/behaviours/rails); удочка забрасывает поплавок (entities/FishingHook).
import type { ItemDef } from "../../types";
import { WOOD_SPECIES } from "../blocks/wood";
import { addNames } from "../names";
import { item } from "./define";

export const OUTDOOR_ITEMS: ItemDef[] = [
  item({
    name: "fishing_rod",
    tile: "fishing_rod",
    durability: 64,
    maxStack: 1,
  }),
  item({ name: "cod", tile: "cod", food: 2, saturation: 0.4 }),
  item({ name: "salmon", tile: "salmon", food: 2, saturation: 0.4 }),
  item({ name: "cooked_cod", tile: "cooked_cod", food: 5, saturation: 6 }),
  item({
    name: "cooked_salmon",
    tile: "cooked_salmon",
    food: 6,
    saturation: 9.6,
  }),
  item({ name: "compass", tile: "compass" }),
  item({ name: "clock", tile: "clock" }),
  // карта: пустая (ПКМ — завести), заполненная (tag.map — номер карты в Game.maps)
  item({ name: "map", tile: "map" }),
  // добыча диких и ночных мобов
  item({ name: "ink_sac", tile: "ink_sac" }),
  item({ name: "rabbit_hide", tile: "rabbit_hide" }),
  item({ name: "raw_rabbit", tile: "raw_rabbit", food: 3, saturation: 1.8 }),
  item({
    name: "cooked_rabbit",
    tile: "cooked_rabbit",
    food: 5,
    saturation: 6,
  }),
  item({ name: "phantom_membrane", tile: "phantom_membrane" }),
  // мёд: соты — ножницами с полного улья, бутылочка — пузырьком (пьётся и сытым, пузырёк остаётся)
  item({ name: "honeycomb", tile: "honeycomb" }),
  item({
    name: "honey_bottle",
    tile: "honey_bottle",
    maxStack: 16,
    remainder: "glass_bottle",
    drink: { food: 6 },
  }),
  // седло: лошадь в седле слушается седока (сокровище рыбалки, мясник)
  item({ name: "saddle", tile: "saddle", maxStack: 1 }),
  item({ name: "filled_map", tile: "filled_map" }),
  ...WOOD_SPECIES.map((s) =>
    item({ name: `${s.id}_boat`, tile: `${s.id}_boat`, maxStack: 1 }),
  ),
];

addNames(
  Object.fromEntries(
    WOOD_SPECIES.map((s) => [`${s.id}_boat`, `${s.adj[1]} лодка`]),
  ),
);
