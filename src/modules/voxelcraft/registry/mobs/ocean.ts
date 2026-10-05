// Океан: черепаха (пляжи у воды, приманивается морской травой, откладывает яйца, выросший черепашонок
// роняет щиток), глубинник и древний глубинник (страж и древний страж Minecraft) — живут в подводных
// храмах: луч с зарядкой, шипы; древний насылает Усталость. Логика глубинников — entities/DeepBrain.ts.
import type { MobDef, MobPart } from "../../types";

/** Глубинник: куб с глазом, хвостом и шипами; k — масштаб (древний — вдвое больше). */
function deepParts(k: number, body: string, tail: string): MobPart[] {
  const s = (v: number) => v * k;
  const spikes: MobPart[] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([x, z], i) => ({
    name: "spike" + i,
    size: [s(1.5), s(4), s(1.5)],
    pos: [s(6.5) * x!, s(12.5), s(6.5) * z!],
    color: "#e0a060",
  }));
  return [
    {
      name: "body",
      size: [s(12), s(12), s(12)],
      pos: [0, s(6), 0],
      color: body,
    },
    {
      name: "eye",
      size: [s(4), s(4), 0.4],
      pos: [0, s(7), -s(6) - 0.2],
      color: "#f0e8c0",
    },
    {
      name: "pupil",
      size: [s(2), s(2), 0.4],
      pos: [0, s(7), -s(6) - 0.4],
      color: "#a03020",
      glow: true,
    },
    {
      name: "tail1",
      size: [s(4), s(4), s(6)],
      pos: [0, s(6), s(9)],
      pivot: [0, s(6), s(6)],
      anim: "head",
      color: tail,
    },
    {
      name: "tail2",
      size: [s(2), s(2), s(5)],
      pos: [0, s(6), s(14.5)],
      pivot: [0, s(6), s(6)],
      anim: "head",
      color: tail,
    },
    ...spikes,
  ];
}

const TEMPLE = {
  light: "any",
  structure: "sea_temple",
  medium: "water",
} as const;

export const OCEAN_MOBS: Record<string, MobDef> = {
  turtle: {
    name: "turtle",
    category: "passive",
    hp: 30,
    walkSpeed: 0.6,
    fleeSpeed: 1.2,
    box: { w: 1.2, h: 0.4 },
    swims: true,
    temptItems: ["seagrass"],
    layEggs: "turtle_egg",
    growDrop: "scute",
    spawn: {
      light: "bright",
      ground: ["sand"],
      nearWater: true,
      weight: 6,
      group: [2, 5],
    },
    drops: [{ item: "seagrass", n: 0, max: 2 }],
    xp: [1, 3],
    parts: [
      { name: "shell", size: [12, 3, 14], pos: [0, 4, 0], color: "#3a6a3a" },
      { name: "plastron", size: [10, 1, 12], pos: [0, 2, 0], color: "#c8c890" },
      {
        name: "head",
        size: [4, 3, 4],
        pos: [0, 3, -9],
        pivot: [0, 3, -7],
        anim: "head",
        color: "#6a9a5a",
      },
      {
        name: "flipFL",
        size: [5, 1, 3],
        pos: [-7, 2, -5],
        pivot: [-5, 2, -5],
        anim: "legL",
        color: "#6a9a5a",
      },
      {
        name: "flipFR",
        size: [5, 1, 3],
        pos: [7, 2, -5],
        pivot: [5, 2, -5],
        anim: "legR",
        color: "#6a9a5a",
      },
      {
        name: "flipBL",
        size: [3, 1, 3],
        pos: [-5, 2, 6],
        pivot: [-4, 2, 6],
        anim: "legR",
        color: "#6a9a5a",
      },
      {
        name: "flipBR",
        size: [3, 1, 3],
        pos: [5, 2, 6],
        pivot: [4, 2, 6],
        anim: "legL",
        color: "#6a9a5a",
      },
    ],
  },

  deepling: {
    name: "deepling",
    category: "hostile",
    hp: 30,
    walkSpeed: 1.5,
    fleeSpeed: 2,
    chaseSpeed: 2,
    follow: 16,
    box: { w: 0.85, h: 0.85 },
    swims: true,
    guardian: "guardian",
    thorns: 2,
    spawn: { ...TEMPLE, weight: 30, group: [1, 2] },
    drops: [
      { item: "sea_shard", n: 0, max: 2 },
      { item: "cod", n: 1, chance: 0.4 },
      { item: "sea_crystals", n: 1, chance: 0.3 },
    ],
    xp: [10, 10],
    eye: 0.5,
    parts: deepParts(1, "#5a9a8a", "#4a8a7a"),
  },

  elder_deepling: {
    name: "elder_deepling",
    category: "hostile",
    hp: 80,
    walkSpeed: 0.8,
    fleeSpeed: 1,
    chaseSpeed: 1,
    follow: 16,
    box: { w: 1.9, h: 1.9 },
    swims: true,
    persistent: true,
    guardian: "elder",
    thorns: 2,
    drops: [
      { item: "wet_sponge", n: 1 },
      { item: "sea_shard", n: 0, max: 2 },
      { item: "tide_armor_trim_smithing_template", n: 1, chance: 0.2 }, // шаблон «Прилив», как в Minecraft
    ],
    xp: [10, 10],
    eye: 0.5,
    parts: deepParts(2, "#c8c0b0", "#a8a090"),
  },
};
