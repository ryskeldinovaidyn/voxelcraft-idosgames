// Животные, которых приручают, как в Minecraft: волк (кость), кошка (сырая рыба), лошадь (садиться,
// пока не смирится; ездят в седле). Части «tame*» видны только у ручного (ошейник), «saddle*» — у
// осёдланного. Поведение ручных — petThink в entities/MobBrain.ts.
import type { MobDef, MobPart, Vec3 } from "../../types";

/** Четыре ноги: диагональные пары шагают вместе. */
function legs(
  w: number,
  h: number,
  x: number,
  zFront: number,
  zBack: number,
  color: string,
): MobPart[] {
  const leg = (
    name: string,
    lx: number,
    z: number,
    anim: "legL" | "legR",
  ): MobPart => ({
    name,
    size: [w, h, w],
    pos: [lx, h / 2, z],
    pivot: [lx, h, z],
    anim,
    color,
  });
  return [
    leg("legFL", -x, zFront, "legL"),
    leg("legFR", x, zFront, "legR"),
    leg("legBL", -x, zBack, "legR"),
    leg("legBR", x, zBack, "legL"),
  ];
}

const HEAD = (pivot: Vec3) => ({ pivot, anim: "head" as const });
const WOLF = "#d8d4cc";
const CAT = "#d8913a";
const HORSE = "#8a5a30";

