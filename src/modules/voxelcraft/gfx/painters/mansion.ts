// Тайлы стола картографа и карт-исследователей.
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const MANSION_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  MANSION_TILES.push(name);
};

add("cartography_table_top", (px, rng) => {
  noisy(px, "#6a4a2a", 0.1, rng);
  for (let y = 2; y < 14; y++)
    for (let x = 2; x < 14; x++)
      px(x, y, shade("#e8dcb8", (rng() - 0.5) * 0.1));
  for (let x = 3; x < 13; x++) px(x, 5 + ((x >> 1) % 2), "#4a7ab0"); // река
  for (let y = 8; y < 13; y++) for (let x = 4; x < 8; x++) px(x, y, "#6a9a4a"); // лес
  px(10, 10, "#c02020");
});

add("cartography_table_side", (px, rng) => {
  noisy(px, "#4a3220", 0.12, rng);
  for (let x = 0; x < 16; x++) {
    px(x, 0, "#6a4a2a");
    px(x, 1, "#6a4a2a");
  }
  for (let y = 4; y < 9; y++) for (let x = 3; x < 9; x++) px(x, y, "#e8e0c8"); // свиток
  for (let x = 4; x < 8; x++) px(x, 6, "#8a7a5a");
});

/** Бумажная карта с пятном суши цвета land и меткой mark. */
const explorer =
  (land: string, mark: string): Painter =>
  (px, rng) => {
    for (let y = 1; y < 15; y++)
      for (let x = 1; x < 15; x++)
        px(x, y, shade("#d8c08a", (rng() - 0.5) * 0.12));
    for (let y = 4; y < 12; y++)
      for (let x = 3; x < 13; x++)
        if (Math.hypot(x - 7.5, y - 7.5) < 3.8 + rng()) px(x, y, land);
    px(7, 7, mark);
    px(8, 8, mark);
    px(8, 7, mark);
    px(7, 8, mark);
    for (let x = 1; x < 15; x++) px(x, 1, "#a08850"); // кромка
  };
add("ocean_explorer_map", explorer("#3a60c0", "#e0a020"));
add("woodland_explorer_map", explorer("#2a5a2a", "#8a5a3a"));
