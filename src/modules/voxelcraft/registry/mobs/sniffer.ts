// Нюхач (сам не появляется — вылупляется из яйца, найденного раскопками): медленный великан, иногда
// роет землю и выкапывает древние семена (entities/SnifferBrain); размножается от семян факелоцвета —
// откладывает яйцо. Верблюд: пустыни, ездовой под седлом (приручать не нужно), ест кактусы.
import type { MobDef, MobPart } from "../../types";

const FUR = "#8a3a2a";
const MOSS = "#4a7a3a";
const SAND = "#c8a060";

function legs(
  w: number,
  h: number,
  xs: number[],
  zs: number[],
  color: string,
): MobPart[] {
  const out: MobPart[] = [];
  let i = 0;
  for (const z of zs)
    for (const x of xs)
      out.push({
        name: `leg${i}`,
        size: [w, h, w],
        pos: [x, h / 2, z],
        pivot: [x, h, z],
        anim: i++ % 2 ? "legR" : "legL",
        color,
      });
  return out;
}

export const SNIFFER_MOBS: Record<string, MobDef> = {
  sniffer: {
    name: "sniffer",
    category: "passive",
    hp: 14,
    walkSpeed: 0.6,
    fleeSpeed: 1.2,
    box: { w: 1.9, h: 1.75 },
    temptItems: ["torchflower_seeds"],
    layEggs: "sniffer_egg",
    sniffs: true,
    drops: [],
    xp: [1, 3],
    parts: [
      { name: "body", size: [24, 14, 32], pos: [0, 15, 0], color: FUR },
      { name: "back", size: [24.4, 3, 30], pos: [0, 23, 0], color: MOSS },
      {
        name: "head",
        size: [14, 10, 10],
        pos: [0, 15, -20],
        pivot: [0, 15, -15],
        anim: "head",
        color: FUR,
      },
      {
        name: "nose",
        size: [8, 4, 4],
        pos: [0, 12, -26],
        pivot: [0, 15, -15],
        anim: "head",
        color: "#5a2a1a",
      },
      {
        name: "eyeL",
        size: [1, 2, 0.4],
        pos: [-4, 17, -25.2],
        pivot: [0, 15, -15],
        anim: "head",
        color: "#e8d040",
      },
      {
        name: "eyeR",
        size: [1, 2, 0.4],
        pos: [4, 17, -25.2],
        pivot: [0, 15, -15],
        anim: "head",
        color: "#e8d040",
      },
      ...legs(6, 8, [-9, 9], [-10, 0, 10], FUR),
    ],
  },
  camel: {
    name: "camel",
    category: "passive",
    hp: 32,
    walkSpeed: 1.2,
    fleeSpeed: 3,
    box: { w: 1.7, h: 2.375 },
    rideable: { seat: 1.9, speed: 6 },
    tameChance: 1,
    temptItems: ["cactus"],
    spawn: {
      light: "bright",
      ground: ["sand"],
      biomes: ["desert"],
      weight: 3,
      group: [1, 2],
    },
    drops: [],
    xp: [1, 3],
    eye: 0.95,
    parts: [
      { name: "body", size: [12, 12, 24], pos: [0, 26, 0], color: SAND },
      { name: "hump", size: [8, 6, 10], pos: [0, 35, 2], color: "#b88a50" },
      {
        name: "neck",
        size: [6, 14, 6],
        pos: [0, 32, -14],
        pivot: [0, 30, -12],
        anim: "head",
        color: SAND,
      },
      {
        name: "head",
        size: [6, 6, 10],
        pos: [0, 40, -18],
        pivot: [0, 30, -12],
        anim: "head",
        color: SAND,
      },
      {
        name: "eyeL",
        size: [0.4, 1, 1],
        pos: [-3.2, 41, -19],
        pivot: [0, 30, -12],
        anim: "head",
        color: "#2a1a10",
      },
      {
        name: "eyeR",
        size: [0.4, 1, 1],
        pos: [3.2, 41, -19],
        pivot: [0, 30, -12],
        anim: "head",
        color: "#2a1a10",
      },
      ...legs(4, 20, [-4, 4], [-8, 8], SAND),
    ],
  },
};
