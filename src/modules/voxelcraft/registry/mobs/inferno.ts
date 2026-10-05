// Мобы Пекла: Мёртвый свинорыл (нейтральный, злится всей стаей), Плакальщик (летает, огненные шары
// со взрывом), Пламень и Пепельный скелет — только в адской крепости (spawn.structure). Огня и лавы
// не боятся. Названия в интерфейсе — registry/names.ts.
import type { MobDef, MobPart } from "../../types";
import { humanoid } from "./hostile";

const GROUND = [
  "infernal_stone",
  "soul_sand",
  "soul_soil",
  "gravel",
  "magma_block",
  "crimson_nylium",
  "warped_nylium",
  "basalt",
  "blackstone",
] as const;
const INFERNO = { light: "any", dimension: "inferno", ground: GROUND } as const;
const FORTRESS = {
  light: "any",
  dimension: "inferno",
  structure: "fortress",
} as const;

/** Щупальца Плакальщика: сетка 3×3 под телом, разной длины. */
const TENTACLES: MobPart[] = [-20, 0, 20].flatMap((x, i) =>
  [-20, 0, 20].map((z, j): MobPart => {
    const len = 18 + ((i + j) % 3) * 6;
    return {
      name: `tentacle${i}${j}`,
      size: [4, len, 4],
      pos: [x, -len / 2, z],
      pivot: [x, 0, z],
      anim: (i + j) % 2 ? "legL" : "legR",
      color: "#e2e2e2",
    };
  }),
);

/** Огненные стержни Пламени: верхнее и нижнее кольцо по четыре. */
const RODS: MobPart[] = Array.from({ length: 8 }, (_, i): MobPart => {
  const upper = i < 4;
  const a = (i / 4) * Math.PI * 2 + (upper ? 0 : Math.PI / 4);
  const r = upper ? 7 : 5;
  return {
    name: "rod" + i,
    size: [2, 8, 2],
    pos: [Math.cos(a) * r, upper ? 14 : 6, Math.sin(a) * r],
    color: "#f4a020",
    glow: true,
  };
});

export const INFERNO_MOBS: Record<string, MobDef> = {
  hogman_dead: {
    name: "hogman_dead",
    category: "neutral",
    hp: 20,
    walkSpeed: 1.2,
    fleeSpeed: 2.3,
    chaseSpeed: 2.6,
    follow: 24,
    box: { w: 0.6, h: 1.95 },
    attack: { damage: 5, reach: 1.2, cooldown: 1 },
    fireImmune: true,
    groupAnger: true,
    spawn: {
      ...INFERNO,
      biomes: ["wastes", "crimson_forest"],
      weight: 100,
      group: [2, 4],
    },
    drops: [
      { item: "rotten_flesh", n: 0, max: 1 },
      { item: "gold_nugget", n: 0, max: 1 },
    ],
    xp: [5, 5],
    parts: humanoid({
      skin: "#e8a0a0",
      shirt: "#7a5a4a",
      pants: "#5a4a3a",
      eyes: "#3a1010",
    }),
  },

  wailer: {
    name: "wailer",
    category: "hostile",
    hp: 10,
    walkSpeed: 1,
    fleeSpeed: 2,
    chaseSpeed: 1.4,
    follow: 64,
    box: { w: 4, h: 4 },
    flies: { height: 8 },
    fireImmune: true,
    ranged: {
      damage: 6,
      speed: 14,
      cooldown: 3,
      range: 48,
      projectile: "fireball",
    },
    spawn: {
      ...INFERNO,
      biomes: ["wastes", "soul_valley", "basalt_deltas"],
      weight: 30,
      group: [1, 1],
    },
    drops: [
      { item: "gunpowder", n: 0, max: 2 },
      { item: "wailer_tear", n: 0, max: 1 },
    ],
    xp: [5, 5],
    eye: 0.5,
    parts: [
      { name: "body", size: [64, 64, 64], pos: [0, 32, 0], color: "#f0f0f0" },
      {
        name: "eyeL",
        size: [8, 4, 0.4],
        pos: [-12, 40, -32.2],
        color: "#3a3a3a",
      },
      {
        name: "eyeR",
        size: [8, 4, 0.4],
        pos: [12, 40, -32.2],
        color: "#3a3a3a",
      },
      {
        name: "mouth",
        size: [16, 6, 0.4],
        pos: [0, 24, -32.2],
        color: "#2a2a2a",
      },
      ...TENTACLES,
    ],
  },

  flamer: {
    name: "flamer",
    category: "hostile",
    hp: 20,
    walkSpeed: 1,
    fleeSpeed: 2,
    chaseSpeed: 1.8,
    follow: 48,
    box: { w: 0.6, h: 1.8 },
    flies: { height: 2 },
    fireImmune: true,
    ranged: {
      damage: 5,
      speed: 16,
      cooldown: 3,
      range: 32,
      projectile: "small_fireball",
      volley: 3,
    },
    spawn: { ...FORTRESS, weight: 60, group: [1, 2] },
    drops: [{ item: "flame_rod", n: 0, max: 1 }],
    xp: [10, 10],
    parts: [
      {
        name: "head",
        size: [8, 8, 8],
        pos: [0, 24, 0],
        pivot: [0, 20, 0],
        anim: "head",
        color: "#e8b020",
      },
      {
        name: "eyeL",
        size: [2, 1, 0.4],
        pos: [-2, 25, -4.2],
        pivot: [0, 20, 0],
        anim: "head",
        color: "#3a1a00",
      },
      {
        name: "eyeR",
        size: [2, 1, 0.4],
        pos: [2, 25, -4.2],
        pivot: [0, 20, 0],
        anim: "head",
        color: "#3a1a00",
      },
      ...RODS,
    ],
  },

  ash_skeleton: {
    name: "ash_skeleton",
    category: "hostile",
    hp: 20,
    walkSpeed: 1.2,
    fleeSpeed: 2.5,
    chaseSpeed: 2.6,
    follow: 16,
    box: { w: 0.7, h: 2.4 },
    // удар накладывает Тление; череп выпадает редко (2.5%, как в Minecraft) — три нужны для владыки
    attack: {
      damage: 8,
      reach: 1.3,
      cooldown: 1,
      effect: { id: "decay", seconds: 10 },
    },
    fireImmune: true,
    spawn: { ...FORTRESS, weight: 40, group: [1, 2] },
    drops: [
      { item: "coal", n: 0, max: 1 },
      { item: "bone", n: 0, max: 2 },
      { item: "ash_skull", n: 1, chance: 0.025 },
    ],
    xp: [5, 5],
    parts: humanoid({
      skin: "#2a2a2a",
      shirt: "#242424",
      pants: "#262626",
      eyes: "#a8a8a8",
      limb: 2,
      armPose: [1.2, 0, 0],
    }),
  },
};
