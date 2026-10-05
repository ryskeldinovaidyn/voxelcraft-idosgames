// Внешние острова и города Предела (worldgen/beyond/outer.ts): лиловые блоки и колонны (пурпур
// Minecraft), кирпичи Предела, светящийся стержень, эхоцвет (хорус) — стебель и цветок, панцирный
// сундук (шалкеровый ящик: сломанный выпадает с вещами — world/blockentities/shell.ts), голова
// дракона с носа корабля и Врата Предела — ведут на внешние острова и обратно (Game._tickGateway).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block, pillar } from "./define";

export const CITY_BLOCKS: BlockDef[] = [
  block({
    name: "lilac_block",
    hardness: 1.5,
    resistance: 6,
    tool: "pickaxe",
    harvest: 1,
    tex: all("lilac_block"),
    mapColor: 0xa878a8,
  }),
  block({
    name: "lilac_pillar",
    axis: true,
    hardness: 1.5,
    resistance: 6,
    tool: "pickaxe",
    harvest: 1,
    tex: pillar("lilac_pillar_top", "lilac_pillar_side"),
    mapColor: 0xb088b0,
  }),
  block({
    name: "beyond_bricks",
    hardness: 3,
    resistance: 9,
    tool: "pickaxe",
    harvest: 1,
    tex: all("beyond_bricks"),
    mapColor: 0xd8d8a0,
  }),
  block({
    name: "beyond_rod",
    shape: "rod",
    opaque: false,
    hardness: 0,
    light: 14,
    tex: all("beyond_rod"),
    mapColor: 0xf0e8f0,
  }),
  block({
    name: "echo_plant",
    shape: "stalk",
    opaque: false,
    hardness: 0.4,
    tool: "axe",
    drops: [{ item: "echo_fruit", n: 0, max: 1 }],
    tex: all("echo_plant"),
    mapColor: 0x6a4a7a,
  }),
  block({
    name: "echo_flower",
    opaque: false,
    hardness: 0.4,
    tool: "axe",
    tex: { top: "echo_flower_top", side: "echo_flower", bottom: "echo_plant" },
    mapColor: 0xb090c8,
  }),
  block({
    name: "shell_chest",
    shape: "chest",
    opaque: false,
    hardness: 2,
    tool: "pickaxe",
    blockEntity: "shell",
    drops: [], // выпадает сама сущность — с вещами внутри
    tex: {
      top: "shell_chest_top",
      side: "shell_chest_side",
      bottom: "shell_chest_top",
    },
    mapColor: 0x8a5a9a,
  }),
  block({
    name: "dragon_head",
    shape: "skull",
    opaque: false,
    hardness: 1,
    tex: {
      top: "dragon_head_side",
      bottom: "dragon_head_side",
      side: "dragon_head_side",
      front: "dragon_head_front",
    },
    mapColor: 0x1a1420,
  }),
  block({
    name: "beyond_gateway",
    solid: false,
    opaque: false,
    hardness: Infinity,
    resistance: 3_600_000,
    light: 15,
    filter: 0,
    drops: [],
    noItem: true,
    tex: all("beyond_portal"),
    mapColor: 0x0a0a14,
  }),
];

addNames({
  lilac_block: "Лиловый блок",
  lilac_pillar: "Лиловая колонна",
  beyond_bricks: "Кирпичи Предела",
  beyond_rod: "Стержень Предела",
  echo_plant: "Эхоцвет",
  echo_flower: "Цветок эхоцвета",
  shell_chest: "Панцирный сундук",
  dragon_head: "Голова дракона",
  beyond_gateway: "Врата Предела",
  beyond_city: "Город Предела",
});
