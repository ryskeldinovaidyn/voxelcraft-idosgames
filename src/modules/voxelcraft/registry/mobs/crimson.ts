// Жители Пекла, второй набор: свинорыл (не трогает игрока в золотой броне, ПКМ золотым слитком —
// бартер), громила-свинорыл (всегда враждебен, в адской крепости — бастионов у нас нет), хоглин
// (таранит и отбрасывает), зоглин (хоглин вне Пекла) и страйдер (ходит по лавовому морю, седлается без
// приручения). Вне Пекла свинорылы и хоглины через 15 с превращаются (MobDef.zombifies).
import type { MobDef, MobPart, Vec3 } from "../../types";
import { addNames } from "../names";
import { humanoid } from "./hostile";

const INFERNO_GROUND = [
  "infernal_stone",
  "soul_sand",
  "soul_soil",
  "gravel",
  "magma_block",
  "crimson_nylium",
  "warped_nylium",
];
const HEAD = (pivot: Vec3) => ({ pivot, anim: "head" as const });

/** Рыло и уши свинорыла поверх человекоподобного рига. */
const hogHead = (skin: string): MobPart[] => [
  {
    name: "snout",
    size: [4, 3, 1],
    pos: [0, 26.5, -4.5],
    ...HEAD([0, 24, 0]),
    color: "#d08080",
  },
  {
    name: "nostrils",
    size: [2, 1, 0.4],
    pos: [0, 26.5, -5.1],
    ...HEAD([0, 24, 0]),
    color: "#6a3030",
  },
  {
    name: "earL",
    size: [1, 4, 3],
    pos: [-4.5, 28, 0],
    ...HEAD([0, 24, 0]),
    pose: [0, 0, 0.4],
    color: skin,
  },
  {
    name: "earR",
    size: [1, 4, 3],
    pos: [4.5, 28, 0],
    ...HEAD([0, 24, 0]),
    pose: [0, 0, -0.4],
    color: skin,
  },
];

/** Хоглин / зоглин: массивное тело, грива, голова с бивнями. */
const hoglinParts = (body: string, mane: string, legs: string): MobPart[] => [
  { name: "body", size: [16, 14, 24], pos: [0, 17, 0], color: body },
  { name: "mane", size: [2, 6, 18], pos: [0, 27, -1], color: mane },
  {
    name: "head",
    size: [12, 9, 12],
    pos: [0, 15, -17],
    ...HEAD([0, 16, -11]),
    color: body,
  },
  {
    name: "tuskL",
    size: [2, 5, 2],
    pos: [-5, 15, -23],
    ...HEAD([0, 16, -11]),
    color: "#f0e8d0",
  },
  {
    name: "tuskR",
    size: [2, 5, 2],
    pos: [5, 15, -23],
    ...HEAD([0, 16, -11]),
    color: "#f0e8d0",
  },
  {
    name: "earL",
    size: [5, 1, 3],
    pos: [-8, 18, -13],
    ...HEAD([0, 16, -11]),
    color: body,
  },
  {
    name: "earR",
    size: [5, 1, 3],
    pos: [8, 18, -13],
    ...HEAD([0, 16, -11]),
    color: body,
  },
  ...[-1, 1].flatMap((sx): MobPart[] =>
    [-1, 1].map((sz): MobPart => ({
      name: `leg${sz < 0 ? "F" : "B"}${sx < 0 ? "L" : "R"}`,
      size: [6, 10, 6],
      pos: [sx * 5, 5, sz * 7],
      pivot: [sx * 5, 10, sz * 7],
      anim: sx < 0 === sz < 0 ? "legL" : "legR",
      color: legs,
    })),
  ),
];

const hoglinBase = {
  hp: 40,
  walkSpeed: 1.2,
  fleeSpeed: 2.4,
  chaseSpeed: 2.6,
  follow: 16,
  box: { w: 1.4, h: 1.4 },
  attack: { damage: 6, reach: 1.4, cooldown: 1.5, knock: 14 },
  xp: [5, 5] as [number, number],
  eye: 0.6,
};

const STRIDER = "#a83a2a";

