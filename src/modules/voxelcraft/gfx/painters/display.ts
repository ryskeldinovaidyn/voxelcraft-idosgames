// Тайл подставки: деревянная рама с кожаной серединой, как у рамки для предметов.
import { PAINTERS, noisy } from "../paint";

export const DISPLAY_TILES: string[] = ["display_stand"];

PAINTERS.display_stand = (px, rng) => {
  noisy(px, "#8a6a3a", 0.08, rng);
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) px(x, y, "#c8a878"); // кожа
  for (let i = 2; i < 14; i++) {
    px(i, 2, "#5a3a1a");
    px(i, 13, "#5a3a1a");
    px(2, i, "#5a3a1a");
    px(13, i, "#5a3a1a");
  }
};
