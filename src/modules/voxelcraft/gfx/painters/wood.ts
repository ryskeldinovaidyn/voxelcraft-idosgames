// Тайлы пород дерева из таблицы WOOD_SPECIES (registry/blocks/wood.ts): доски, кора и срез бревна,
// листва, саженец, дверь (низ, верх, иконка) и люк — всё, чего у породы ещё не было.
import { WOOD_SPECIES, type WoodSpecies } from "../../registry/blocks/wood";
import { PAINTERS, TILE, shade, type Painter } from "../paint";
import { boat } from "./outdoor";

export const WOOD_TILES: string[] = [];
/** Тайлы поздних пород по волнам (1 — вишня, 2 — мангр; с лодкой): каждая волна — в конце атласа на момент добавления. */
export const LATE_TILES: Record<number, string[]> = { 1: [], 2: [] };
/** Волна 1 — вишня. */
export const LATE_WOOD_TILES = LATE_TILES[1]!;
let target = WOOD_TILES;

const add = (name: string, p: Painter): void => {
  if (PAINTERS[name]) return; // тайл уже есть (дуб, ель, берёза)
  PAINTERS[name] = p;
  target.push(name);
};

const planks =
  (c: string, seam: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const joint =
          y % 4 === 3 ||
          (y < 4 && x === 10) ||
          (y >= 4 && y < 8 && x === 4) ||
          (y >= 8 && y < 12 && x === 12) ||
          (y >= 12 && x === 7);
        px(x, y, joint ? seam : shade(c, (rng() - 0.5) * 0.12));
      }
  };

const logSide =
  (bark: string): Painter =>
  (px, rng) => {
    for (let x = 0; x < TILE; x++) {
      const stripe = x % 4 === 3 ? -0.22 : (rng() - 0.5) * 0.14;
      for (let y = 0; y < TILE; y++)
        px(x, y, shade(bark, stripe + (rng() - 0.5) * 0.08));
    }
  };

const logTop =
  (bark: string, core: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const edge = x < 2 || y < 2 || x > 13 || y > 13;
        const r = Math.hypot(x - 7.5, y - 7.5);
        const ring =
          !edge && (Math.abs(r - 2.5) < 0.5 || Math.abs(r - 4.5) < 0.5);
        px(
          x,
          y,
          edge
            ? shade(bark, (rng() - 0.5) * 0.1)
            : shade(core, (ring ? -0.18 : 0) + (rng() - 0.5) * 0.1),
        );
      }
  };

const leaves =
  (c: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        if (rng() >= 0.18) px(x, y, shade(c, (rng() - 0.5) * 0.35));
  };

const sapling =
  (s: WoodSpecies): Painter =>
  (px, rng) => {
    for (let y = 9; y < TILE; y++)
      px(7, y, shade(s.colors.bark, (rng() - 0.5) * 0.1));
    for (let y = 2; y < 11; y++)
      for (let x = 3; x < 13; x++) {
        const d = Math.hypot(x - 7.5, (y - 6) * 1.3);
        if (d < 4.6 && rng() > 0.15)
          px(x, y, shade(s.colors.leaf, (rng() - 0.5) * 0.3));
      }
  };

const door =
  (s: WoodSpecies, top: boolean): Painter =>
  (px, rng) => {
    const { planks: c, seam } = s.colors;
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const frame = x < 2 || x > 13 || (top ? y < 2 : y > 13);
        const window =
          top && x > 3 && x < 12 && y > 3 && y < 11 && x !== 7 && x !== 8;
        px(
          x,
          y,
          frame
            ? seam
            : window
              ? "#9ac4d8"
              : shade(c, (x % 5 === 0 ? -0.1 : 0) + (rng() - 0.5) * 0.1),
        );
      }
    if (!top) px(12, 2, "#2a2a2a"); // ручка
  };

const doorItem =
  (s: WoodSpecies): Painter =>
  (px) => {
    for (let y = 1; y < 15; y++)
      for (let x = 4; x < 12; x++)
        px(
          x,
          y,
          x === 4 || x === 11 || y === 1 || y === 14
            ? s.colors.seam
            : s.colors.planks,
        );
    px(10, 8, "#2a2a2a");
  };

const trapdoor =
  (s: WoodSpecies): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const frame = x < 2 || y < 2 || x > 13 || y > 13;
        const hole = !frame && (x === 5 || x === 10) && (y === 5 || y === 10);
        px(
          x,
          y,
          frame
            ? s.colors.seam
            : hole
              ? "#00000000"
              : shade(s.colors.planks, (rng() - 0.5) * 0.1),
        );
      }
  };

for (const s of WOOD_SPECIES) {
  target = s.late ? (LATE_TILES[s.late] ??= []) : WOOD_TILES;
  if (s.late) add(`${s.id}_boat`, boat(s)); // лодки ранних пород — в painters/outdoor
  const t = (k: string) => `${s.id}_${k}`;
  if (!s.has.planks) add(s.planks, planks(s.colors.planks, s.colors.seam));
  if (!s.has.log) {
    add(t("log_side"), logSide(s.colors.bark));
    add(t("log_top"), logTop(s.colors.bark, s.colors.core));
  }
  if (!s.has.leaves) add(s.leaves, leaves(s.colors.leaf));
  add(s.sapling, sapling(s));
  if (!s.has.forms) {
    add(t("door_bottom"), door(s, false));
    add(t("door_top"), door(s, true));
    add(t("door_item"), doorItem(s));
    add(t("trapdoor"), trapdoor(s));
  }
}
