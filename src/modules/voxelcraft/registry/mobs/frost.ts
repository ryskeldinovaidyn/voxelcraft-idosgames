// Мобы снегов и пустынь: кадавр (зомби пустыни — не горит на солнце, насылает Голод), зимогор (скелет
// снегов — стрелы замедляют), белый медведь (нейтрален, пока не ударят), снеговик (собирает игрок —
// entities/SnowGolemBrain) и летучая мышь (мирная, летает в тёмных пещерах).
import type { MobDef, MobPart } from "../../types";
import { addNames } from "../names";
import { HOSTILE_MOBS, humanoid } from "./hostile";

const zombie = HOSTILE_MOBS.zombie!;
const skeleton = HOSTILE_MOBS.skeleton!;
const NIGHT = { light: "dark", dimension: "overworld" } as const;

const BEAR = "#f0f0ea";
const BEAR_HEAD = {
  pivot: [0, 20, -11] as [number, number, number],
  anim: "head" as const,
};
const bearParts: MobPart[] = [
  { name: "body", size: [14, 13, 24], pos: [0, 16.5, 0], color: BEAR },
  ...[-1, 1].flatMap((sx): MobPart[] =>
    [-1, 1].map((sz): MobPart => ({
      name: `leg${sz < 0 ? "F" : "B"}${sx < 0 ? "L" : "R"}`,
      size: [6, 10, 6],
      pos: [sx * 4, 5, sz * 8],
      pivot: [sx * 4, 10, sz * 8],
      anim: sx < 0 === sz < 0 ? "legL" : "legR",
      color: "#e4e4dc",
    })),
  ),
  {
    name: "head",
    size: [8, 8, 7],
    pos: [0, 21, -15],
    ...BEAR_HEAD,
    color: BEAR,
  },
  {
    name: "snout",
    size: [4, 3, 3],
    pos: [0, 19.5, -20],
    ...BEAR_HEAD,
    color: "#e0e0d6",
  },
  {
    name: "nose",
    size: [2, 1, 0.4],
    pos: [0, 20.5, -21.6],
    ...BEAR_HEAD,
    color: "#1a1a1a",
  },
  {
    name: "earL",
    size: [2, 2, 1],
    pos: [-3, 26, -13],
    ...BEAR_HEAD,
    color: BEAR,
  },
  {
    name: "earR",
    size: [2, 2, 1],
    pos: [3, 26, -13],
    ...BEAR_HEAD,
    color: BEAR,
  },
  {
    name: "eyeL",
    size: [1, 1, 0.4],
    pos: [-2, 23, -18.6],
    ...BEAR_HEAD,
    color: "#1a1a1a",
  },
  {
    name: "eyeR",
    size: [1, 1, 0.4],
    pos: [2, 23, -18.6],
    ...BEAR_HEAD,
    color: "#1a1a1a",
  },
];

const BAT = "#3a2a20";
const batParts: MobPart[] = [
  { name: "body", size: [3, 6, 3], pos: [0, 8, 0], color: BAT },
  {
    name: "head",
    size: [5, 5, 5],
    pos: [0, 13.5, 0],
    pivot: [0, 11, 0],
    anim: "head",
    color: BAT,
  },
  {
    name: "earL",
    size: [1, 2, 1],
    pos: [-1.5, 17, 0],
    pivot: [0, 11, 0],
    anim: "head",
    color: BAT,
  },
  {
    name: "earR",
    size: [1, 2, 1],
    pos: [1.5, 17, 0],
    pivot: [0, 11, 0],
    anim: "head",
    color: BAT,
  },
  {
    name: "wingL",
    size: [8, 6, 0.5],
    pos: [-5.5, 9, 0],
    pivot: [-1.5, 10, 0],
    anim: "wingL",
    color: "#2a1e18",
  },
  {
    name: "wingR",
    size: [8, 6, 0.5],
    pos: [5.5, 9, 0],
    pivot: [1.5, 10, 0],
    anim: "wingR",
    color: "#2a1e18",
  },
];

