// Лягушки трёх окрасок, как в Minecraft: умеренная (оранжевая — болота), тёплая (белая — мангровые болота),
// холодная (зелёная — только из головастиков, выросших в холодных биомах). Языком ловят маленьких
// слизней (слизь) и магмовые кубы (лягушачий свет своего цвета) — entities/FrogBrain. Размножаются от
// слизи и откладывают икру на воду; из икры — головастики, из головастика — лягушка по биому (EntityManager).
import type { MobDef, MobPart } from "../../types";

const COLD = ["snowy", "taiga", "mountains"];
const WARM = [
  "desert",
  "jungle",
  "savanna",
  "mangrove_swamp",
  "warm_ocean",
  "beach",
];

/** Какая лягушка вырастает из головастика в этом биоме. */
export function frogFor(biome: string | undefined): string {
  if (biome && COLD.includes(biome)) return "frog_cold";
  if (biome && WARM.includes(biome)) return "frog_warm";
  return "frog_temperate";
}

const H = {
  pivot: [0, 4, -2] as [number, number, number],
  anim: "head" as const,
};

function frogParts(skin: string, belly: string): MobPart[] {
  return [
    { name: "body", size: [5, 3, 7], pos: [0, 3, 0.5], color: skin },
    { name: "belly", size: [4.6, 1, 6], pos: [0, 1.6, 0.5], color: belly },
    { name: "head", size: [6, 3, 5], pos: [0, 4.5, -4], ...H, color: skin },
    {
      name: "eyeL",
      size: [1.6, 1.6, 1.6],
      pos: [-2, 6.5, -4.5],
      ...H,
      color: skin,
    },
    {
      name: "eyeR",
      size: [1.6, 1.6, 1.6],
      pos: [2, 6.5, -4.5],
      ...H,
      color: skin,
    },
    {
      name: "pupilL",
      size: [0.6, 0.8, 0.4],
      pos: [-2, 6.6, -5.4],
      ...H,
      color: "#101010",
    },
    {
      name: "pupilR",
      size: [0.6, 0.8, 0.4],
      pos: [2, 6.6, -5.4],
      ...H,
      color: "#101010",
    },
    {
      name: "legBL",
      size: [2, 2, 4],
      pos: [-3, 1, 2.5],
      pivot: [-3, 2, 1],
      anim: "legL",
      color: skin,
    },
    {
      name: "legBR",
      size: [2, 2, 4],
      pos: [3, 1, 2.5],
      pivot: [3, 2, 1],
      anim: "legR",
      color: skin,
    },
    {
      name: "legFL",
      size: [1, 2, 1],
      pos: [-2.5, 1, -3],
      pivot: [-2.5, 2, -3],
      anim: "legR",
      color: skin,
    },
    {
      name: "legFR",
      size: [1, 2, 1],
      pos: [2.5, 1, -3],
      pivot: [2.5, 2, -3],
      anim: "legL",
      color: skin,
    },
  ];
}

function frog(
  name: string,
  skin: string,
  belly: string,
  light: string,
  biomes?: string[],
): MobDef {
  return {
    name,
    category: "passive",
    hp: 10,
    walkSpeed: 1.2,
    fleeSpeed: 2.4,
    box: { w: 0.5, h: 0.55 },
    swims: true,
    temptItems: ["slime_ball"],
    layEggs: "frogspawn",
    tongue: { slime_small: "slime_ball", magma_cube_small: light },
    ...(biomes
      ? {
          spawn: {
            light: "bright" as const,
            ground: ["grass", "mud"],
            biomes,
            weight: 10,
            group: [2, 5] as [number, number],
          },
        }
      : {}),
    drops: [],
    xp: [1, 3],
    parts: frogParts(skin, belly),
  };
}

export const FROG_MOBS: Record<string, MobDef> = {
  frog_temperate: frog(
    "frog_temperate",
    "#c8783a",
    "#e8c8a0",
    "ochre_froglight",
    ["swamp"],
  ),
  frog_warm: frog("frog_warm", "#e8e0d0", "#f0ead8", "pearlescent_froglight", [
    "mangrove_swamp",
  ]),
  frog_cold: frog("frog_cold", "#5a8a4a", "#c8d8a0", "verdant_froglight"),
  tadpole: {
    name: "tadpole",
    category: "passive",
    hp: 6,
    walkSpeed: 1.3,
    fleeSpeed: 2.6,
    box: { w: 0.4, h: 0.3 },
    swims: true,
    needsWater: true,
    growsInto: "frog",
    growTime: 300,
    drops: [],
    xp: [1, 1],
    parts: [
      { name: "body", size: [3, 2, 3], pos: [0, 1, 0], color: "#3a2a1a" },
      {
        name: "tail",
        size: [0.5, 2, 4],
        pos: [0, 1, 3.5],
        pivot: [0, 1, 1.5],
        anim: "head",
        color: "#5a4a3a",
      },
    ],
  },
};
