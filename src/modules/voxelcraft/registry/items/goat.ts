// Козий рог: коза теряет его, промахнувшись тараном в камень, бревно, руду или лёд. ПКМ — протрубить
// (слышно далеко, будит сенсоры скалка; раз в 7 с — main.ts _goatHorn).
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const GOAT_ITEMS: ItemDef[] = [
  item({ name: "goat_horn", tile: "goat_horn", maxStack: 1 }),
];

addNames({ goat_horn: "Козий рог", goat: "Коза" });
