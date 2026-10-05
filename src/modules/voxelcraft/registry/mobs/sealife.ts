// Рыбы: треска и лосось — в обычном океане, тропическая рыба и иглобрюх — в тёплом (spawn.biomes).
// Плавают стайками в толще (swims), на суше задыхаются (needsWater). Иглобрюх раздувается рядом с
// игроком и отравляет касанием (entities/FishBrain).
import type { MobDef, MobPart } from "../../types";

const SEA = { light: "bright", medium: "water" } as const;

/** Рыба: тело w×h×len, хвост машет (anim head). */
function fish(
  w: number,
  h: number,
  len: number,
  body: string,
  fin: string,
  extra: MobPart[] = [],
): MobPart[] {
  return [
    { name: "body", size: [w, h, len], pos: [0, h / 2, 0], color: body },
    {
      name: "tail",
      size: [0.6, h, 3],
      pos: [0, h / 2, len / 2 + 1.5],
      pivot: [0, h / 2, len / 2],
      anim: "head",
      color: fin,
    },
    {
      name: "eyeL",
      size: [0.4, 1, 1],
      pos: [-w / 2 - 0.2, h * 0.6, -len / 2 + 1.5],
      color: "#101010",
    },
    {
      name: "eyeR",
      size: [0.4, 1, 1],
      pos: [w / 2 + 0.2, h * 0.6, -len / 2 + 1.5],
      color: "#101010",
    },
    ...extra,
  ];
}

const base: Pick<MobDef, "category" | "swims" | "needsWater" | "xp"> = {
  category: "passive",
  swims: true,
  needsWater: true,
  xp: [1, 3],
};

export const SEA_LIFE_MOBS: Record<string, MobDef> = {
  cod: {
    ...base,
    name: "cod",
    hp: 3,
    walkSpeed: 1.5,
    fleeSpeed: 3.5,
    box: { w: 0.5, h: 0.3 },
    spawn: { ...SEA, biomes: ["ocean"], weight: 10, group: [3, 6] },
    drops: [
      { item: "cod", n: 1 },
      { item: "bone_meal", n: 1, chance: 0.05 },
    ],
    parts: fish(2, 4, 8, "#b09a6a", "#8a7a4a"),
  },
  salmon: {
    ...base,
    name: "salmon",
    hp: 3,
    walkSpeed: 1.8,
    fleeSpeed: 4,
    box: { w: 0.7, h: 0.4 },
    spawn: { ...SEA, biomes: ["ocean"], weight: 5, group: [1, 5] },
    drops: [
      { item: "salmon", n: 1 },
      { item: "bone_meal", n: 1, chance: 0.05 },
    ],
    parts: fish(3, 5, 12, "#b05040", "#6a3a2a"),
  },
  tropical_fish: {
    ...base,
    name: "tropical_fish",
    hp: 3,
    walkSpeed: 1.5,
    fleeSpeed: 3.5,
    box: { w: 0.5, h: 0.4 },
    spawn: { ...SEA, biomes: ["warm_ocean"], weight: 25, group: [4, 8] },
    drops: [
      { item: "tropical_fish", n: 1 },
      { item: "bone_meal", n: 1, chance: 0.05 },
    ],
    parts: fish(1.5, 5, 6, "#f08a2a", "#f0f0f0", [
      {
        name: "stripe",
        size: [1.7, 5.2, 1],
        pos: [0, 2.5, 0],
        color: "#f0f0f0",
      },
    ]),
  },
  pufferfish: {
    ...base,
    name: "pufferfish",
    hp: 3,
    walkSpeed: 1,
    fleeSpeed: 2,
    box: { w: 0.7, h: 0.7 },
    puffs: true,
    spawn: { ...SEA, biomes: ["warm_ocean"], weight: 5, group: [1, 3] },
    drops: [
      { item: "pufferfish", n: 1 },
      { item: "bone_meal", n: 1, chance: 0.05 },
    ],
    parts: fish(5, 5, 5, "#e0c040", "#c8a030", [
      { name: "spineT", size: [1, 2, 1], pos: [0, 6, 0], color: "#8a6a2a" },
      {
        name: "spineL",
        size: [2, 1, 1],
        pos: [-3.5, 2.5, 0],
        color: "#8a6a2a",
      },
      { name: "spineR", size: [2, 1, 1], pos: [3.5, 2.5, 0], color: "#8a6a2a" },
    ]),
  },
};
