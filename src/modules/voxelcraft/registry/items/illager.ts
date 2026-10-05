// Тотем жизни (тотем бессмертия Minecraft): добыча ворожея; в руке спасает от смерти — 1 здоровья,
// Регенерация II и Огнестойкость (Player.damage → Game.tryTotem).
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const ILLAGER_ITEMS: ItemDef[] = [
  item({ name: "life_totem", tile: "life_totem", maxStack: 1 }),
];

addNames({
  life_totem: "Тотем жизни",
  marauder: "Мародёр",
  axeman: "Секирник",
  conjurer: "Ворожей",
  wisp: "Бесёнок",
  crusher: "Громила",
  outpost: "Застава мародёров",
});
