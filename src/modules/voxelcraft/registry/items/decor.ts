// Мешок (bundle, Minecraft 1.21): вмещает смесь предметов общим «весом» до 64 — systems/Bundle.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const DECOR_ITEMS: ItemDef[] = [
  item({ name: "bundle", tile: "bundle", maxStack: 1 }),
];

addNames({ bundle: "Мешок" });
