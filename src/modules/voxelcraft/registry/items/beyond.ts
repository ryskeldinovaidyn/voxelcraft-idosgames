// Око Предела: жемчуг Предела + огненный порошок. Брошенное летит к ближайшей Подземной цитадели,
// вставленное в рамку — часть портала Предела (world/BeyondPortal.ts).
import type { ItemDef } from "../../types";
import { item } from "./define";

export const BEYOND_ITEMS: ItemDef[] = [
  item({ name: "rim_eye", tile: "rim_eye", maxStack: 16 }),
];
