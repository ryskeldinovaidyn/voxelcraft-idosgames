// Снежок: ПКМ — бросить (дугой; мобов отбрасывает, Пламени — 3 урона). 4 снежка → блок снега; снежный слой
// и снеговик роняют снежки.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const FROST_ITEMS: ItemDef[] = [
  item({ name: "snowball", tile: "snowball", maxStack: 16 }),
];

addNames({ snowball: "Снежок" });