export const TAME_MOBS: Record<string, MobDef> = {
  wolf: {
    name: "wolf",
    category: "neutral",
    hp: 20,
    walkSpeed: 1.6,
    fleeSpeed: 3,
    chaseSpeed: 3.2,
    follow: 16,
    box: { w: 0.6, h: 0.85 },
    attack: { damage: 4, reach: 1.1, cooldown: 1 },
    groupAnger: true,
    tameItems: ["bone"],
    guards: true,
    wearsArmor: true,
    spawn: {
      light: "bright",
      ground: ["grass", "snow"],
      weight: 3,
      group: [2, 4],
    },
    drops: [],
    xp: [1, 3],
    eye: 0.8,
    parts: [
      { name: "body", size: [6, 6, 9], pos: [0, 10, 1], color: WOLF },
      { name: "mane", size: [7, 7, 4], pos: [0, 10.5, -3], color: "#c8c4bc" },
      {
        name: "head",
        size: [6, 6, 4],
        pos: [0, 12, -7],
        ...HEAD([0, 12, -5]),
        color: WOLF,
      },
      {
        name: "snout",
        size: [3, 3, 3],
        pos: [0, 10.5, -10],
        ...HEAD([0, 12, -5]),
        color: "#b8b4ac",
      },
      {
        name: "nose",
        size: [1, 1, 0.4],
        pos: [0, 11.5, -11.6],
        ...HEAD([0, 12, -5]),
        color: "#1a1a1a",
      },
      {
        name: "earL",
        size: [2, 2, 1],
        pos: [-2, 16, -7],
        ...HEAD([0, 12, -5]),
        color: WOLF,
      },
      {
        name: "earR",
        size: [2, 2, 1],
        pos: [2, 16, -7],
        ...HEAD([0, 12, -5]),
        color: WOLF,
      },
      {
        name: "tail",
        size: [2, 2, 7],
        pos: [0, 11, 8],
        pivot: [0, 12, 5],
        pose: [0.5, 0, 0],
        color: WOLF,
      },
      // броня из щитков броненосца — видна, пока надета (Mob.wolfArmor)
      {
        name: "armorBody",
        size: [7, 7, 10],
        pos: [0, 10, 1],
        color: "#9a7a62",
      },
      {
        name: "tameCollar",
        size: [7.2, 1.5, 4.6],
        pos: [0, 9.5, -5],
        ...HEAD([0, 12, -5]),
        color: "#c82020",
      },
      ...legs(2, 7, 2, -2, 4, WOLF),
    ],
  },

  cat: {
    name: "cat",
    category: "passive",
    hp: 10,
    walkSpeed: 1.6,
    fleeSpeed: 3.4,
    box: { w: 0.6, h: 0.7 },
    tameItems: ["cod", "salmon"],
    scaresBombers: true,
    drops: [{ item: "string", n: 0, max: 2 }],
    xp: [1, 3],
    parts: [
      { name: "body", size: [4, 4, 12], pos: [0, 6, 1], color: CAT },
      {
        name: "stripes",
        size: [4.2, 1, 12.2],
        pos: [0, 7.6, 1],
        color: "#a86a28",
      },
      {
        name: "head",
        size: [5, 4, 5],
        pos: [0, 8, -7],
        ...HEAD([0, 8, -5]),
        color: CAT,
      },
      {
        name: "earL",
        size: [1, 1.5, 1],
        pos: [-1.5, 10.5, -7],
        ...HEAD([0, 8, -5]),
        color: CAT,
      },
      {
        name: "earR",
        size: [1, 1.5, 1],
        pos: [1.5, 10.5, -7],
        ...HEAD([0, 8, -5]),
        color: CAT,
      },
      {
        name: "eyeL",
        size: [1, 1, 0.4],
        pos: [-1.2, 8.5, -9.6],
        ...HEAD([0, 8, -5]),
        color: "#40a040",
      },
      {
        name: "eyeR",
        size: [1, 1, 0.4],
        pos: [1.2, 8.5, -9.6],
        ...HEAD([0, 8, -5]),
        color: "#40a040",
      },
      {
        name: "tail",
        size: [1, 1, 8],
        pos: [0, 8, 10],
        pivot: [0, 7, 7],
        pose: [0.7, 0, 0],
        color: CAT,
      },
      {
        name: "tameCollar",
        size: [5.4, 1, 5.4],
        pos: [0, 6.3, -7],
        ...HEAD([0, 8, -5]),
        color: "#2050c8",
      },
      ...legs(1, 4, 1.2, -3, 5, CAT),
    ],
  },

  horse: {
    name: "horse",
    category: "passive",
    hp: 22,
    walkSpeed: 1.4,
    fleeSpeed: 3.5,
    box: { w: 1.3, h: 1.6 },
    rideable: { seat: 1.15, speed: 7 },
    mates: { donkey: "mule" },
    tameChance: 0.3,
    temptItems: ["wheat", "apple", "golden_carrot"],
    spawn: { light: "bright", ground: ["grass"], weight: 4, group: [2, 4] },
    drops: [{ item: "leather", n: 0, max: 2 }],
    xp: [1, 3],
    eye: 0.9,
    parts: [
      { name: "body", size: [10, 10, 18], pos: [0, 17, 1], color: HORSE },
      {
        name: "neck",
        size: [4, 10, 6],
        pos: [0, 24, -8],
        pivot: [0, 20, -7],
        pose: [0.45, 0, 0],
        color: HORSE,
      },
      {
        name: "head",
        size: [5, 5, 10],
        pos: [0, 29, -12],
        ...HEAD([0, 26, -9]),
        color: HORSE,
      },
      {
        name: "mane",
        size: [1.2, 9, 6],
        pos: [0, 26, -6],
        pivot: [0, 20, -7],
        pose: [0.45, 0, 0],
        color: "#3a2410",
      },
      {
        name: "earL",
        size: [1, 2, 1],
        pos: [-1.5, 32.5, -9],
        ...HEAD([0, 26, -9]),
        color: HORSE,
      },
      {
        name: "earR",
        size: [1, 2, 1],
        pos: [1.5, 32.5, -9],
        ...HEAD([0, 26, -9]),
        color: HORSE,
      },
      {
        name: "tail",
        size: [3, 10, 3],
        pos: [0, 16, 11],
        pivot: [0, 21, 10],
        pose: [0.35, 0, 0],
        color: "#3a2410",
      },
      {
        name: "saddle",
        size: [10.4, 2, 8],
        pos: [0, 22.5, 0],
        color: "#5a3a20",
      },
      {
        name: "saddleSeat",
        size: [6, 1, 6],
        pos: [0, 23.8, 0.5],
        color: "#3a2410",
      },
      ...legs(4, 12, 3.5, -6, 8, HORSE),
    ],
  },
};
