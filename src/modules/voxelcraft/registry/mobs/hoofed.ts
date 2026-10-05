// Копытные, как в Minecraft: осёл (приручают посадкой, ездят в седле, как на лошади — чуть медленнее),
// мул (родится от лошади и осла — MobDef.mates; сам не размножается) и лама (нейтральна, ударишь —
// плюётся; живёт в саваннах и горах). Названия — registry/names.ts.
import type { MobDef, MobPart, Vec3 } from "../../types";
import { addNames } from "../names";
import { TAME_MOBS } from "./tame";

const horse = TAME_MOBS.horse!;
const HORSE = "#8a5a30",
  MANE = "#3a2410";
/** Сумки вьюка по бокам — видны, когда навьючен (Mob.items). */
const PACKS: MobPart[] = [
  { name: "packL", size: [2, 8, 8], pos: [-6, 17, 3], color: "#8a6a3a" },
  { name: "packR", size: [2, 8, 8], pos: [6, 17, 3], color: "#8a6a3a" },
];

/** Лошадиный риг другой масти и с длинными ушами (осёл, мул). */
const equine = (body: string, mane: string, ear: number): MobPart[] =>
  horse.parts.map((p) =>
    p.name.startsWith("ear")
      ? {
          ...p,
          size: [1.5, ear, 1] as Vec3,
          pos: [p.pos[0], p.pos[1] + (ear - 2) / 2, p.pos[2]] as Vec3,
          color: body,
        }
      : {
          ...p,
          color: p.color === HORSE ? body : p.color === MANE ? mane : p.color,
        },
  );

const LLAMA = "#e8dcc0";
const LL_HEAD = { pivot: [0, 22, -7] as Vec3, anim: "head" as const };
const llamaParts: MobPart[] = [
  { name: "body", size: [12, 10, 18], pos: [0, 17, 1], color: LLAMA },
  {
    name: "neck",
    size: [8, 14, 6],
    pos: [0, 27, -7],
    ...LL_HEAD,
    color: LLAMA,
  },
  { name: "head", size: [6, 6, 8], pos: [0, 35, -9], ...LL_HEAD, color: LLAMA },
  {
    name: "earL",
    size: [2, 3, 1],
    pos: [-2, 39.5, -7],
    ...LL_HEAD,
    color: LLAMA,
  },
  {
    name: "earR",
    size: [2, 3, 1],
    pos: [2, 39.5, -7],
    ...LL_HEAD,
    color: LLAMA,
  },
  {
    name: "eyeL",
    size: [0.4, 1, 1],
    pos: [-3.1, 36, -11],
    ...LL_HEAD,
    color: "#1a1a1a",
  },
  {
    name: "eyeR",
    size: [0.4, 1, 1],
    pos: [3.1, 36, -11],
    ...LL_HEAD,
    color: "#1a1a1a",
  },
  { name: "rug", size: [12.4, 3, 12], pos: [0, 20.5, 0], color: "#b83a2a" },
  { name: "packL", size: [2, 7, 7], pos: [-7, 16, 2], color: "#8a6a3a" },
  { name: "packR", size: [2, 7, 7], pos: [7, 16, 2], color: "#8a6a3a" },
  ...[-1, 1].flatMap((sx): MobPart[] =>
    [-1, 1].map((sz): MobPart => ({
      name: `leg${sz < 0 ? "F" : "B"}${sx < 0 ? "L" : "R"}`,
      size: [4, 12, 4],
      pos: [sx * 3.5, 6, sz * 6],
      pivot: [sx * 3.5, 12, sz * 6],
      anim: sx < 0 === sz < 0 ? "legL" : "legR",
      color: LLAMA,
    })),
  ),
];

export const HOOFED_MOBS: Record<string, MobDef> = {
  donkey: {
    ...horse,
    name: "donkey",
    hp: 20,
    rideable: { seat: 1.05, speed: 6 },
    mates: { horse: "mule" },
    chestSlots: 15,
    spawn: {
      light: "bright",
      ground: ["grass"],
      biomes: ["plains", "savanna"],
      weight: 2,
      group: [1, 3],
    },
    parts: [...equine("#8a8078", "#4a4038", 5), ...PACKS],
  },
  mule: {
    ...horse,
    name: "mule",
    hp: 22,
    rideable: { seat: 1.1, speed: 6.5 },
    chestSlots: 15,
    temptItems: undefined, // мул бесплоден: кормить можно, размножить — нет
    spawn: undefined,
    parts: [...equine("#5a3a20", "#2a1a10", 4), ...PACKS],
  },
  llama: {
    name: "llama",
    category: "neutral",
    hp: 22,
    walkSpeed: 1.2,
    fleeSpeed: 2.4,
    chaseSpeed: 1.2,
    follow: 16,
    box: { w: 0.9, h: 1.87 },
    ranged: {
      damage: 1,
      speed: 20,
      cooldown: 2,
      range: 10,
      projectile: "spit",
    },
    temptItems: ["wheat", "hay_block"],
    caravan: true,
    chestSlots: 15,
    spawn: {
      light: "bright",
      ground: ["grass", "snow", "stone"],
      biomes: ["savanna", "mountains"],
      weight: 5,
      group: [2, 4],
    },
    drops: [{ item: "leather", n: 0, max: 2 }],
    xp: [1, 3],
    eye: 0.9,
    parts: llamaParts,
  },
};

addNames({ donkey: "Осёл", mule: "Мул", llama: "Лама" });
