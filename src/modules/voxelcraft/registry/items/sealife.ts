// Морская добыча: сушёная ламинария (еда), тропическая рыба и иглобрюх (съеденный — Отравление II на
// минуту, как в Minecraft), зелье Подводного дыхания (неловкое зелье + иглобрюх).
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const SEA_LIFE_ITEMS: ItemDef[] = [
  item({ name: "dried_kelp", tile: "dried_kelp", food: 1, saturation: 0.6 }),
  item({
    name: "tropical_fish",
    tile: "tropical_fish",
    food: 1,
    saturation: 0.2,
  }),
  item({
    name: "pufferfish",
    tile: "pufferfish",
    food: 1,
    saturation: 0.2,
    eatEffects: [{ id: "poison", seconds: 60, level: 2 }],
  }),
  item({
    name: "potion_water_breathing",
    tile: "potion_water_breathing",
    maxStack: 1,
    remainder: "glass_bottle",
    drink: { effect: "water_breathing", seconds: 180 },
  }),
];

addNames({
  dried_kelp: "Сушёная ламинария",
  tropical_fish: "Тропическая рыба",
  pufferfish: "Иглобрюх",
  potion_water_breathing: "Зелье подводного дыхания",
});
