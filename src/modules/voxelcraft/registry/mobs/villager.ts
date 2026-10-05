// Жители: по мобу на профессию (villager_farmer…), профессия — в `trades`, сделки —
// systems/Trading.ts. Риг как в Minecraft: большая голова с носом, мантия, руки скрещены на груди;
// фартук — цвет профессии.
import type { MobDef, MobPart } from "../../types";
import { PROFESSIONS, type Profession } from "../../systems/Trading";

const APRON: Record<Profession, string> = {
  farmer: "#c8a040",
  librarian: "#e8e8e0",
  armorer: "#3a3a3a",
  toolsmith: "#7a4a2a",
  cleric: "#8a2a8a",
  butcher: "#d0d0d0",
  cartographer: "#c8b070",
  fisherman: "#5a8a9a",
  mason: "#b8b2a8",
  weaponsmith: "#5a5a62",
  shepherd: "#e8e0d0",
  fletcher: "#c8bc98",
  leatherworker: "#a0703a",
};

const SKIN = "#b8876a";
const ROBE = "#6a4a32";
const H = {
  pivot: [0, 24, 0] as [number, number, number],
  anim: "head" as const,
};

function villagerParts(apron: string): MobPart[] {
  return [
    { name: "head", size: [8, 10, 8], pos: [0, 29, 0], ...H, color: SKIN },
    { name: "nose", size: [2, 4, 2], pos: [0, 27, -5], ...H, color: "#a0705a" },
    {
      name: "eyeL",
      size: [1.5, 1, 0.4],
      pos: [-2, 30, -4.2],
      ...H,
      color: "#2a6a3a",
    },
    {
      name: "eyeR",
      size: [1.5, 1, 0.4],
      pos: [2, 30, -4.2],
      ...H,
      color: "#2a6a3a",
    },
    {
      name: "brow",
      size: [7, 1, 0.4],
      pos: [0, 31.5, -4.2],
      ...H,
      color: "#4a3020",
    },
    { name: "body", size: [8, 12, 6], pos: [0, 18, 0], color: ROBE },
    { name: "apron", size: [8.2, 9, 0.6], pos: [0, 16.5, -3.2], color: apron },
    { name: "arms", size: [8, 4, 4], pos: [0, 19, -4.5], color: ROBE },
    { name: "hands", size: [4, 4, 4.2], pos: [0, 19, -4.5], color: SKIN },
    {
      name: "legL",
      size: [4, 12, 4],
      pos: [-2, 6, 0],
      pivot: [-2, 12, 0],
      anim: "legL",
      color: ROBE,
    },
    {
      name: "legR",
      size: [4, 12, 4],
      pos: [2, 6, 0],
      pivot: [2, 12, 0],
      anim: "legR",
      color: ROBE,
    },
  ];
}

const IRON = "#d8d2c8";
const VINE = "#5a8a3a";

/** Железный голем: охраняет деревню — сам бьёт нежить и разбойников (hunts) и отвечает на удар. */
const IRON_GOLEM: MobDef = {
  name: "iron_golem",
  category: "neutral",
  hp: 100,
  walkSpeed: 0.8,
  fleeSpeed: 1.5,
  chaseSpeed: 2.2,
  follow: 16,
  box: { w: 1.4, h: 2.7 },
  attack: { damage: 10, reach: 1.8, cooldown: 1.2 },
  // ищет врагов деревни сам, как разбойники ищут жителей (MobBrain, huntsLand)
  huntsLand: true,
  hunts: [
    "zombie",
    "zombie_villager",
    "skeleton",
    "bomber",
    "marauder",
    "axeman",
    "crusher",
    "witch",
    "conjurer",
  ],
  persistent: true,
  drops: [
    { item: "iron_ingot", n: 3, max: 5 },
    { item: "flower_red", n: 0, max: 2 },
  ],
  eye: 0.85,
  parts: [
    {
      name: "head",
      size: [8, 10, 8],
      pos: [0, 39, -2],
      pivot: [0, 34, -2],
      anim: "head",
      color: IRON,
    },
    {
      name: "nose",
      size: [2, 4, 2],
      pos: [0, 37, -7],
      pivot: [0, 34, -2],
      anim: "head",
      color: "#c8beb0",
    },
    {
      name: "eyeL",
      size: [1.5, 1, 0.4],
      pos: [-2, 40, -6.2],
      pivot: [0, 34, -2],
      anim: "head",
      color: "#8a1a1a",
    },
    {
      name: "eyeR",
      size: [1.5, 1, 0.4],
      pos: [2, 40, -6.2],
      pivot: [0, 34, -2],
      anim: "head",
      color: "#8a1a1a",
    },
    { name: "chest", size: [18, 12, 11], pos: [0, 28, 0], color: IRON },
    { name: "vine", size: [6, 8, 0.6], pos: [-4, 27, -5.8], color: VINE },
    { name: "waist", size: [9, 5, 6], pos: [0, 19.5, 0], color: "#c8c0b4" },
    {
      name: "armL",
      size: [4, 30, 6],
      pos: [-11, 19, 0],
      pivot: [-11, 33, 0],
      anim: "armL",
      color: IRON,
    },
    {
      name: "armR",
      size: [4, 30, 6],
      pos: [11, 19, 0],
      pivot: [11, 33, 0],
      anim: "armR",
      color: IRON,
    },
    {
      name: "legL",
      size: [6, 16, 5],
      pos: [-4, 8, 0],
      pivot: [-4, 16, 0],
      anim: "legL",
      color: IRON,
    },
    {
      name: "legR",
      size: [6, 16, 5],
      pos: [4, 8, 0],
      pivot: [4, 16, 0],
      anim: "legR",
      color: IRON,
    },
  ],
};

/** Безработный житель: без фартука и без сделок — профессию берёт от рабочего блока (systems/Jobs). */
const JOBLESS: MobDef = {
  name: "villager",
  category: "passive",
  hp: 20,
  walkSpeed: 1.1,
  fleeSpeed: 2.6,
  box: { w: 0.6, h: 1.95 },
  drops: [],
  eye: 0.85,
  parts: villagerParts(ROBE),
};

export const VILLAGER_MOBS: Record<string, MobDef> = Object.fromEntries([
  ["iron_golem", IRON_GOLEM],
  ["villager", JOBLESS],
  ...PROFESSIONS.map((p) => [
    "villager_" + p,
    {
      name: "villager_" + p,
      category: "passive",
      hp: 20,
      walkSpeed: 1.1,
      fleeSpeed: 2.6,
      box: { w: 0.6, h: 1.95 },
      drops: [],
      trades: p,
      eye: 0.85,
      parts: villagerParts(APRON[p]),
    } satisfies MobDef,
  ]),
]);
