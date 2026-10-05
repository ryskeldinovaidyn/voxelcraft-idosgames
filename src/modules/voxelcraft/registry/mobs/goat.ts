// Коза: живёт в горах и снегах, высоко прыгает, иногда таранит игрока (entities/GoatBrain), доится
// ведром, идёт за пшеницей и размножается от неё.
import type { MobDef } from "../../types";

const FUR = "#e8e4dc";
const HORN = "#b0a890";
const HEAD = {
  pivot: [0, 15, -6] as [number, number, number],
  anim: "head" as const,
};

export const GOAT_MOBS: Record<string, MobDef> = {
  goat: {
    name: "goat",
    category: "passive",
    hp: 10,
    walkSpeed: 1.3,
    fleeSpeed: 2.6,
    box: { w: 0.9, h: 1.3 },
    rams: true,
    temptItems: ["wheat"],
    drops: [],
    xp: [1, 3],
    spawn: {
      light: "bright",
      ground: ["grass", "snow", "stone"],
      biomes: ["mountains", "snowy"],
      weight: 10,
      group: [2, 3],
    },
    parts: [
      { name: "body", size: [8, 7, 13], pos: [0, 11.5, 0], color: FUR },
      {
        name: "legFL",
        size: [3, 8, 3],
        pos: [-2.5, 4, -4.5],
        pivot: [-2.5, 8, -4.5],
        anim: "legL",
        color: FUR,
      },
      {
        name: "legFR",
        size: [3, 8, 3],
        pos: [2.5, 4, -4.5],
        pivot: [2.5, 8, -4.5],
        anim: "legR",
        color: FUR,
      },
      {
        name: "legBL",
        size: [3, 8, 3],
        pos: [-2.5, 4, 4.5],
        pivot: [-2.5, 8, 4.5],
        anim: "legR",
        color: FUR,
      },
      {
        name: "legBR",
        size: [3, 8, 3],
        pos: [2.5, 4, 4.5],
        pivot: [2.5, 8, 4.5],
        anim: "legL",
        color: FUR,
      },
      { name: "head", size: [5, 6, 8], pos: [0, 17, -8], ...HEAD, color: FUR },
      {
        name: "hornL",
        size: [1, 5, 1],
        pos: [-1.5, 21.5, -6],
        ...HEAD,
        color: HORN,
      },
      {
        name: "hornR",
        size: [1, 5, 1],
        pos: [1.5, 21.5, -6],
        ...HEAD,
        color: HORN,
      },
      { name: "earL", size: [3, 1, 2], pos: [-4, 19, -7], ...HEAD, color: FUR },
      { name: "earR", size: [3, 1, 2], pos: [4, 19, -7], ...HEAD, color: FUR },
      {
        name: "beard",
        size: [2, 3, 1],
        pos: [0, 13, -11.5],
        ...HEAD,
        color: "#d8d0c0",
      },
      {
        name: "eyeL",
        size: [0.4, 1, 1],
        pos: [-2.7, 18, -10],
        ...HEAD,
        color: "#c8a020",
      },
      {
        name: "eyeR",
        size: [0.4, 1, 1],
        pos: [2.7, 18, -10],
        ...HEAD,
        color: "#c8a020",
      },
    ],
  },
};
