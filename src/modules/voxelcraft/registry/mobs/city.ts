// Панцирник (шалкер Minecraft): лиловая коробка на блоке в городах Предела. Приоткрывается, видя
// игрока, и пускает самонаводящиеся пули (Левитация 10 с) — entities/ShellBrain.ts. Своего спавна
// нет: жителей города селит Game по плану генератора (worldgen/beyond/outer.ts).
import type { MobDef } from "../../types";

const SHELL = "#8a5a9a",
  LID = "#9a6aaa";

export const CITY_MOBS: Record<string, MobDef> = {
  shellkeeper: {
    name: "shellkeeper",
    category: "hostile",
    hp: 30,
    walkSpeed: 0,
    fleeSpeed: 0,
    follow: 16,
    box: { w: 1, h: 1 },
    anchored: true,
    shell: true,
    persistent: true,
    fireImmune: true,
    ranged: {
      damage: 4,
      speed: 6,
      cooldown: 3,
      range: 16,
      projectile: "bullet",
    },
    drops: [{ item: "shell_plate", n: 1, chance: 0.5 }],
    xp: [5, 5],
    eye: 0.5,
    parts: [
      { name: "base", size: [16, 8, 16], pos: [0, 4, 0], color: SHELL },
      {
        name: "head",
        size: [6, 6, 6],
        pos: [0, 8, 0],
        pivot: [0, 5, 0],
        anim: "head",
        color: "#e8d060",
      },
      {
        name: "eyeL",
        size: [1, 1, 0.4],
        pos: [-1.5, 9, -3.2],
        pivot: [0, 5, 0],
        anim: "head",
        color: "#3a2a10",
      },
      {
        name: "eyeR",
        size: [1, 1, 0.4],
        pos: [1.5, 9, -3.2],
        pivot: [0, 5, 0],
        anim: "head",
        color: "#3a2a10",
      },
      // крышка откидывается вокруг заднего края (Mob.peek)
      {
        name: "lid",
        size: [16, 8, 16],
        pos: [0, 12, 0],
        pivot: [0, 8, 8],
        anim: "lid",
        color: LID,
      },
    ],
  },
};