const SNOW = "#f4f8fa";
const GOLEM_HEAD = {
  pivot: [0, 20, 0] as [number, number, number],
  anim: "head" as const,
};
const golemParts: MobPart[] = [
  { name: "lower", size: [12, 10, 12], pos: [0, 5, 0], color: SNOW },
  { name: "upper", size: [10, 10, 10], pos: [0, 15, 0], color: SNOW },
  {
    name: "head",
    size: [8, 8, 8],
    pos: [0, 24, 0],
    ...GOLEM_HEAD,
    color: "#e08a1a",
  },
  {
    name: "eyeL",
    size: [2, 2, 0.4],
    pos: [-2, 25.5, -4.2],
    ...GOLEM_HEAD,
    color: "#3a1a0a",
  },
  {
    name: "eyeR",
    size: [2, 2, 0.4],
    pos: [2, 25.5, -4.2],
    ...GOLEM_HEAD,
    color: "#3a1a0a",
  },
  {
    name: "mouth",
    size: [5, 1, 0.4],
    pos: [0, 22, -4.2],
    ...GOLEM_HEAD,
    color: "#3a1a0a",
  },
  {
    name: "armL",
    size: [1, 10, 1],
    pos: [-8, 16, 0],
    pivot: [-5, 18, 0],
    anim: "armL",
    color: "#6a4a2a",
    pose: [0, 0, -1.1],
  },
  {
    name: "armR",
    size: [1, 10, 1],
    pos: [8, 16, 0],
    pivot: [5, 18, 0],
    anim: "armR",
    color: "#6a4a2a",
    pose: [0, 0, 1.1],
  },
];

export const FROST_MOBS: Record<string, MobDef> = {
  husk: {
    ...zombie,
    name: "husk",
    burnsInSun: false,
    attack: {
      damage: 3,
      reach: 1.2,
      cooldown: 1,
      effect: { id: "hunger", seconds: 7 },
    },
    spawn: { ...NIGHT, biomes: ["desert"], weight: 80, group: [1, 3] },
    parts: humanoid({
      skin: "#a89060",
      shirt: "#6a5a3a",
      pants: "#5a4a30",
      eyes: "#2a1e10",
      armPose: [1.45, 0, 0],
    }),
  },
  stray: {
    ...skeleton,
    name: "stray",
    ranged: {
      damage: 3,
      speed: 32,
      cooldown: 2,
      range: 15,
      effect: { id: "slowness", seconds: 30 },
    },
    spawn: { ...NIGHT, biomes: ["snowy"], weight: 80, group: [1, 3] },
    parts: humanoid({
      skin: "#b8c8c8",
      shirt: "#7a8a8e",
      pants: "#8a9a9e",
      eyes: "#1a2a2a",
      limb: 2,
      armPose: [1.3, 0.15, 0],
    }),
  },
  polar_bear: {
    name: "polar_bear",
    category: "neutral",
    hp: 30,
    walkSpeed: 1.2,
    fleeSpeed: 2.5,
    chaseSpeed: 2.6,
    follow: 16,
    box: { w: 1.4, h: 1.4 },
    attack: { damage: 6, reach: 1.4, cooldown: 1.2 },
    spawn: {
      light: "bright",
      ground: ["snow", "ice"],
      biomes: ["snowy"],
      weight: 3,
      group: [1, 2],
    },
    drops: [
      { item: "cod", n: 0, max: 2 },
      { item: "salmon", n: 0, max: 1, chance: 0.25 },
    ],
    xp: [1, 3],
    eye: 0.8,
    parts: bearParts,
  },
  snow_golem: {
    name: "snow_golem",
    category: "passive",
    hp: 4,
    walkSpeed: 1.2,
    fleeSpeed: 1.5,
    box: { w: 0.7, h: 1.9 },
    throwsSnow: true,
    persistent: true,
    drops: [{ item: "snowball", n: 0, max: 15 }],
    xp: [0, 0],
    parts: golemParts,
  },
  bat: {
    name: "bat",
    category: "passive",
    hp: 6,
    walkSpeed: 2.2,
    fleeSpeed: 3,
    box: { w: 0.5, h: 0.9 },
    flies: { height: 2 },
    spawn: {
      light: "dark",
      dimension: "overworld",
      medium: "air",
      underground: true,
      weight: 10,
      group: [1, 3],
    },
    drops: [],
    xp: [0, 0],
    eye: 0.7,
    parts: batParts,
  },
};

addNames({
  husk: "Кадавр",
  stray: "Зимогор",
  polar_bear: "Белый медведь",
  snow_golem: "Снеговик",
  bat: "Летучая мышь",
});
