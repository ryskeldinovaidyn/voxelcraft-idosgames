// Пепельный владыка (иссушитель Minecraft): три головы на хребте, 300 здоровья, летает и стреляет
// черепами, накладывающими Тление. Призывается тремя пепельными черепами на Т из песка душ
// (entities/AshLord.ts), логика — entities/AshLordBrain.ts. Своего спавна нет.
import type { MobDef, MobPart } from "../../types";

const BONE = "#262626",
  DARK = "#1a1a1a",
  EYE = "#d8dcf0";

/** Голова: куб size в точке (x, y) и два светящихся глаза на лицевой грани. */
function head(name: string, x: number, y: number, size: number): MobPart[] {
  const half = size / 2;
  const pivot: [number, number, number] = [x, y - half, 0];
  return [
    {
      name,
      size: [size, size, size],
      pos: [x, y, 0],
      pivot,
      anim: "head",
      color: BONE,
    },
    {
      name: name + "EyeL",
      size: [2, 1, 0.4],
      pos: [x - size / 4, y + 1, -half - 0.2],
      pivot,
      anim: "head",
      color: EYE,
      glow: true,
    },
    {
      name: name + "EyeR",
      size: [2, 1, 0.4],
      pos: [x + size / 4, y + 1, -half - 0.2],
      pivot,
      anim: "head",
      color: EYE,
      glow: true,
    },
  ];
}

export const BOSS_MOBS: Record<string, MobDef> = {
  ash_lord: {
    name: "ash_lord",
    category: "hostile",
    hp: 300,
    walkSpeed: 3,
    fleeSpeed: 3,
    chaseSpeed: 4,
    follow: 40,
    box: { w: 0.9, h: 3 },
    flies: { height: 4 },
    fireImmune: true,
    boss: "ash_lord",
    ranged: {
      damage: 8,
      speed: 12,
      cooldown: 2,
      range: 32,
      projectile: "skull",
    },
    drops: [{ item: "inferno_star", n: 1 }],
    xp: [50, 50],
    eye: 0.85,
    parts: [
      {
        name: "tail",
        size: [3, 10, 3],
        pos: [0, 8, 3],
        pivot: [0, 14, 0],
        pose: [0.5, 0, 0],
        color: DARK,
      },
      { name: "spine", size: [3, 16, 3], pos: [0, 24, 0], color: BONE },
      { name: "rib1", size: [11, 2, 6], pos: [0, 29, 0], color: BONE },
      { name: "rib2", size: [11, 2, 6], pos: [0, 25, 0], color: BONE },
      { name: "rib3", size: [11, 2, 6], pos: [0, 21, 0], color: BONE },
      { name: "shoulders", size: [22, 3, 3], pos: [0, 34, 0], color: BONE },
      ...head("head", 0, 41, 8),
      ...head("headL", -10, 38, 6),
      ...head("headR", 10, 38, 6),
    ],
  },
};
