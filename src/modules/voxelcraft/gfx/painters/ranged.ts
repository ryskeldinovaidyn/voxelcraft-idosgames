// Тайлы: арбалет (ложе, дуга, тетива) и трезубец (древко с тремя зубьями).
import { PAINTERS, shade } from "../paint";

export const RANGED_TILES: string[] = [];

PAINTERS.crossbow = (px, rng) => {
  for (let i = 3; i < 14; i++)
    px(i, 16 - i, shade("#6a4a2a", (rng() - 0.5) * 0.1)); // ложе по диагонали
  for (let i = 1; i < 10; i++) {
    px(i, 5 - Math.floor(i / 3), "#8a8e94"); // дуга
    px(10 - Math.floor(i / 3), i + 1, "#8a8e94");
  }
  for (let i = 2; i < 9; i++) px(i, 11 - i, "#e8e0c8"); // тетива
};
PAINTERS.trident = (px) => {
  for (let i = 2; i < 15; i++) px(i, 16 - i, "#2a8a8a"); // древко
  for (const [x, y] of [
    [11, 2],
    [12, 1],
    [13, 5],
    [14, 4],
    [12, 3],
    [13, 2],
    [14, 1],
  ] as const)
    px(x, y, "#5ad0c8"); // зубья
};
RANGED_TILES.push("crossbow", "trident");
