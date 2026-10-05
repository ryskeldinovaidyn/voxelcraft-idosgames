// Щит: держишь ПКМ — прикрываешься (Player.blocking, идёшь медленно); удары и снаряды спереди не ранят,
// щит теряет прочность по урону (Player.shieldBlocks). Доски буквой Y с железом.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const SHIELD_ITEMS: ItemDef[] = [
  item({ name: "shield", tile: "shield", maxStack: 1, durability: 336 }),
];

addNames({ shield: "Щит" });
