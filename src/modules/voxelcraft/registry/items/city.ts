// Добыча внешних островов Предела: плод эхоцвета (еда, переносит на несколько блоков — Player.echoHop),
// печёный плод (лиловые блоки), панцирь (панцирный сундук), Крылья Предела (элитры: надеваются на
// грудь, планирование — player/Glide.ts) и ракета (рывок в полёте на крыльях).
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const CITY_ITEMS: ItemDef[] = [
  item({ name: "echo_fruit", tile: "echo_fruit", food: 4, saturation: 2.4 }),
  item({ name: "popped_echo_fruit", tile: "popped_echo_fruit" }),
  item({ name: "shell_plate", tile: "shell_plate" }),
  item({
    name: "wings",
    tile: "wings",
    kind: "armor",
    armorSlot: "chest",
    durability: 432,
    maxStack: 1,
  }),
  item({ name: "rocket", tile: "rocket" }),
];

addNames({
  echo_fruit: "Плод эхоцвета",
  popped_echo_fruit: "Печёный плод эхоцвета",
  shell_plate: "Панцирь",
  wings: "Крылья Предела",
  rocket: "Ракета",
  shellkeeper: "Панцирник",
});
