// Отравленные стрелы (systems/TippedArrow): свой предмет на каждый эффект.
import type { ItemDef } from "../../types";
import { TIPPED_ARROWS } from "../../systems/TippedArrow";
import { addNames } from "../names";
import { item } from "./define";

export const TIPPED_ITEMS: ItemDef[] = Object.keys(TIPPED_ARROWS).map((name) =>
  item({ name, tile: name }),
);

addNames(
  Object.fromEntries(
    Object.entries(TIPPED_ARROWS).map(([id, t]) => [id, t.name]),
  ),
);
