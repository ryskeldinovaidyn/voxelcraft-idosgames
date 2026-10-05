// Грибная корова: живёт только в грибных полях (на мицелии). Миской — грибной суп, ведром — молоко,
// ножницами — становится обычной коровой и роняет 5 красных грибов (player/Interaction).
import type { MobDef, MobPart } from "../../types";
import { addNames } from "../names";
import { PASSIVE_MOBS } from "./passive";

const cow = PASSIVE_MOBS.cow!;
const RECOLOR: Record<string, string> = {
  "#4a3a2e": "#a8261c",
  "#3a2e24": "#8a1e16",
  "#ece6dc": "#d8d0c8",
};

/** Красный гриб на спине: ножка и шляпка. */
const shroom = (
  name: string,
  x: number,
  y: number,
  z: number,
  head = false,
): MobPart[] => {
  const pv = head
    ? { pivot: [0, 20, -9] as [number, number, number], anim: "head" as const }
    : {};
  return [
    {
      name: name + "Stem",
      size: [1, 2, 1],
      pos: [x, y + 1, z],
      ...pv,
      color: "#e8dcc8",
    },
    {
      name: name + "Cap",
      size: [3, 1.5, 3],
      pos: [x, y + 2.7, z],
      ...pv,
      color: "#c0302a",
    },
  ];
};

export const MUSHROOM_MOBS: Record<string, MobDef> = {
  mooshroom: {
    ...cow,
    name: "mooshroom",
    spawn: {
      light: "bright",
      ground: ["mycelium"],
      biomes: ["mushroom_fields"],
      weight: 8,
      group: [2, 4],
    },
    parts: [
      ...cow.parts.map((p) => ({
        ...p,
        color: RECOLOR[p.color ?? ""] ?? p.color,
      })),
      ...shroom("m1", -3, 22, -2),
      ...shroom("m2", 3, 22, 4),
      ...shroom("m3", 0, 22, 1),
      ...shroom("m4", 0, 24, -12, true),
    ],
  },
};

addNames({ mooshroom: "Грибная корова" });
