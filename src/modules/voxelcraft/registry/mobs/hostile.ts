// Враждебные и нейтральные мобы верхнего мира: зомби, скелет, Шипун, паук, Тенеход. Появляются в
// темноте (ночью на поверхности и в пещерах). Названия в интерфейсе — registry/names.ts.
import type { MobDef, MobPart } from "../../types";
import { PROFESSIONS } from "../../systems/Trading";

const NIGHT = { light: "dark", dimension: "overworld" } as const;
/** Руки вперёд: поворот вокруг x на +π/2 разворачивает свисающую руку к -z. */
const FORWARD: [number, number, number] = [1.45, 0, 0];

/** Человекоподобный риг: голова, тело, руки, ноги (как модель игрока, 32 px = 2 блока). */
export function humanoid(c: {
  skin: string;
  shirt: string;
  pants: string;
  eyes: string;
  limb?: number;
  armPose?: [number, number, number];
}): MobPart[] {
  const l = c.limb ?? 4;
  return [
    {
      name: "head",
      size: [8, 8, 8],
      pos: [0, 28, 0],
      pivot: [0, 24, 0],
      anim: "head",
      color: c.skin,
    },
    {
      name: "eyeL",
      size: [2, 1, 0.4],
      pos: [-2, 28.5, -4.2],
      pivot: [0, 24, 0],
      anim: "head",
      color: c.eyes,
    },
    {
      name: "eyeR",
      size: [2, 1, 0.4],
      pos: [2, 28.5, -4.2],
      pivot: [0, 24, 0],
      anim: "head",
      color: c.eyes,
    },
    {
      name: "body",
      size: [8, 12, l === 4 ? 4 : 2],
      pos: [0, 18, 0],
      color: c.shirt,
    },
    {
      name: "armL",
      size: [l, 12, l],
      pos: [-4 - l / 2, 18, 0],
      pivot: [-4 - l / 2, 22, 0],
      anim: "armL",
      color: c.skin,
      ...(c.armPose ? { pose: c.armPose } : {}),
    },
    {
      name: "armR",
      size: [l, 12, l],
      pos: [4 + l / 2, 18, 0],
      pivot: [4 + l / 2, 22, 0],
      anim: "armR",
      color: c.skin,
      ...(c.armPose ? { pose: c.armPose } : {}),
    },
    {
      name: "legL",
      size: [l, 12, l],
      pos: [-2, 6, 0],
      pivot: [-2, 12, 0],
      anim: "legL",
      color: c.pants,
    },
    {
      name: "legR",
      size: [l, 12, l],
      pos: [2, 6, 0],
      pivot: [2, 12, 0],
      anim: "legR",
      color: c.pants,
    },
  ];
}

/**
 * Слизень — зелёный куб с глазами; s — ребро в пикселях (32 = 2 блока). Лицо смотрит в -z. Магмовый куб —
 * тёмно-красный, глаза светятся.
 */
function slimeParts(s: number, magma = false): MobPart[] {
  const e = s / 8;
  const face = -s / 2 - 0.2;
  const eye = magma ? { color: "#f0a020", glow: true } : { color: "#1a3a1a" };
  return [
    {
      name: "body",
      size: [s, s, s],
      pos: [0, s / 2, 0],
      color: magma ? "#6a2010" : "#6ad04a",
    },
    { name: "eyeL", size: [e, e, 0.4], pos: [-s / 4, s * 0.62, face], ...eye },
    { name: "eyeR", size: [e, e, 0.4], pos: [s / 4, s * 0.62, face], ...eye },
    {
      name: "mouth",
      size: [e, e / 2, 0.4],
      pos: [0, s * 0.3, face],
      color: magma ? "#f06010" : "#2a5a2a",
    },
  ];
}

/**
 * Слизни трёх размеров: большой → 2..4 средних → 2..4 маленьких; слизь роняют маленькие. magma — магмовый
 * куб Пекла: не горит, роняет магмовый крем (маленьких ловят лягушки — лягушачий свет).
 */
function slime(
  name: string,
  size: number,
  hp: number,
  damage: number,
  next: string | null,
  xp: number,
  magma = false,
): MobDef {
  const box = (size / 16) * 1.02;
  return {
    name,
    category: "hostile",
    hp,
    walkSpeed: 1,
    fleeSpeed: 2,
    chaseSpeed: 2 + size / 32,
    follow: 16,
    box: { w: box, h: box },
    ...(damage > 0
      ? { attack: { damage, reach: 0.6 + box / 2, cooldown: 1 } }
      : {}),
    hops: true,
    ...(next
      ? { splitsInto: { mob: next, n: [2, 4] as [number, number] } }
      : {}),
    ...(size >= 16
      ? {
          spawn: magma
            ? {
                light: "any",
                dimension: "inferno",
                biomes: ["wastes", "basalt_deltas"],
                weight: 8,
                group: [1, 1],
              }
            : {
                light: "dark",
                dimension: "overworld",
                maxY: 40,
                weight: 10,
                group: [1, 1],
              },
        }
      : {}),
    ...(magma ? { fireImmune: true } : {}),
    drops: next
      ? []
      : [
          {
            item: magma ? "magma_cream" : "slime_ball",
            n: 0,
            max: magma ? 1 : 2,
          },
        ],
    xp: [xp, xp],
    eye: 0.6,
    parts: slimeParts(size, magma),
  };
}

