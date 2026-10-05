// Бирка с именем: ПКМ по мобу даёт ему имя (ui/NameEditor), имя висит над ним и держит его в мире —
// названный моб не исчезает при удалении игрока. Фейерверк-ракета уже была (полёт на крыльях),
// теперь её же можно запустить с земли — gfx/Fireworks.
// ⚠ Бирка лежала в добыче особняка и древнего города, а предмета не существовало: те строки добычи
// молча не выпадали. Второй такой случай после золотого яблока.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const NAMETAG_ITEMS: ItemDef[] = [
  item({ name: "name_tag", tile: "name_tag", maxStack: 1 }),
];

addNames({ name_tag: "Бирка с именем" });
