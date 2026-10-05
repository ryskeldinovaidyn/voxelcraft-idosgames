// Дух-помощник (Allay): маленький светящийся летун. Дали предмет — собирает такие же выпавшие и несёт
// игроку (entities/AllayBrain, MobDef.collector). В мире — в заставах мародёров, как в Minecraft.
import type { MobDef, MobPart } from "../../types";
import { addNames } from "../names";

const BLUE = "#6ad0f8";
const parts: MobPart[] = [
  {
    name: "body",
    size: [3, 4, 2],
    pos: [0, 5, 0],
    color: "#4ab0e8",
    glow: true,
  },
  {
    name: "head",
    size: [5, 5, 5],
    pos: [0, 9.5, 0],
    pivot: [0, 7, 0],
    anim: "head",
    color: BLUE,
    glow: true,
  },
  {
    name: "eyeL",
    size: [1, 1, 0.4],
    pos: [-1.2, 10, -2.7],
    pivot: [0, 7, 0],
    anim: "head",
    color: "#1a3a6a",
  },
  {
    name: "eyeR",
    size: [1, 1, 0.4],
    pos: [1.2, 10, -2.7],
    pivot: [0, 7, 0],
    anim: "head",
    color: "#1a3a6a",
  },
  {
    name: "wingL",
    size: [0.5, 5, 4],
    pos: [-2, 6, 2],
    pivot: [-1, 7, 1],
    anim: "wingL",
    color: "#c8f0ff",
    glow: true,
  },
  {
    name: "wingR",
    size: [0.5, 5, 4],
    pos: [2, 6, 2],
    pivot: [1, 7, 1],
    anim: "wingR",
    color: "#c8f0ff",
    glow: true,
  },
  {
    name: "armL",
    size: [1, 3, 1],
    pos: [-2, 4.5, -0.5],
    pivot: [-2, 6, 0],
    anim: "armL",
    color: BLUE,
  },
  {
    name: "armR",
    size: [1, 3, 1],
    pos: [2, 4.5, -0.5],
    pivot: [2, 6, 0],
    anim: "armR",
    color: BLUE,
  },
];

export const ALLAY_MOBS: Record<string, MobDef> = {
  allay: {
    name: "allay",
    category: "passive",
    hp: 20,
    walkSpeed: 3,
    fleeSpeed: 4,
    box: { w: 0.35, h: 0.6 },
    flies: { height: 1.5 },
    collector: true,
    persistent: true,
    drops: [],
    xp: [0, 0],
    eye: 0.8,
    parts,
  },
};

addNames({ allay: "Дух-помощник" });
