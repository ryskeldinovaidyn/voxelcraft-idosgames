// Животные джунглей: панда (ленивая, приманивается и размножается бамбуком, роняет бамбук), попугай
// (летает, приручается семенами) и оцелот (пугливый — убегает от игрока без рыбы в руке, Шипуны его
// боятся). Названия — registry/names.ts.
import type { MobDef, MobPart, Vec3 } from "../../types";
import { addNames } from "../names";
import { TAME_MOBS } from "./tame";

const HEAD = (pivot: Vec3) => ({ pivot, anim: "head" as const });
const WHITE = "#f0f0ea";
const BLACK = "#1e1e22";

const pandaParts: MobPart[] = [
  { name: "body", size: [13, 11, 19], pos: [0, 14.5, 1], color: WHITE },
  { name: "band", size: [13.4, 11.4, 6], pos: [0, 14.5, -5], color: BLACK },
  ...[-1, 1].flatMap((sx): MobPart[] =>
    [-1, 1].map((sz): MobPart => ({
      name: `leg${sz < 0 ? "F" : "B"}${sx < 0 ? "L" : "R"}`,
      size: [5, 9, 5],
      pos: [sx * 4, 4.5, sz * 6],
      pivot: [sx * 4, 9, sz * 6],
      anim: sx < 0 === sz < 0 ? "legL" : "legR",
      color: BLACK,
    })),
  ),
  {
    name: "head",
    size: [10, 9, 8],
    pos: [0, 16, -13],
    ...HEAD([0, 15, -9]),
    color: WHITE,
  },
  {
    name: "earL",
    size: [3, 3, 1],
    pos: [-4, 21.5, -12],
    ...HEAD([0, 15, -9]),
    color: BLACK,
  },
  {
    name: "earR",
    size: [3, 3, 1],
    pos: [4, 21.5, -12],
    ...HEAD([0, 15, -9]),
    color: BLACK,
  },
  {
    name: "patchL",
    size: [3, 3, 0.4],
    pos: [-2.5, 17, -17.2],
    ...HEAD([0, 15, -9]),
    color: BLACK,
  },
  {
    name: "patchR",
    size: [3, 3, 0.4],
    pos: [2.5, 17, -17.2],
    ...HEAD([0, 15, -9]),
    color: BLACK,
  },
  {
    name: "nose",
    size: [3, 2, 1],
    pos: [0, 14, -17.5],
    ...HEAD([0, 15, -9]),
    color: BLACK,
  },
];

const RED = "#d82a1e";
const parrotParts: MobPart[] = [
  {
    name: "body",
    size: [3, 6, 3],
    pos: [0, 7, 0],
    pose: [0.3, 0, 0],
    color: RED,
  },
  {
    name: "head",
    size: [3, 3, 3],
    pos: [0, 11.5, -0.8],
    ...HEAD([0, 10, 0]),
    color: RED,
  },
  {
    name: "beak",
    size: [1, 2, 1],
    pos: [0, 11, -2.8],
    ...HEAD([0, 10, 0]),
    color: "#3a3a3a",
  },
  {
    name: "eyeL",
    size: [0.4, 1, 1],
    pos: [-1.6, 12, -1.2],
    ...HEAD([0, 10, 0]),
    color: "#f0f0f0",
  },
  {
    name: "eyeR",
    size: [0.4, 1, 1],
    pos: [1.6, 12, -1.2],
    ...HEAD([0, 10, 0]),
    color: "#f0f0f0",
  },
  {
    name: "wingL",
    size: [1, 5, 3],
    pos: [-2, 7.5, 0],
    pivot: [-1.5, 9.5, 0],
    anim: "wingL",
    color: "#2a5ad0",
  },
  {
    name: "wingR",
    size: [1, 5, 3],
    pos: [2, 7.5, 0],
    pivot: [1.5, 9.5, 0],
    anim: "wingR",
    color: "#2a5ad0",
  },
  {
    name: "tail",
    size: [2, 4, 1],
    pos: [0, 3.5, 1.8],
    pose: [0.4, 0, 0],
    color: "#e8c020",
  },
  {
    name: "legL",
    size: [1, 2, 1],
    pos: [-1, 1, 0],
    pivot: [-1, 2, 0],
    anim: "legL",
    color: "#3a3a3a",
  },
  {
    name: "legR",
    size: [1, 2, 1],
    pos: [1, 1, 0],
    pivot: [1, 2, 0],
    anim: "legR",
    color: "#3a3a3a",
  },
];

/** Оцелот — кошачий риг (registry/mobs/tame) в жёлтой шкуре с пятнами, без ошейника. */
const ocelotParts: MobPart[] = TAME_MOBS.cat!.parts.filter(
  (p) => !p.name.startsWith("tame"),
).map((p) => ({
  ...p,
  color:
    p.name === "stripes"
      ? "#6a4a20"
      : p.color === "#d8913a"
        ? "#e8c050"
        : p.color,
}));

const JUNGLE = {
  light: "bright",
  ground: ["grass"],
  biomes: ["jungle"],
} as const;

export const JUNGLE_MOBS: Record<string, MobDef> = {
  panda: {
    name: "panda",
    category: "passive",
    hp: 20,
    walkSpeed: 0.9,
    fleeSpeed: 1.8,
    box: { w: 1.3, h: 1.25 },
    temptItems: ["bamboo"],
    spawn: { ...JUNGLE, weight: 4, group: [1, 2] },
    drops: [{ item: "bamboo", n: 0, max: 2 }],
    xp: [1, 3],
    eye: 0.8,
    parts: pandaParts,
  },
  parrot: {
    name: "parrot",
    category: "passive",
    hp: 6,
    walkSpeed: 1.4,
    fleeSpeed: 2.6,
    box: { w: 0.5, h: 0.9 },
    flies: { height: 1.5 },
    shoulderPet: true,
    tameItems: [
      "wheat_seeds",
      "melon_seeds",
      "pumpkin_seeds",
      "beetroot_seeds",
    ],
    spawn: { ...JUNGLE, weight: 10, group: [1, 2] },
    drops: [{ item: "feather", n: 1, max: 2 }],
    xp: [1, 3],
    eye: 0.8,
    parts: parrotParts,
  },
  ocelot: {
    name: "ocelot",
    category: "passive",
    hp: 10,
    walkSpeed: 1.6,
    fleeSpeed: 3.6,
    box: { w: 0.6, h: 0.7 },
    shy: true,
    temptItems: ["cod", "salmon"],
    scaresBombers: true,
    spawn: { ...JUNGLE, weight: 3, group: [1, 2] },
    drops: [],
    xp: [1, 3],
    parts: ocelotParts,
  },
};

addNames({ panda: "Панда", parrot: "Попугай", ocelot: "Оцелот" });