export const HOSTILE_MOBS: Record<string, MobDef> = {
  slime: slime("slime", 32, 16, 4, "slime_medium", 4),
  slime_medium: slime("slime_medium", 16, 4, 2, "slime_small", 2),
  slime_small: slime("slime_small", 8, 1, 0, null, 1),
  magma_cube: slime("magma_cube", 32, 16, 6, "magma_cube_medium", 4, true),
  magma_cube_medium: slime(
    "magma_cube_medium",
    16,
    4,
    4,
    "magma_cube_small",
    2,
    true,
  ),
  magma_cube_small: slime("magma_cube_small", 8, 1, 3, null, 1, true),

  zombie: {
    name: "zombie",
    category: "hostile",
    hp: 20,
    walkSpeed: 1.2,
    fleeSpeed: 2.3,
    chaseSpeed: 2.3,
    follow: 24,
    box: { w: 0.6, h: 1.95 },
    attack: { damage: 3, reach: 1.2, cooldown: 1 },
    burnsInSun: true,
    // охотится на жителей и оставляет вместо убитого зомби-жителя (systems/Zombify)
    huntsLand: true,
    hunts: ["villager", ...PROFESSIONS.map((p) => "villager_" + p)],
    turnsVillagers: true,
    // разозлённый зомби ломится в дверь и через пять секунд сносит её (entities/Mob)
    breaksDoors: true,
    spawn: { ...NIGHT, weight: 100, group: [1, 3] },
    drops: [
      { item: "rotten_flesh", n: 0, max: 2 },
      { item: "iron_ingot", n: 1, chance: 0.025 },
    ],
    xp: [5, 5],
    parts: humanoid({
      skin: "#5a8a3a",
      shirt: "#2a8aa8",
      pants: "#3a3a8a",
      eyes: "#1a2a1a",
      armPose: FORWARD,
    }),
  },

  skeleton: {
    name: "skeleton",
    category: "hostile",
    hp: 20,
    walkSpeed: 1.2,
    fleeSpeed: 2.5,
    chaseSpeed: 2.5,
    follow: 16,
    box: { w: 0.6, h: 1.99 },
    ranged: { damage: 3, speed: 32, cooldown: 2, range: 15 },
    burnsInSun: true,
    spawn: { ...NIGHT, weight: 100, group: [1, 3] },
    drops: [
      { item: "bone", n: 0, max: 2 },
      { item: "arrow", n: 0, max: 2 },
    ],
    xp: [5, 5],
    parts: humanoid({
      skin: "#d8d8d0",
      shirt: "#c4c4bc",
      pants: "#d0d0c8",
      eyes: "#2a2a2a",
      limb: 2,
      armPose: [1.3, 0.15, 0],
    }),
  },

  bomber: {
    name: "bomber",
    category: "hostile",
    hp: 20,
    walkSpeed: 1.2,
    fleeSpeed: 2.4,
    chaseSpeed: 2.4,
    follow: 16,
    box: { w: 0.6, h: 1.7 },
    explode: { power: 3, fuse: 1.5, radius: 3 },
    spawn: { ...NIGHT, weight: 100, group: [1, 2] },
    drops: [{ item: "gunpowder", n: 0, max: 2 }],
    xp: [5, 5],
    parts: [
      {
        name: "head",
        size: [8, 8, 8],
        pos: [0, 22, 0],
        pivot: [0, 18, 0],
        anim: "head",
        color: "#4caf4a",
      },
      {
        name: "eyeL",
        size: [2, 2, 0.4],
        pos: [-2, 23, -4.2],
        pivot: [0, 18, 0],
        anim: "head",
        color: "#0e140e",
      },
      {
        name: "eyeR",
        size: [2, 2, 0.4],
        pos: [2, 23, -4.2],
        pivot: [0, 18, 0],
        anim: "head",
        color: "#0e140e",
      },
      {
        name: "mouth",
        size: [2, 3, 0.4],
        pos: [0, 20, -4.2],
        pivot: [0, 18, 0],
        anim: "head",
        color: "#0e140e",
      },
      { name: "body", size: [8, 12, 4], pos: [0, 12, 0], color: "#3f9a3e" },
      {
        name: "legFL",
        size: [4, 6, 4],
        pos: [-2, 3, -4],
        pivot: [-2, 6, -4],
        anim: "legL",
        color: "#3a8a38",
      },
      {
        name: "legFR",
        size: [4, 6, 4],
        pos: [2, 3, -4],
        pivot: [2, 6, -4],
        anim: "legR",
        color: "#3a8a38",
      },
      {
        name: "legBL",
        size: [4, 6, 4],
        pos: [-2, 3, 4],
        pivot: [-2, 6, 4],
        anim: "legR",
        color: "#3a8a38",
      },
      {
        name: "legBR",
        size: [4, 6, 4],
        pos: [2, 3, 4],
        pivot: [2, 6, 4],
        anim: "legL",
        color: "#3a8a38",
      },
    ],
  },

  spider: {
    name: "spider",
    category: "hostile",
    hp: 16,
    walkSpeed: 1.6,
    fleeSpeed: 3,
    chaseSpeed: 3,
    follow: 16,
    box: { w: 1.4, h: 0.9 },
    attack: { damage: 2, reach: 1.3, cooldown: 1 },
    climbs: true,
    neutralInLight: true,
    spawn: { ...NIGHT, weight: 100, group: [1, 2] },
    drops: [
      { item: "string", n: 0, max: 2 },
      { item: "spider_eye", n: 1, chance: 0.33 },
    ],
    xp: [5, 5],
    eye: 0.7,
    parts: [
      { name: "abdomen", size: [10, 8, 12], pos: [0, 8, 6], color: "#2a221e" },
      { name: "thorax", size: [6, 6, 6], pos: [0, 7, -2], color: "#3a302a" },
      {
        name: "head",
        size: [8, 8, 8],
        pos: [0, 8, -8],
        pivot: [0, 8, -5],
        anim: "head",
        color: "#2e2622",
      },
      {
        name: "eyeL",
        size: [2, 1, 0.4],
        pos: [-2, 9, -12.2],
        pivot: [0, 8, -5],
        anim: "head",
        color: "#d01818",
        glow: true,
      },
      {
        name: "eyeR",
        size: [2, 1, 0.4],
        pos: [2, 9, -12.2],
        pivot: [0, 8, -5],
        anim: "head",
        color: "#d01818",
        glow: true,
      },
      ...[-3, -1, 1, 3].flatMap((z, i): MobPart[] => [
        {
          name: "legL" + i,
          size: [14, 2, 2],
          pos: [-9, 6, z * 1.5 - 1],
          pivot: [-2, 7, z * 1.5 - 1],
          anim: i % 2 ? "legL" : "legR",
          color: "#3a302a",
          pose: [0, 0, -0.45],
        },
        {
          name: "legR" + i,
          size: [14, 2, 2],
          pos: [9, 6, z * 1.5 - 1],
          pivot: [2, 7, z * 1.5 - 1],
          anim: i % 2 ? "legR" : "legL",
          color: "#3a302a",
          pose: [0, 0, 0.45],
        },
      ]),
    ],
  },

  stalker: {
    name: "stalker",
    category: "neutral",
    hp: 40,
    walkSpeed: 1.4,
    fleeSpeed: 3,
    chaseSpeed: 3.5,
    follow: 32,
    box: { w: 0.6, h: 2.9 },
    attack: { damage: 7, reach: 1.4, cooldown: 1 },
    teleports: true,
    provokedByLook: true,
    // Тенеход не терпит клещей Предела — как эндермен эндермитов в Minecraft
    huntsLand: true,
    hunts: ["rim_mite"],
    spawn: { ...NIGHT, weight: 10, group: [1, 1] },
    drops: [{ item: "rim_pearl", n: 0, max: 1 }],
    xp: [5, 5],
    eye: 0.93,
    parts: [
      {
        name: "legL",
        size: [2, 26, 2],
        pos: [-2, 13, 0],
        pivot: [-2, 26, 0],
        anim: "legL",
        color: "#141418",
      },
      {
        name: "legR",
        size: [2, 26, 2],
        pos: [2, 13, 0],
        pivot: [2, 26, 0],
        anim: "legR",
        color: "#141418",
      },
      { name: "body", size: [8, 12, 4], pos: [0, 32, 0], color: "#18181e" },
      {
        name: "armL",
        size: [2, 26, 2],
        pos: [-5, 25, 0],
        pivot: [-5, 38, 0],
        anim: "armL",
        color: "#141418",
      },
      {
        name: "armR",
        size: [2, 26, 2],
        pos: [5, 25, 0],
        pivot: [5, 38, 0],
        anim: "armR",
        color: "#141418",
      },
      {
        name: "head",
        size: [8, 8, 8],
        pos: [0, 42, 0],
        pivot: [0, 38, 0],
        anim: "head",
        color: "#18181e",
      },
      {
        name: "eyeL",
        size: [3, 1, 0.4],
        pos: [-2.5, 42, -4.2],
        pivot: [0, 38, 0],
        anim: "head",
        color: "#c040ff",
        glow: true,
      },
      {
        name: "eyeR",
        size: [3, 1, 0.4],
        pos: [2.5, 42, -4.2],
        pivot: [0, 38, 0],
        anim: "head",
        color: "#c040ff",
        glow: true,
      },
    ],
  },
};
