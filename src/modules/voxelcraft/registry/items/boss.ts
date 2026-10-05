// Звезда Пекла — добыча Пепельного владыки, из неё крафтят маяк.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const BOSS_ITEMS: ItemDef[] = [
  item({ name: "inferno_star", tile: "inferno_star" }),
];

addNames({ inferno_star: "Звезда Пекла", ash_lord: "Пепельный владыка" });
