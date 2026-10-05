// Глубокая тьма: скалк, прожилки, катализатор (смерть рядом — скалк расползается), сенсор (ловит
// вибрации, горит 1.5 с и даёт сигнал красного камня), крикун (кричит — Тьма и предупреждение, на
// четвёртом будит Стража) и сланец древнего города. Логика — systems/Sculk.ts.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

/** Бит меты крикуна: может разбудить Стража (поставлен генератором, а не игроком или катализатором). */
export const CAN_SUMMON = 1;

const SCULK = 0x0d1e24;
const HOE = { tool: "hoe" as const, drops: [] };
const SLATE = {
  hardness: 3.5,
  resistance: 6,
  tool: "pickaxe" as const,
  harvest: 1,
  mapColor: 0x46464a,
};

export const SCULK_BLOCKS: BlockDef[] = [
  // скалк без шёлка ничего не роняет, как в Minecraft
  block({
    name: "sculk",
    hardness: 0.2,
    ...HOE,
    tex: all("sculk"),
    mapColor: SCULK,
  }),
  block({
    name: "sculk_vein",
    shape: "carpet",
    opaque: false,
    hardness: 0.2,
    ...HOE,
    tex: all("sculk_vein"),
    mapColor: SCULK,
  }),
  block({
    name: "sculk_catalyst",
    hardness: 3,
    tool: "hoe",
    light: 6,
    tex: {
      top: "sculk_catalyst_top",
      side: "sculk_catalyst_side",
      bottom: "sculk",
    },
    mapColor: SCULK,
  }),
  block({
    name: "sculk_sensor",
    hardness: 1.5,
    tool: "hoe",
    light: 1,
    tex: {
      top: "sculk_sensor_top",
      side: "sculk_sensor_side",
      bottom: "sculk",
    },
    mapColor: SCULK,
  }),
  block({
    name: "sculk_sensor_on",
    hardness: 1.5,
    tool: "hoe",
    light: 6,
    noItem: true,
    item: "sculk_sensor",
    drops: [{ item: "sculk_sensor", n: 1 }],
    tex: {
      top: "sculk_sensor_on_top",
      side: "sculk_sensor_side",
      bottom: "sculk",
    },
    mapColor: SCULK,
  }),
  block({
    name: "sculk_shrieker",
    hardness: 3,
    tool: "hoe",
    tex: {
      top: "sculk_shrieker_top",
      side: "sculk_shrieker_side",
      bottom: "sculk",
    },
    mapColor: SCULK,
  }),
  block({
    name: "polished_deepslate",
    ...SLATE,
    tex: all("polished_deepslate"),
  }),
  block({ name: "deepslate_bricks", ...SLATE, tex: all("deepslate_bricks") }),
  block({ name: "deepslate_tiles", ...SLATE, tex: all("deepslate_tiles") }),
  // рама древнего города: не ломается ничем разумным и не роняет себя
  block({
    name: "reinforced_deepslate",
    hardness: 55,
    resistance: 1200,
    drops: [],
    tex: {
      top: "reinforced_deepslate_top",
      side: "reinforced_deepslate_side",
      bottom: "reinforced_deepslate_top",
    },
    mapColor: 0x3a3a3e,
  }),
];

addNames({
  sculk: "Скалк",
  sculk_vein: "Прожилки скалка",
  sculk_catalyst: "Катализатор скалка",
  sculk_sensor: "Сенсор скалка",
  sculk_sensor_on: "Сенсор скалка",
  sculk_shrieker: "Крикун скалка",
  polished_deepslate: "Полированный глубинный сланец",
  deepslate_bricks: "Глубинносланцевые кирпичи",
  deepslate_tiles: "Глубинносланцевая плитка",
  reinforced_deepslate: "Укреплённый глубинный сланец",
  ancient_city: "Древний город",
});
