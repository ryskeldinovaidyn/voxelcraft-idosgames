// Страж (Warden Minecraft): сам не появляется — его будит крикун скалка (systems/Sculk.ts). Слепой,
// ищет по вибрациям и запаху, бьёт на 30 и звуковым ударом сквозь стены (entities/WardenBrain).
import type { MobDef } from "../../types";

const SKIN = "#0e3a44";
const DARK = "#082a30";
const SOUL = "#4af0e0";
const RIB = "#1c5a64";
const HEAD = {
  pivot: [0, 34, 0] as [number, number, number],
  anim: "head" as const,
};

export const SCULK_MOBS: Record<string, MobDef> = {
  warden: {
    name: "warden",
    category: "hostile",
    hp: 500,
    walkSpeed: 1.2,
    fleeSpeed: 1.2,
    chaseSpeed: 3.6,
    box: { w: 0.9, h: 2.9 },
    attack: { damage: 30, reach: 1.4, cooldown: 1.2, knock: 1.5 },
    warden: true,
    persistent: true,
    fireImmune: true,
    drops: [{ item: "sculk_catalyst", n: 1 }],
    xp: [5, 5],
    eye: 0.85,
    parts: [
      {
        name: "legL",
        size: [6, 13, 6],
        pos: [-5, 6.5, 0],
        pivot: [-5, 13, 0],
        anim: "legL",
        color: SKIN,
      },
      {
        name: "legR",
        size: [6, 13, 6],
        pos: [5, 6.5, 0],
        pivot: [5, 13, 0],
        anim: "legR",
        color: SKIN,
      },
      { name: "body", size: [18, 21, 11], pos: [0, 23.5, 0], color: SKIN },
      { name: "ribs", size: [12, 10, 0.6], pos: [0, 26, -5.8], color: RIB },
      {
        name: "soulL",
        size: [3, 3, 0.8],
        pos: [-4, 27, -6],
        color: SOUL,
        glow: true,
      },
      {
        name: "soulR",
        size: [3, 3, 0.8],
        pos: [4, 24, -6],
        color: SOUL,
        glow: true,
      },
      {
        name: "soulC",
        size: [2, 2, 0.8],
        pos: [0, 30, -6],
        color: SOUL,
        glow: true,
      },
      {
        name: "head",
        size: [16, 16, 10],
        pos: [0, 42, 0],
        ...HEAD,
        color: SKIN,
      },
      {
        name: "jaw",
        size: [14, 3, 0.6],
        pos: [0, 38, -5.2],
        ...HEAD,
        color: DARK,
      },
      {
        name: "hornL",
        size: [8, 10, 1],
        pos: [-12, 46, 0],
        ...HEAD,
        color: SOUL,
        glow: true,
      },
      {
        name: "hornR",
        size: [8, 10, 1],
        pos: [12, 46, 0],
        ...HEAD,
        color: SOUL,
        glow: true,
      },
      {
        name: "armL",
        size: [8, 28, 8],
        pos: [-13, 19, 0],
        pivot: [-13, 33, 0],
        anim: "armL",
        color: SKIN,
      },
      {
        name: "armR",
        size: [8, 28, 8],
        pos: [13, 19, 0],
        pivot: [13, 33, 0],
        anim: "armR",
        color: SKIN,
      },
    ],
  },
};
