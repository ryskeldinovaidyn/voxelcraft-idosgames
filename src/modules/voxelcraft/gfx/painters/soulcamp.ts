// Тайл верха костра душ: брёвна крестом и бирюзовое пламя (бока — общий campfire_side).
import { PAINTERS, TILE, shade } from "../paint";

export const SOUL_CAMP_TILES: string[] = [];

PAINTERS.soul_campfire_top = (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const log =
        (y >= 3 && y < 6) ||
        (y >= 10 && y < 13) ||
        (x >= 3 && x < 6) ||
        (x >= 10 && x < 13);
      if (log) px(x, y, shade("#5a3e24", (rng() - 0.5) * 0.12));
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 4 && rng() < 0.85)
        px(x, y, d < 2 ? "#b8f4ff" : rng() < 0.5 ? "#40c8e0" : "#1a8ab0");
    }
};
SOUL_CAMP_TILES.push("soul_campfire_top");
