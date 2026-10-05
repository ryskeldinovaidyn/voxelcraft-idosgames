// Тайлы: щиток броненосца и броня для волка.
import { PAINTERS, shade } from "../paint";

export const ARMADILLO_TILES: string[] = [];

PAINTERS.armadillo_scute = (px, rng) => {
  for (let y = 4; y < 13; y++)
    for (let x = 3; x < 13; x++) {
      if (Math.hypot((x - 7.5) / 5, (y - 8.5) / 4.5) > 1) continue;
      px(x, y, shade(y % 3 === 0 ? "#8a5046" : "#a86a5a", (rng() - 0.5) * 0.1));
    }
};
PAINTERS.wolf_armor = (px, rng) => {
  for (let y = 3; y < 12; y++)
    for (let x = 2; x < 14; x++)
      px(x, y, shade(x % 3 === 0 ? "#8a5046" : "#9a7a62", (rng() - 0.5) * 0.1));
  for (let x = 4; x < 12; x++) px(x, 12, "#6a4a3a"); // ремень
  px(2, 3, "#6a4a3a");
  px(13, 3, "#6a4a3a");
};
ARMADILLO_TILES.push("armadillo_scute", "wolf_armor");
