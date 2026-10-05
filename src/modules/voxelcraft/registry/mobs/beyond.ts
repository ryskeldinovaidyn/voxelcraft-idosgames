// Предел: Дракон Предела (босс, 200 здоровья, entities/DragonBrain.ts) и Кристаллы Предела на
// колоннах — лечат дракона, от любого удара взрываются. Ставит их игра при первом визите.
import type { MobDef } from "../../types";

const HIDE = "#1a1420",
  WING = "#2a2030",
  EYE = "#c040ff";

/**
 * Клещ Предела: мелкая тварь, которая иногда вылезает там, где приземлился брошенный Жемчуг
 * Предела (main слушает pearlLand). Живёт недолго и сама исчезает; Тенеход её не терпит.
 */
export const RIM_MITE: MobDef = {
  name: "rim_mite",
  category: "hostile",
  hp: 8,
  walkSpeed: 1.8,
  fleeSpeed: 2.6,
  chaseSpeed: 2.6,
  follow: 16,
  box: { w: 0.4, h: 0.3 },
  attack: { damage: 2, reach: 0.9, cooldown: 1 },
  lifespan: [60, 120],
  drops: [],
  xp: [3, 3],
  parts: [
    { name: "head", size: [3, 2, 2], pos: [0, 1, -3], color: "#2a2038" },
    { name: "body", size: [4, 3, 3], pos: [0, 1.5, -0.5], color: "#382a4a" },
    { name: "spark", size: [2, 1, 2], pos: [0, 3, -0.5], color: "#c060ff" },
    { name: "tail", size: [2, 2, 3], pos: [0, 1, 2.5], color: "#241c30" },
  ],
};

export const BEYOND_MOBS: Record<string, MobDef> = {
  rim_mite: RIM_MITE,
  void_dragon: {
    name: "void_dragon",
    category: "hostile",
    hp: 200,
    walkSpeed: 0,
    fleeSpeed: 0,
    chaseSpeed: 9,
    follow: 150,
    box: { w: 8, h: 3 },
    flies: { height: 0 },
    noClip: true,
    fireImmune: true,
    boss: "dragon",
    drops: [],
    xp: [12000, 12000],
    eye: 0.5,
    parts: [
      { name: "body", size: [48, 32, 80], pos: [0, 24, 0], color: HIDE },
      { name: "neck", size: [16, 16, 16], pos: [0, 28, -48], color: HIDE },
      {
        name: "head",
        size: [24, 18, 20],
        pos: [0, 30, -66],
        pivot: [0, 30, -56],
        anim: "head",
        color: HIDE,
      },
      {
        name: "eyeL",
        size: [4, 3, 0.4],
        pos: [-7, 34, -76.2],
        pivot: [0, 30, -56],
        anim: "head",
        color: EYE,
        glow: true,
      },
      {
        name: "eyeR",
        size: [4, 3, 0.4],
        pos: [7, 34, -76.2],
        pivot: [0, 30, -56],
        anim: "head",
        color: EYE,
        glow: true,
      },
      {
        name: "wingL",
        size: [112, 4, 56],
        pos: [-80, 36, -4],
        pivot: [-24, 36, 0],
        anim: "wingL",
        color: WING,
      },
      {
        name: "wingR",
        size: [112, 4, 56],
        pos: [80, 36, -4],
        pivot: [24, 36, 0],
        anim: "wingR",
        color: WING,
      },
      { name: "tail1", size: [16, 14, 32], pos: [0, 24, 56], color: HIDE },
      { name: "tail2", size: [12, 10, 32], pos: [0, 24, 88], color: HIDE },
      { name: "tail3", size: [8, 8, 32], pos: [0, 24, 120], color: HIDE },
      { name: "legFL", size: [8, 16, 8], pos: [-16, 0, -24], color: HIDE },
      { name: "legFR", size: [8, 16, 8], pos: [16, 0, -24], color: HIDE },
      { name: "legBL", size: [8, 16, 8], pos: [-16, 0, 24], color: HIDE },
      { name: "legBR", size: [8, 16, 8], pos: [16, 0, 24], color: HIDE },
    ],
  },

  beyond_crystal: {
    name: "beyond_crystal",
    category: "passive",
    hp: 1,
    walkSpeed: 0,
    fleeSpeed: 0,
    box: { w: 1.6, h: 2 },
    stationary: true,
    fireImmune: true,
    deathExplode: 6,
    drops: [],
    parts: [
      {
        name: "frame",
        size: [20, 20, 20],
        pos: [0, 16, 0],
        pivot: [0, 16, 0],
        anim: "head",
        color: "#e070ff",
        glow: true,
      },
    ],
  },
};
