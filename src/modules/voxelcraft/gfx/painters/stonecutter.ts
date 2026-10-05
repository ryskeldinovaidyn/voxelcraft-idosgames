// Тайлы камнереза: верх с пилой, бока каменные с деревянной окантовкой.
import { PAINTERS, noisy } from "../paint";

export const STONECUTTER_TILES: string[] = [];

PAINTERS.stonecutter_top = (px, rng) => {
  noisy(px, "#8a8a8a", 0.08, rng);
  for (let x = 1; x < 15; x++) {
    px(x, 7, "#c8ccd2"); // полотно пилы
    px(x, 8, x % 2 ? "#a8acb2" : "#e8ecf2"); // зубья
  }
};
PAINTERS.stonecutter_side = (px, rng) => {
  noisy(px, "#7a7a7a", 0.08, rng);
  for (let x = 0; x < 16; x++) {
    px(x, 0, "#6a4a2a");
    px(x, 1, "#8a6a3a");
  }
};
STONECUTTER_TILES.push("stonecutter_top", "stonecutter_side");
