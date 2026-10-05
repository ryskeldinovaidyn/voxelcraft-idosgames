// Золотое яблоко: лечит зомби-жителя обратно в жителя (systems/Zombify, player/Interaction) и просто
// съедобно. Зачарованное — сильная регенерация и огнестойкость, только из добычи (крафта нет).
// ⚠ Обоих не существовало, хотя они уже лежали в таблицах добычи (испытания, особняк, древний
// город): такие строки молча не выпадали. Теперь за этим следит тест worldgen/features/Loot.test.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const CURE_ITEMS: ItemDef[] = [
  item({
    name: "golden_apple",
    tile: "golden_apple",
    food: 4,
    saturation: 9.6,
  }),
  // ест «как питьё»: так предмет даёт эффект и съедается сытым, как золотое яблоко Minecraft
  item({
    name: "enchanted_golden_apple",
    tile: "enchanted_golden_apple",
    maxStack: 1,
    drink: { food: 4, effect: "regeneration", seconds: 20, level: 2 },
  }),
];

addNames({
  golden_apple: "Золотое яблоко",
  enchanted_golden_apple: "Зачарованное золотое яблоко",
});
