// Вихрь (Breeze Minecraft): сам не появляется — его выпускает спавнер испытаний. Передвигается прыжками,
// стреляет зарядами ветра (снаряд wind_charge: порыв отбрасывает, урон 1). Роняет стержни вихря.
import type { MobDef } from "../../types";

const WIND = "#a8d8f0";
const ROD = "#e0f0f8";
const SPIN = {
  pivot: [0, 14, 0] as [number, number, number],
  anim: "head" as const,
};

export const TRIAL_MOBS_DEFS: Record<string, MobDef> = {
  breeze: {
    name: "breeze",
    category: "hostile",
    hp: 30,
    walkSpeed: 1.5,
    fleeSpeed: 2.5,
    chaseSpeed: 2.5,
    follow: 16,
    box: { w: 0.6, h: 1.77 },
    hops: true,
    ranged: {
      damage: 1,
      speed: 12,
      cooldown: 2.5,
      range: 16,
      projectile: "wind_charge",
    },
    drops: [{ item: "breeze_rod", n: 1, max: 2 }],
    xp: [10, 10],
    eye: 0.85,
    parts: [
      {
        name: "head",
        size: [8, 8, 8],
        pos: [0, 22, 0],
        pivot: [0, 18, 0],
        anim: "head",
        color: WIND,
      },
      {
        name: "eyeL",
        size: [2, 1, 0.4],
        pos: [-2, 23, -4.2],
        pivot: [0, 18, 0],
        anim: "head",
        color: "#2a4a8a",
        glow: true,
      },
      {
        name: "eyeR",
        size: [2, 1, 0.4],
        pos: [2, 23, -4.2],
        pivot: [0, 18, 0],
        anim: "head",
        color: "#2a4a8a",
        glow: true,
      },
      { name: "swirl", size: [6, 10, 6], pos: [0, 12, 0], color: "#c8e8f8" },
      { name: "swirlLow", size: [3, 6, 3], pos: [0, 4, 0], color: "#d8f0fc" },
      { name: "rodA", size: [1, 8, 1], pos: [-5, 14, 0], ...SPIN, color: ROD },
      { name: "rodB", size: [1, 8, 1], pos: [5, 14, 0], ...SPIN, color: ROD },
      { name: "rodC", size: [1, 8, 1], pos: [0, 14, 5], ...SPIN, color: ROD },
    ],
  },
};
