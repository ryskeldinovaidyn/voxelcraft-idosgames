// Броненосец (Minecraft 1.20.5): живёт в саванне, сворачивается в панцирь, когда рядом бежит игрок или его
// ударили (MobDef.rollsUp — entities/MobBrain, Mob.hurt), сам сбрасывает щитки, щёткой — ещё щиток.
// Части «out*» — голова, уши, лапы, хвост: у свёрнутого не видны.
import type { MobDef, MobPart } from "../../types";
import { addNames } from "../names";

const SHELL = "#a86a5a";
const SKIN = "#d8a090";
const HEAD = {
  pivot: [0, 5, -4] as [number, number, number],
  anim: "head" as const,
};

const parts: MobPart[] = [
  { name: "shell", size: [7, 6, 10], pos: [0, 6, 0], color: SHELL },
  { name: "band1", size: [7.2, 6.2, 1], pos: [0, 6, -2], color: "#8a5046" },
  { name: "band2", size: [7.2, 6.2, 1], pos: [0, 6, 2], color: "#8a5046" },
  {
    name: "outHead",
    size: [3, 3, 4],
    pos: [0, 4.5, -6.5],
    ...HEAD,
    color: SKIN,
  },
  {
    name: "outEarL",
    size: [1, 2, 1],
    pos: [-1.2, 7, -5.5],
    ...HEAD,
    color: SKIN,
  },
  {
    name: "outEarR",
    size: [1, 2, 1],
    pos: [1.2, 7, -5.5],
    ...HEAD,
    color: SKIN,
  },
  { name: "outTail", size: [1, 1, 4], pos: [0, 3.5, 6.5], color: SHELL },
  ...[-1, 1].flatMap((sx): MobPart[] =>
    [-1, 1].map((sz): MobPart => ({
      name: `outLeg${sz < 0 ? "F" : "B"}${sx < 0 ? "L" : "R"}`,
      size: [2, 3, 2],
      pos: [sx * 2.5, 1.5, sz * 3],
      pivot: [sx * 2.5, 3, sz * 3],
      anim: sx < 0 === sz < 0 ? "legL" : "legR",
      color: SKIN,
    })),
  ),
];

export const ARMADILLO_MOBS: Record<string, MobDef> = {
  armadillo: {
    name: "armadillo",
    category: "passive",
    hp: 12,
    walkSpeed: 1.1,
    fleeSpeed: 2,
    box: { w: 0.7, h: 0.65 },
    rollsUp: true,
    temptItems: ["spider_eye"],
    spawn: {
      light: "bright",
      ground: ["grass"],
      biomes: ["savanna"],
      weight: 10,
      group: [1, 2],
    },
    drops: [],
    xp: [1, 3],
    eye: 0.7,
    parts,
  },
};

addNames({ armadillo: "Броненосец" });
