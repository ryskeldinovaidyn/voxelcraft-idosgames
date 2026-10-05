// Археология: кисть (ПКМ держать по подозрительному блоку — world/behaviours/archaeology.ts) и черепки
// (находки в руинах и под колодцами; 4 черепка — расписной горшок, тег #sherds).
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { addToTag } from "../tags";
import { item } from "./define";

/** Черепки: id узора → название. */
export const SHERDS: Record<string, string> = {
  angler: "Рыболов",
  archer: "Лучник",
  arms_up: "Руки вверх",
  explorer: "Путешественник",
  miner: "Шахтёр",
  prize: "Трофей",
  shelter: "Укрытие",
  skull: "Череп",
};

const SHERD_ITEMS = Object.keys(SHERDS).map((id) => `${id}_sherd`);

export const ARCHAEOLOGY_ITEMS: ItemDef[] = [
  item({
    name: "brush",
    tile: "brush",
    maxStack: 1,
    kind: "tool",
    durability: 64,
  }),
  ...SHERD_ITEMS.map((name) => item({ name, tile: name })),
];

addToTag("sherds", ...SHERD_ITEMS);

addNames({
  brush: "Кисть",
  ...Object.fromEntries(
    Object.entries(SHERDS).map(([id, n]) => [`${id}_sherd`, `Черепок «${n}»`]),
  ),
});
