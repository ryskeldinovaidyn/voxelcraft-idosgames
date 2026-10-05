// Тайлы нюхача и древних растений: яйцо, ростки, факелоцвет, кувшинное растение; предметы — семена
// факелоцвета и стручок кувшинки.
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const SNIFFER_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  SNIFFER_TILES.push(name);
};

add("sniffer_egg", (px, rng) => {
  noisy(px, "#8a3a2a", 0.15, rng);
  for (let k = 0; k < 10; k++)
    px(
      Math.floor(rng() * 16),
      Math.floor(rng() * 16),
      rng() < 0.5 ? "#4a7a3a" : "#c8603a",
    );
});

/** Росток: стебель с листьями, наверху бутон цвета bud. */
const sprout =
  (bud: string): Painter =>
  (px) => {
    for (let y = 6; y < 16; y++) px(7, y, "#4a7a2a");
    for (const [x, y] of [
      [5, 11],
      [6, 12],
      [9, 9],
      [10, 10],
    ] as const)
      px(x, y, "#6a9a3a");
    for (let y = 3; y < 6; y++) for (let x = 6; x < 9; x++) px(x, y, bud);
  };
add("torchflower_crop", sprout("#c8603a"));
add("pitcher_crop", sprout("#3a8a8a"));

add("torchflower", (px, rng) => {
  for (let y = 7; y < 16; y++) px(7, y, "#4a7a2a");
  for (let y = 1; y < 8; y++)
    for (let x = 4; x < 12; x++)
      if (Math.hypot(x - 7.5, (y - 4) * 1.2) < 3.8)
        px(x, y, shade(y < 4 ? "#f8c040" : "#e88a20", (rng() - 0.5) * 0.15));
  px(7, 3, "#fff0a0");
});

add("pitcher_plant", (px, rng) => {
  for (let y = 9; y < 16; y++) px(7, y, "#3a6a3a");
  for (let y = 2; y < 11; y++) {
    const w = y < 4 ? 2 : 3;
    for (let x = 8 - w; x < 8 + w; x++)
      px(x, y, shade(y < 5 ? "#8a5aa0" : "#3a8aa0", (rng() - 0.5) * 0.15));
  }
  for (let x = 3; x < 7; x++) px(x, 12, "#4a8a3a");
  for (let x = 9; x < 13; x++) px(x, 11, "#4a8a3a");
});

add("torchflower_seeds", (px) => {
  for (const [x, y] of [
    [5, 7],
    [9, 6],
    [7, 10],
    [10, 10],
  ] as const) {
    px(x, y, "#c8603a");
    px(x + 1, y, "#8a3a2a");
  }
});

add("pitcher_pod", (px) => {
  for (let y = 4; y < 13; y++) {
    const w = y < 6 || y > 10 ? 1 : 2;
    for (let x = 8 - w; x < 8 + w; x++) px(x, y, y < 6 ? "#4a7a2a" : "#3a8a8a");
  }
});