export const CRIMSON_MOBS: Record<string, MobDef> = {
  hogman: {
    name: "hogman",
    category: "hostile",
    hp: 16,
    walkSpeed: 1.2,
    fleeSpeed: 2.4,
    chaseSpeed: 2.5,
    follow: 16,
    box: { w: 0.6, h: 1.95 },
    attack: { damage: 5, reach: 1.2, cooldown: 1 },
    fireImmune: true,
    goldPeace: true,
    barters: true,
    zombifies: true,
    growsInto: "hogman_dead",
    growTime: 15,
    spawn: {
      light: "any",
      dimension: "inferno",
      ground: INFERNO_GROUND,
      biomes: ["wastes", "crimson_forest"],
      weight: 60,
      group: [2, 4],
    },
    drops: [{ item: "gold_nugget", n: 0, max: 2 }],
    xp: [5, 5],
    parts: [
      ...humanoid({
        skin: "#e8a0a0",
        shirt: "#8a6a3a",
        pants: "#5a4020",
        eyes: "#1a1a1a",
      }),
      ...hogHead("#e8a0a0"),
    ],
  },
  hogman_brute: {
    name: "hogman_brute",
    category: "hostile",
    hp: 50,
    walkSpeed: 1.3,
    fleeSpeed: 2.4,
    chaseSpeed: 2.6,
    follow: 16,
    box: { w: 0.6, h: 1.95 },
    attack: { damage: 13, reach: 1.3, cooldown: 1.2 },
    fireImmune: true,
    zombifies: true,
    growsInto: "hogman_dead",
    growTime: 15,
    spawn: {
      light: "any",
      dimension: "inferno",
      // дом громилы — бастион (worldgen/features/bastion), а не крепость, как в Minecraft
      structure: "bastion",
      weight: 10,
      group: [1, 1],
    },
    drops: [{ item: "golden_axe", n: 1, chance: 0.085 }],
    xp: [20, 20],
    parts: [
      ...humanoid({
        skin: "#d89090",
        shirt: "#2a2a2a",
        pants: "#3a2a1a",
        eyes: "#1a1a1a",
      }),
      ...hogHead("#d89090"),
      {
        name: "belt",
        size: [8.4, 1.5, 4.4],
        pos: [0, 13, 0],
        color: "#e8c030",
      },
    ],
  },
  hoglin: {
    name: "hoglin",
    category: "hostile",
    ...hoglinBase,
    fireImmune: true,
    zombifies: true,
    growsInto: "zoglin",
    growTime: 15,
    temptItems: ["crimson_fungus"],
    spawn: {
      light: "any",
      dimension: "inferno",
      ground: INFERNO_GROUND,
      biomes: ["crimson_forest"],
      weight: 30,
      group: [2, 3],
    },
    drops: [
      { item: "porkchop", n: 2, max: 4 },
      { item: "leather", n: 0, max: 1 },
    ],
    parts: hoglinParts("#b07050", "#d8a070", "#9a6040"),
  },
  zoglin: {
    name: "zoglin",
    category: "hostile",
    ...hoglinBase,
    fireImmune: true,
    drops: [{ item: "rotten_flesh", n: 1, max: 3 }],
    parts: hoglinParts("#8a9a7a", "#c8c8b0", "#7a8a6a"),
  },
  strider: {
    name: "strider",
    category: "passive",
    hp: 20,
    walkSpeed: 1,
    fleeSpeed: 1.6,
    box: { w: 0.9, h: 1.7 },
    fireImmune: true,
    walksOnLava: true,
    saddleOnly: true,
    temptItems: ["warped_fungus"],
    rideable: { seat: 1.8, speed: 3.5 },
    spawn: {
      light: "any",
      dimension: "inferno",
      medium: "lava",
      weight: 20,
      group: [1, 2],
    },
    drops: [{ item: "string", n: 2, max: 5 }],
    xp: [1, 3],
    eye: 0.75,
    parts: [
      { name: "body", size: [16, 14, 16], pos: [0, 21, 0], color: STRIDER },
      {
        name: "bristleF",
        size: [16, 5, 1],
        pos: [0, 30, -4],
        color: "#d8a048",
      },
      { name: "bristleB", size: [16, 5, 1], pos: [0, 30, 4], color: "#d8a048" },
      {
        name: "eyeL",
        size: [2, 2, 0.4],
        pos: [-4, 24, -8.2],
        color: "#1a1a1a",
      },
      { name: "eyeR", size: [2, 2, 0.4], pos: [4, 24, -8.2], color: "#1a1a1a" },
      {
        name: "legL",
        size: [4, 14, 4],
        pos: [-4, 7, 0],
        pivot: [-4, 14, 0],
        anim: "legL",
        color: "#5a2a2a",
      },
      {
        name: "legR",
        size: [4, 14, 4],
        pos: [4, 7, 0],
        pivot: [4, 14, 0],
        anim: "legR",
        color: "#5a2a2a",
      },
      {
        name: "saddle",
        size: [16.4, 2, 10],
        pos: [0, 28.5, 0],
        color: "#5a3a20",
      },
    ],
  },
};

addNames({
  hogman: "Свинорыл",
  hogman_brute: "Громила-свинорыл",
  hoglin: "Хоглин",
  zoglin: "Зоглин",
  strider: "Страйдер",
});
