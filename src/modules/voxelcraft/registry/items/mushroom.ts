// Миска и грибной суп (бурый + красный гриб + миска; ещё — миской по грибной корове). Съеденный суп
// оставляет миску.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const MUSHROOM_ITEMS: ItemDef[] = [
  item({ name: "bowl", tile: "bowl", fuel: 5 }),
  item({
    name: "mushroom_stew",
    tile: "mushroom_stew",
    maxStack: 1,
    food: 6,
    saturation: 7.2,
    remainder: "bowl",
  }),
];

addNames({ bowl: "Миска", mushroom_stew: "Грибной суп" });
