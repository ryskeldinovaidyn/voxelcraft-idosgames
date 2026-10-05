// Аксолотль: живёт в озёрах пышных пещер (spawn.underground + nearBlock мох), в воде охотится на
// рыб и подводных врагов (hunts), на суше ходит 5 минут, потом сохнет (dryTime). Ловится ведром воды.
import type { MobDef } from "../../types";

const PINK = "#f0a8c8";
const GILL = "#d0507a";
const H = {
  pivot: [0, 3, -4] as [number, number, number],
  anim: "head" as const,
};

export const CAVE_MOBS: Record<string, MobDef> = {
  axolotl: {
    name: "axolotl",
    category: "passive",
    hp: 14,
    walkSpeed: 1.2,
    fleeSpeed: 2.5,
    chaseSpeed: 2.8,
    box: { w: 0.75, h: 0.42 },
    attack: { damage: 2, reach: 0.8, cooldown: 1 },
    swims: true,
    needsWater: true,
    dryTime: 300,
    hunts: [
      "cod",
      "salmon",
      "tropical_fish",
      "pufferfish",
      "drowned",
      "deepling",
    ],
    spawn: {
      light: "any",
      medium: "water",
      underground: true,
      nearBlock: "moss_block",
      weight: 10,
      group: [1, 4],
    },
    drops: [],
    xp: [1, 3],
    parts: [
      { name: "body", size: [4, 3, 8], pos: [0, 2, 0], color: PINK },
      { name: "head", size: [8, 5, 5], pos: [0, 3, -6.5], ...H, color: PINK },
      {
        name: "eyeL",
        size: [0.4, 1, 1],
        pos: [-4.1, 3.5, -7.5],
        ...H,
        color: "#101010",
      },
      {
        name: "eyeR",
        size: [0.4, 1, 1],
        pos: [4.1, 3.5, -7.5],
        ...H,
        color: "#101010",
      },
      {
        name: "gillL",
        size: [1, 4, 1],
        pos: [-4.5, 5, -5.5],
        ...H,
        color: GILL,
      },
      {
        name: "gillR",
        size: [1, 4, 1],
        pos: [4.5, 5, -5.5],
        ...H,
        color: GILL,
      },
      { name: "gillT", size: [6, 1, 1], pos: [0, 6, -5.5], ...H, color: GILL },
      {
        name: "tail",
        size: [0.6, 4, 7],
        pos: [0, 2.5, 7.5],
        pivot: [0, 2.5, 4],
        anim: "head",
        color: PINK,
      },
      {
        name: "legFL",
        size: [3, 1, 1],
        pos: [-3.5, 1, -2.5],
        pivot: [-2, 1, -2.5],
        anim: "legL",
        color: PINK,
      },
      {
        name: "legFR",
        size: [3, 1, 1],
        pos: [3.5, 1, -2.5],
        pivot: [2, 1, -2.5],
        anim: "legR",
        color: PINK,
      },
      {
        name: "legBL",
        size: [3, 1, 1],
        pos: [-3.5, 1, 2.5],
        pivot: [-2, 1, 2.5],
        anim: "legR",
        color: PINK,
      },
      {
        name: "legBR",
        size: [3, 1, 1],
        pos: [3.5, 1, 2.5],
        pivot: [2, 1, 2.5],
        anim: "legL",
        color: PINK,
      },
    ],
  },
};
